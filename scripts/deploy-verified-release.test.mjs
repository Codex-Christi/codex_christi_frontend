import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const deployScript = fileURLToPath(
  new URL('../devScripts/deploy-verified-release.sh', import.meta.url),
);

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'codex-release-test-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const remote = join(root, 'remote.git');
  const bin = join(root, 'bin');
  const output = join(root, 'deployment-output');
  const rollbackTag = join(root, 'rollback-tag');
  mkdirSync(source);
  mkdirSync(bin);
  const env = {
    ...process.env,
    APP_DIR: source,
    COMPOSE_PROJECT_NAME: '',
    DEPLOY_TEST_OUTPUT: output,
    DEPLOY_TEST_IMAGE_TAGGED: rollbackTag,
    FIXTURE_PROJECT: 'existing-production-project',
    GIT_AUTHOR_NAME: 'Deployment test',
    GIT_AUTHOR_EMAIL: 'deployment@example.invalid',
    GIT_COMMITTER_NAME: 'Deployment test',
    GIT_COMMITTER_EMAIL: 'deployment@example.invalid',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    PATH: `${bin}:${process.env.PATH}`,
  };
  function git(...args) {
    const result = spawnSync('git', args, { cwd: source, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git('init', '--bare', '--initial-branch=main', remote);
  git('init', '--initial-branch=main');
  mkdirSync(join(source, 'devScripts'));
  writeFileSync(join(source, '.gitignore'), '.env.production\n.deployment.lock\ndeploy-*.log\n');
  writeFileSync(join(source, 'app.txt'), 'verified application\n');
  writeFileSync(join(source, 'serverlogs.txt'), 'obsolete generated log\n');
  writeFileSync(
    join(source, 'devScripts/production.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
test -f "$APP_DIR/.env.production"
if [ "\${FIXTURE_DEPLOY_READ_STDIN:-0}" = 1 ]; then cat >/dev/null; fi
printf '%s\\n' "$APP_DIR" "$COMPOSE_PROJECT_NAME" "$SKIP_DOCKER_PRUNE" "$(git -C "$APP_DIR" rev-parse HEAD)" > "$DEPLOY_TEST_OUTPUT"
exit "\${FIXTURE_DEPLOY_EXIT:-0}"
`,
  );
  git('add', '.');
  git('commit', '-m', 'Verified release');
  const revision = git('rev-parse', 'HEAD');
  git('remote', 'add', 'origin', remote);
  git('push', '-u', 'origin', 'main');
  // A server checkout may contain both local history and generated-file changes.
  writeFileSync(join(source, 'app.txt'), 'preserved VPS-only change\n');
  git('add', 'app.txt');
  git('commit', '-m', 'Server-only change');
  const originalHead = git('rev-parse', 'HEAD');
  unlinkSync(join(source, 'serverlogs.txt'));
  writeFileSync(join(source, '.env.production'), 'PRIVATE_TEST_VALUE=never-print-this\n');
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
case "$1 $2" in
  'container inspect')
    if [ "\${FIXTURE_CONTAINER_ABSENT:-0}" = 1 ]; then exit 1; fi
    if [ "\${3:-}" = --format ]; then
      case "$4" in
        *'.Mounts'*) printf '%s\\n' "\${FIXTURE_CATALOG_MOUNT:-volume:\${FIXTURE_PROJECT}_merchize_price_catalog_data}" ;;
        '{{.Image}}') printf '%s\\n' sha256:previous-runtime ;;
        *) printf '%s\\n' "$FIXTURE_PROJECT" ;;
      esac
    fi
    ;;
  'image inspect') test -f "$DEPLOY_TEST_IMAGE_TAGGED" ;;
  'image tag') printf '%s\\n' "$3" "$4" > "$DEPLOY_TEST_IMAGE_TAGGED" ;;
  *) echo 'Unexpected Docker operation in test.' >&2; exit 99 ;;
esac
`,
    { mode: 0o755 },
  );
  // macOS has no flock; production lock behavior is Linux-specific.
  writeFileSync(join(bin, 'flock'), '#!/usr/bin/env bash\nexit "${FIXTURE_LOCK_EXIT:-0}"\n', {
    mode: 0o755,
  });
  function run(overrides = {}, sha = revision, fromStdin = false) {
    return spawnSync('bash', fromStdin ? ['-s', '--', sha] : [deployScript, sha], {
      cwd: root,
      env: { ...env, ...overrides },
      encoding: 'utf8',
      input: fromStdin ? readFileSync(deployScript, 'utf8') : undefined,
    });
  }
  return {
    root,
    source,
    output,
    rollbackTag,
    revision,
    originalHead,
    git,
    run,
    release: join(root, 'codexchristi-releases', revision),
  };
}

test('deploys the verified revision while preserving server edits, environment, and Compose identity', (t) => {
  const f = fixture(t);
  const originalStatus = f.git('status', '--short', '--untracked-files=no');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.git('rev-parse', 'HEAD'), f.originalHead);
  assert.equal(f.git('status', '--short', '--untracked-files=no'), originalStatus);
  assert.equal(readFileSync(join(f.source, 'app.txt'), 'utf8'), 'preserved VPS-only change\n');
  assert.equal(existsSync(join(f.source, 'serverlogs.txt')), false);
  assert.equal(readFileSync(join(f.release, 'app.txt'), 'utf8'), 'verified application\n');
  assert.equal(lstatSync(join(f.release, '.env.production')).isSymbolicLink(), true);
  assert.equal(readlinkSync(join(f.release, '.env.production')), join(f.source, '.env.production'));
  assert.deepEqual(readFileSync(f.output, 'utf8').trim().split('\n'), [
    f.release,
    'existing-production-project',
    '1',
    f.revision,
  ]);
  assert.deepEqual(readFileSync(f.rollbackTag, 'utf8').trim().split('\n'), [
    'sha256:previous-runtime',
    `codexchristi-next:before-${f.revision.slice(0, 12)}`,
  ]);
  const logFiles = readdirSync(f.source).filter((name) => /^deploy-\d{14}\.log$/.test(name));
  assert.ok(logFiles.length > 0, 'Keep the deployment log in the original VPS app directory.');
  const log = logFiles.map((name) => readFileSync(join(f.source, name), 'utf8')).join('\n');
  assert.match(log, new RegExp(`Starting deploy.*${f.revision}`));
  assert.ok(log.includes(`Verified release ${f.revision} is running from ${f.release}.`));
  assert.doesNotMatch(result.stdout + result.stderr, /never-print-this/);
  // Retrying a failed job must safely reuse the same isolated checkout.
  const retry = f.run();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(f.git('rev-parse', 'HEAD'), f.originalHead);
});

test('rejects a Compose project mismatch before creating a release or running deployment', (t) => {
  const f = fixture(t);
  const result = f.run({ COMPOSE_PROJECT_NAME: 'different-project' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /differs from the running app project/);
  assert.equal(existsSync(f.release), false);
  assert.equal(existsSync(f.output), false);
});

test('keeps reading the remote shell script when deployment subprocesses read stdin', (t) => {
  const f = fixture(t);
  const result = f.run({ FIXTURE_DEPLOY_READ_STDIN: '1' }, f.revision, true);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(f.output, 'utf8').trim().split('\n'), [
    f.release,
    'existing-production-project',
    '1',
    f.revision,
  ]);
  assert.ok(
    result.stdout.includes(`Verified release ${f.revision} is running from ${f.release}.`),
    'The wrapper must execute its final confirmation after the deployment subprocess exits.',
  );
});

test('refuses a modified existing release rather than deploying altered source', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  unlinkSync(f.output);
  writeFileSync(join(f.release, 'app.txt'), 'unexpected release edit\n');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /preparing an isolated release checkout/);
  assert.equal(existsSync(f.output), false);
});

test('refuses a mismatched catalog mount before creating a release', (t) => {
  const f = fixture(t);
  const result = f.run({ FIXTURE_CATALOG_MOUNT: 'volume:unrelated-catalog' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Unexpected existing catalog mount/);
  assert.equal(existsSync(f.release), false);
  assert.equal(existsSync(f.output), false);
});

test('requires a full SHA and an existing production environment before deployment', (t) => {
  const f = fixture(t);
  const invalid = f.run({}, 'main');
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stdout + invalid.stderr, /Expected a full Git commit SHA/);
  unlinkSync(join(f.source, '.env.production'));
  const missingEnv = f.run();
  assert.notEqual(missingEnv.status, 0);
  assert.match(missingEnv.stdout + missingEnv.stderr, /preflight/);
  assert.equal(existsSync(f.release), false);
  assert.equal(existsSync(f.output), false);
});

test('requires explicit Compose identity if there is no running app container', (t) => {
  const f = fixture(t);
  const result = f.run({ FIXTURE_CONTAINER_ABSENT: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Set COMPOSE_PROJECT_NAME/);
  assert.equal(existsSync(f.output), false);
  const firstDeployment = f.run({
    FIXTURE_CONTAINER_ABSENT: '1',
    COMPOSE_PROJECT_NAME: 'known-project',
  });
  assert.equal(firstDeployment.status, 0, firstDeployment.stderr);
  assert.equal(readFileSync(f.output, 'utf8').split('\n')[1], 'known-project');
});

test('propagates a deployment failure and identifies the failed stage', (t) => {
  const f = fixture(t);
  const result = f.run({ FIXTURE_DEPLOY_EXIT: '42' });
  assert.equal(result.status, 42);
  assert.match(result.stdout + result.stderr, /building and starting the verified release/);
  assert.doesNotMatch(result.stdout, /Verified release .* is running/);
});

test('does not start a second deployment when the VPS lock is already held', (t) => {
  const f = fixture(t);
  const result = f.run({ FIXTURE_LOCK_EXIT: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Another VPS deployment is running/);
  assert.equal(existsSync(f.output), false);
});
