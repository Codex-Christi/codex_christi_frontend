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

function assertWorkflowSafeguards(workflow: string) {
  const verify = workflowJob(workflow, 'verify');
  const build = workflowJob(workflow, 'container-build');
  const release = workflowJob(workflow, 'release');
  assert.match(verify, /^[ \t]+run: yarn test:auth[ \t]*$/m, 'verify must run the auth suite.');
  assertDependency(build, 'container-build', 'verify');
  assertDependency(release, 'release', 'verify');
  assertDependency(release, 'release', 'container-build');
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
      workflow.replace('needs: [verify, container-build]', 'needs: [container-build]'),
      /release must depend on verify/,
    ],
    [
      workflow.replace('needs: [verify, container-build]', 'needs: [verify]'),
      /release must depend on container-build/,
    ],
  ] as const) {
    assert.throws(() => assertWorkflowSafeguards(changed), message);
  }
});
