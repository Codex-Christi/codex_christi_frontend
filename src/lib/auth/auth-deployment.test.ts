import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

function workflowJob(workflow: string, name: string) {
  const jobs = [...workflow.matchAll(/^  ([\w-]+):[ \t]*$/gm)];
  const index = jobs.findIndex((job) => job[1] === name);
  assert.ok(index >= 0, `The workflow must define the ${name} job.`);
  return workflow.slice(jobs[index].index, jobs[index + 1]?.index);
}

function assertDependency(job: string, name: string, dependency: string) {
  const needs = job.match(/^    needs:[ \t]*(.+)$/m)?.[1] ?? '';
  const dependencies = needs
    .replace(/[ \t]+#.*$/, '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ''));
  assert.ok(dependencies.includes(dependency), `${name} must depend on ${dependency}.`);
}

function workflowStep(job: string, name: string) {
  const prefix = `      - name: ${name}\n`;
  const start = job.indexOf(prefix);
  assert.ok(start >= 0, `The workflow must run ${name}.`);
  const end = job.indexOf('\n      - ', start + prefix.length);
  return { start, body: job.slice(start, end < 0 ? undefined : end) };
}

function assertRequiredStep(step: string) {
  assert.doesNotMatch(step, /^        (?:if|continue-on-error):/m,
    'Mandatory checks must not be skipped or allowed to fail.');
}

function assertWorkflowSafeguards(workflow: string) {
  const verify = workflowJob(workflow, 'verify');
  const build = workflowJob(workflow, 'container-build');
  const auth = workflowStep(verify, 'Authentication safeguards').body;
  assert.match(auth, /^[ \t]+run: yarn test:auth[ \t]*$/m, 'verify must run the auth suite.');
  assertRequiredStep(auth);
  assert.doesNotMatch(verify, /^    (?:if|continue-on-error):/m, 'The verification job is mandatory.');
  assertDependency(build, 'container-build', 'verify');
  assert.doesNotMatch(build, /^    (?:if|continue-on-error):/m, 'The image build job is mandatory.');
  const imageBuild = workflowStep(build, 'Build both revision-tagged images without application configuration');
  const imageChecks = workflowStep(build, 'Verify the exact built images offline');
  const packageImages = workflowStep(build, 'Package exactly the tested image pair for staging');
  const authentication = workflowStep(build, 'Prepare pinned SSH host authentication');
  const stage = workflowStep(build, 'Submit the checked image pair to the private inbox');
  const steps = [imageBuild, imageChecks, packageImages, authentication, stage];
  assert.deepEqual(steps.map((step) => step.start), steps.map((step) => step.start).sort((a, b) => a - b),
    'Image creation and verification must precede packaging and staging.');
  assertRequiredStep(imageBuild.body);
  assertRequiredStep(imageChecks.body);
  const gate = "        if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main' && vars.LEASEWEB_FRONTEND_STAGE_ENABLED == 'true'";
  for (const step of [packageImages, authentication, stage]) {
    assert.ok(step.body.split('\n').includes(gate), 'Staging must require an enabled main run and successful checks.');
    assert.doesNotMatch(step.body, /^        continue-on-error:/m, 'Staging must not continue on error.');
  }
}

test('deployment verification runs the auth suite before container build and release', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.match(scripts['test:auth'], /--conditions=react-server/);
  assert.match(scripts['test:auth'], /src\/lib\/auth\/\*\.test\.ts/);
  assert.match(scripts['test:auth'], /src\/lib\/session\/\*\.test\.ts/);
  const workflow = readFileSync(new URL('.github/workflows/push-to-main.yml', root), 'utf8');
  assertWorkflowSafeguards(workflow);
});

test('deployment safeguards reject misplaced auth checks and missing dependencies', () => {
  const workflow = readFileSync(new URL('.github/workflows/push-to-main.yml', root), 'utf8');
  const misplacedAuth =
    workflow.replace('run: yarn test:auth', 'run: echo skipped') +
    '\n  unrelated:\n    steps:\n      - run: yarn test:auth\n';
  assert.throws(() => assertWorkflowSafeguards(misplacedAuth), /verify must run the auth suite/);
  for (const [changed, message] of [
    [workflow.replace('    needs: verify\n', ''), /container-build must depend on verify/],
    [
      workflow.replace('      - name: Verify the exact built images offline', '      - name: Missing image tests'),
      /The workflow must run Verify the exact built images offline/,
    ],
    [
      workflow.replace('      - name: Verify the exact built images offline', '      - name: Verify the exact built images offline\n        continue-on-error: true'),
      /Mandatory checks must not be skipped or allowed to fail/,
    ],
    [
      workflow.replace('      - name: Verify the exact built images offline', '      - name: Package exactly the tested image pair for staging')
        .replace('      - name: Package exactly the tested image pair for staging\n        if:', '      - name: Verify the exact built images offline\n        if:'),
      /Image creation and verification must precede packaging and staging/,
    ],
    [
      workflow.replace(/        if: \(github\.event_name[^\n]+/, '        if: always()'),
      /Staging must require an enabled main run and successful checks/,
    ],
  ] as const) {
    assert.throws(() => assertWorkflowSafeguards(changed), message);
  }
});
