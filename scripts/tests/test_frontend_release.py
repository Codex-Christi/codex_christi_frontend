"""Exercise the release script against a fake Docker daemon and real Git checkout.

No network, Docker daemon, real database, SSH account or production file is used.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[2] / 'devScripts' / 'production.sh'
WORKFLOW = Path(__file__).resolve().parents[2] / '.github/workflows/push-to-main.yml'
COMPOSE_FILE = Path(__file__).resolve().parents[2] / 'docker-compose.yml'
DOCKERFILE = Path(__file__).resolve().parents[2] / 'Dockerfile'
RUNTIME_IMAGE_CHECK = Path(__file__).resolve().parent / 'check-runtime-image-config.sh'
OLD = 'sha256:' + '1' * 64
NEW = 'sha256:' + '2' * 64
CHECK = 'sha256:' + '3' * 64
OLD_CHECK = 'sha256:' + '4' * 64
OLD_REV = 'a' * 40

FAKE_DOCKER = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
p=pathlib.Path(os.environ['RELEASE_FIXTURE'])
s=json.loads(p.read_text())
a=sys.argv[1:]
with p.with_suffix('.calls').open('a') as f:
    f.write(json.dumps({'args':a,'image':os.environ.get('DEPLOY_IMAGE'),'runtime_env':os.environ.get('RUNTIME_ENV_FILE')})+'\n')
def save(): p.write_text(json.dumps(s))
if a == ['info']: print('fixture daemon'); raise SystemExit(0)
if a[:2] == ['container','inspect']:
    collision=s['mode']=='settings_collision' and a[-1].startswith('codex-christi-release-settings-check-')
    raise SystemExit(0 if collision or a[-1] in s.get('checks',{}) else 1)
if a[:2] == ['container','rm']:
    s.setdefault('checks',{}).pop(a[-1],None); save(); raise SystemExit(0)
if a[:2] == ['image','inspect']:
    image=a[-1]
    if '--format' in a:
        image=a[-1]
        if 'org.codex-christi.release-settings' in a[a.index('--format')+1]:
            feature=''
            if image==s['new'] and s['mode']!='missing_settings_label':
                feature='1' if s['mode']=='compiled_settings_label' else '2'
            elif image==s['old'] and s.get('modern_old'):
                feature='1'
            print(feature)
            raise SystemExit(0)
        print(image+(' linux/arm64' if s['mode']=='wrong_platform' else ' linux/amd64'))
    else:
        rev=s['new_revision'] if image in (s['new'],s['check']) else s['old_revision']
        if s['mode']=='wrong_image_label' and image==s['new']: rev='f'*40
        print(json.dumps([{'Config':{'Labels':{'org.opencontainers.image.revision':rev},'Env':['APP_REVISION='+rev]}}]))
    raise SystemExit(0)
if a[:2] == ['inspect','--format']:
    field=a[2]
    oneoff=s.get('checks',{}).get(a[-1])
    if 'com.docker.compose.project' in field: print('foreign' if s['mode']=='foreign' or (oneoff and s['mode']=='settings_foreign_retained') else 'codex-christi-frontend')
    elif 'com.docker.compose.service' in field: print(oneoff or 'app')
    elif '.State.Status' in field: print('running')
    elif '.State.Health.Status' in field: print('healthy')
    elif '.Image' in field: print(s['current'])
    else: raise SystemExit('unknown inspect '+field)
    raise SystemExit(0)
if a and a[0]=='compose':
    if 'config' in a:
        if '--services' in a:
            print('app\ndatastore-check')
            if os.environ.get('DEPLOY_IMAGE')==s['new'] or s.get('modern_old'): print('release-settings-check')
        raise SystemExit(0)
    if 'ps' in a: print('frontend-container'); raise SystemExit(0)
    if 'run' in a:
        service=a[-1]
        if service=='release-settings-check' and s['mode'] in ('settings_failure_retained','settings_foreign_retained'):
            s.setdefault('checks',{})[a[a.index('--name')+1]]=service; save(); raise SystemExit(143)
        failed=(s['mode']=='settings_failure' and service=='release-settings-check') or (s['mode']=='database_failure' and service=='datastore-check')
        raise SystemExit(1 if failed else 0)
    if 'up' in a:
        s['current']=os.environ['DEPLOY_IMAGE']; save()
        raise SystemExit(1 if s['mode']=='recovery_failure' or (s['current']==s['new'] and s['mode']=='app_failure') else 0)
    if 'exec' in a:
        print(s['new_revision'] if s['current']==s['new'] else s['old_revision'])
        raise SystemExit(0)
raise SystemExit('unhandled fake docker command: '+repr(a))
'''
FAKE_PROXY = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
p=pathlib.Path(os.environ['RELEASE_FIXTURE']); s=json.loads(p.read_text())
with p.with_suffix('.proxy').open('a') as f: f.write(sys.argv[-1]+'\n')
raise SystemExit(1 if s['mode']=='proxy_failure' and sys.argv[-1]==s['new_revision'] else 0)
'''


class ComposeRevisionTests(unittest.TestCase):
    def test_release_revision_overrides_stale_runtime_revision_without_changing_settings(self):
        docker = shutil.which('docker')
        if docker is None:
            self.skipTest('Docker Compose CLI is unavailable; no daemon is needed for this check.')
        with tempfile.TemporaryDirectory(prefix='codex-compose-revision-test-') as temporary:
            root = Path(temporary)
            config = root / 'docker-config'
            config.mkdir()
            # Docker Desktop keeps its public CLI plugins inside the application.
            # Use that location without reading the user's Docker configuration.
            plugins = Path('/Applications/Docker.app/Contents/Resources/cli-plugins')
            if (plugins / 'docker-compose').is_file():
                (config / 'config.json').write_text(json.dumps({'cliPluginsExtraDirs': [str(plugins)]}))
            environment = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'),
                           'HOME': str(root), 'LANG': 'C', 'DOCKER_CONFIG': str(config),
                           'DOCKER_HOST': 'unix://' + str(root / 'no-daemon.sock')}
            version = subprocess.run([docker, 'compose', 'version', '--short'],
                                     env=environment, capture_output=True, text=True, timeout=20)
            if version.returncode:
                self.skipTest('Docker Compose CLI plugin is unavailable; no daemon is needed for this check.')
            runtime = root / 'runtime.env'
            original = 'APP_REVISION=' + OLD_REV + '\nPRIVATE_FIXTURE=preserved-value\n'
            runtime.write_text(original)
            revision = 'b' * 40
            release = root / 'release.env'
            release.write_text('DEPLOY_REVISION=' + revision + '\nDEPLOY_IMAGE=' + NEW
                               + '\nDATASTORE_CHECK_IMAGE=' + CHECK
                               + '\nRUNTIME_ENV_FILE=' + str(runtime) + '\n')
            result = subprocess.run([
                docker, 'compose', '--project-directory', str(root), '--env-file', str(release),
                '-f', str(COMPOSE_FILE), '--profile', 'verify', 'config', '--format', 'json'],
                env=environment, capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stderr)
            model = json.loads(result.stdout)
            app = model['services']['app']
            self.assertEqual(app['environment']['APP_REVISION'], revision)
            self.assertEqual(app['environment']['PRIVATE_FIXTURE'], 'preserved-value')
            self.assertEqual(runtime.read_text(), original)
            self.assertFalse(app.get('ports'))
            self.assertEqual(set(app['networks']), {'webserver-network', 'frontend-egress'})
            self.assertEqual({mount['source'] for mount in app['volumes']},
                             {'merchize_price_catalog_data', 'next_image_cache'})
            self.assertEqual(model['networks']['webserver-network']['name'], 'codex-christi-network')
            self.assertEqual(model['volumes']['merchize_price_catalog_data']['name'], 'codex-christi-next-data')


class WorkflowContractTests(unittest.TestCase):
    def test_review_branch_pushes_run_checks_and_pull_requests_target_main(self):
        workflow = WORKFLOW.read_text()
        events = workflow.split('\npermissions:', 1)[0]
        push = events.split('  push:\n', 1)[1].split('  pull_request:\n', 1)[0]
        pull_request = events.split('  pull_request:\n', 1)[1]
        for event, expected in ((push, ['**']), (pull_request, ['main'])):
            match = re.search(r'^    branches: \[(.*?)\]$', event, re.MULTILINE)
            self.assertIsNotNone(match)
            branches = [value.strip().strip('\"\'') for value in match[1].split(',')]
            self.assertEqual(branches, expected)
            self.assertNotRegex(event, r'(?m)^    (?:paths|paths-ignore|branches-ignore):')

    def test_only_enabled_main_pushes_or_manual_runs_can_stage(self):
        workflow = WORKFLOW.read_text()
        condition = "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main' && vars.LEASEWEB_FRONTEND_STAGE_ENABLED == 'true'"
        for name in ('Package exactly the tested image pair for staging', 'Prepare pinned SSH host authentication',
                     'Submit the checked image pair to the private inbox'):
            step = workflow.split(f'      - name: {name}\n', 1)[1].split('\n      -', 1)[0]
            self.assertIn('        if: ' + condition + '\n', step)
        for marker in ('      - name: Prepare staging evidence', '      - uses: actions/upload-artifact@'):
            step = workflow.split(marker, 1)[1].split('\n      -', 1)[0]
            self.assertIn('        if: always() && ' + condition + '\n', step)
        self.assertIn('  workflow_dispatch:', workflow)
        self.assertIn('needs: verify', workflow)
        self.assertNotIn('LEASEWEB_FRONTEND_DEPLOY_ENABLED', workflow)
        self.assertIn('secrets.LEASEWEB_STAGE_SSH_KEY', workflow)
        self.assertIn('secrets.LEASEWEB_STAGE_SSH_HOST_KEYS', workflow)
        self.assertEqual(workflow.count('secrets.'), 2)
        self.assertNotIn('git fetch origin main', workflow)
        self.assertNotIn('docker load', workflow)
        self.assertNotIn('scp ', workflow)
        self.assertNotIn('release/leaseweb', workflow)

    def test_node_policy_is_version_controlled_and_images_need_no_application_environment(self):
        workflow = WORKFLOW.read_text()
        dockerfile = DOCKERFILE.read_text()
        self.assertNotIn('vars.CODEX_NODE_IMAGE', workflow)
        self.assertNotIn('vars.CODEX_NEXT_PUBLIC_BUILD_ENV', workflow)
        self.assertEqual(workflow.count('scripts/resolve-node-image.py --github-output'), 1)
        self.assertEqual(workflow.count('NODE_IMAGE: ${{ needs.verify.outputs.node_image }}'), 1)
        self.assertEqual(workflow.count('NODE_VERSION: ${{ needs.verify.outputs.node_version }}'), 1)
        self.assertIn('node-version: ${{ steps.node-base.outputs.node_version }}', workflow)
        for removed in ('config/public-build.env', 'production_env', 'release-public-settings.json'):
            self.assertNotIn(removed, workflow)
            self.assertNotIn(removed, dockerfile)
        self.assertIn('RUN yarn build', dockerfile)
        self.assertIn('LABEL org.codex-christi.release-settings=2', dockerfile)
        self.assertIn('COPY scripts/runtime-config.mjs ./scripts/runtime-config.mjs', dockerfile)
        self.assertEqual(workflow.count('/checks/node-runtime.mjs native'), 1)
        self.assertEqual(workflow.count('--env "EXPECTED_NODE_VERSION=$NODE_VERSION"'), 1)

    def test_exact_built_images_are_tested_then_packaged_without_rebuild(self):
        workflow = WORKFLOW.read_text()
        bake = (DOCKERFILE.parent / 'docker-bake.hcl').read_text()
        self.assertEqual(workflow.count('docker/bake-action@59cb1203cd42bcefd40a1b6d73b589e48c86040e'), 1)
        self.assertIn('source: .', workflow)
        self.assertIn('files: docker-bake.hcl', workflow)
        self.assertIn('builder: default', workflow)
        self.assertIn('targets: default', workflow)
        self.assertIn('load: true', workflow)
        self.assertIn('push: false', workflow)
        self.assertIn('APP_REVISION: ${{ github.sha }}', workflow)
        self.assertNotIn('docker buildx build ', workflow)
        self.assertIn('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"', workflow)
        self.assertIn('test -z "$(git status --porcelain=v1 --untracked-files=normal)"', workflow)
        self.assertIn('targets = ["runtime", "datastore-check"]', bake)
        self.assertIn('platforms  = ["linux/amd64"]', bake)
        self.assertIn('NODE_IMAGE   = NODE_IMAGE', bake)
        self.assertIn('APP_REVISION = APP_REVISION', bake)
        for target, tag in (('runtime', 'codex-christi-next'),
                            ('datastore-check', 'codex-christi-datastore-check')):
            definition = bake.split(f'target "{target}" {{', 1)[1].split('\n}', 1)[0]
            self.assertIn(f'target     = "{target}"', definition)
            self.assertIn('inherits   = ["_shared"]', definition)
            self.assertIn(f'tags       = ["{tag}:${{APP_REVISION}}"]', definition)
        self.assertIn('bash scripts/tests/check-runtime-image-config.sh "$RUNTIME_IMAGE" "$CHECKER_IMAGE"', workflow)
        self.assertEqual(workflow.count('RUNTIME_IMAGE: ${{ steps.build.outputs.runtime_image }}'), 3)
        self.assertEqual(workflow.count('CHECKER_IMAGE: ${{ steps.build.outputs.checker_image }}'), 3)
        self.assertLess(workflow.index('Verify the exact built images offline'),
                        workflow.index('Package exactly the tested image pair for staging'))
        self.assertIn('test "$(docker image inspect --format \'{{.Id}}\' "codex-christi-next:$GITHUB_SHA")" = "$RUNTIME_IMAGE"', workflow)
        self.assertIn('test "$(docker image inspect --format \'{{.Id}}\' "codex-christi-datastore-check:$GITHUB_SHA")" = "$CHECKER_IMAGE"', workflow)
        self.assertIn('docker save "codex-christi-next:$GITHUB_SHA" "codex-christi-datastore-check:$GITHUB_SHA"', workflow)
        checks = RUNTIME_IMAGE_CHECK.read_text()
        self.assertIn('for mode in sandbox live; do', checks)
        self.assertIn('/checks/runtime-config.mjs "$mode"', checks)
        self.assertIn('node "$checker_image" --import tsx /app/scripts/check-checker-image.mjs', checks)
        self.assertTrue(all('--network none --read-only' in line for line in checks.splitlines() if 'docker run ' in line))

    def test_persistent_caches_require_trusted_main_and_supported_runner(self):
        workflow = WORKFLOW.read_text()
        bake = (DOCKERFILE.parent / 'docker-bake.hcl').read_text()
        condition = "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main' && inputs.cold_build != true"
        self.assertIn('cache: ${{ ' + condition + " && 'yarn' || '' }}", workflow)
        self.assertIn('package-manager-cache: false', workflow)
        self.assertIn('cache-dependency-path: yarn.lock', workflow)
        self.assertIn('CACHE_REQUESTED: ${{ ' + condition + ' }}', workflow)
        self.assertIn('cache_enabled=false', workflow)
        self.assertIn('[[ "$CACHE_REQUESTED" == true ]]', workflow)
        self.assertIn('driver-type io.containerd.snapshotter.v1', workflow)
        self.assertIn('TRUSTED_BUILDKIT_CACHE: ${{ steps.prepare-build.outputs.trusted_cache }}', workflow)
        self.assertIn('default = false', bake)
        for target, scope in (('runtime', 'runtime'), ('datastore-check', 'checker')):
            definition = bake.split(f'target "{target}" {{', 1)[1].split('\n}', 1)[0]
            self.assertEqual(definition.count('TRUSTED_BUILDKIT_CACHE ? ["type=gha,version=2,'), 2)
            self.assertEqual(definition.count(f'scope=codex-christi-frontend-{scope}-amd64-v1,'), 2)
            self.assertEqual(definition.count('] : []'), 2)
            self.assertIn('mode=max,ignore-error=true,timeout=90s', definition)
        self.assertNotIn('cache-to=', workflow)
        self.assertNotIn('ACTIONS_RUNTIME_TOKEN', workflow)
        self.assertIn("permissions:\n  contents: read\n", workflow)
        self.assertEqual(workflow.count('secrets.'), 2)
        self.assertIn("DOCKER_BUILD_RECORD_UPLOAD: 'false'", workflow)
        for action in re.findall(r'(?m)^\s*(?:- )?uses: (\S+)', workflow):
            self.assertRegex(action, r'^[^@]+@[0-9a-f]{40}$')

    def test_cache_capability_gate_falls_back_without_a_daemon_configuration_change(self):
        workflow = WORKFLOW.read_text()
        body = workflow.split('      - name: Qualify the exact base and select the supported cache mode\n', 1)[1]
        body = body.split('        run: |\n', 1)[1].split('\n      - name:', 1)[0]
        script = '\n'.join(line[10:] for line in body.splitlines()) + '\n'
        with tempfile.TemporaryDirectory(prefix='codex-cache-gate-fixture-') as folder:
            root = Path(folder)
            git = root / 'git'
            git.write_text("""#!/usr/bin/env python3
import os, sys
if sys.argv[1:] == ['rev-parse', 'HEAD']: print(os.environ['GITHUB_SHA'])
elif sys.argv[1] != 'status': raise SystemExit(1)
""")
            docker = root / 'docker'
            docker.write_text("""#!/usr/bin/env python3
import os, pathlib, sys
a = sys.argv[1:]
with pathlib.Path(os.environ['CALLS']).open('a') as f: f.write(a[0] + '\\n')
if a[0] == 'pull': pass
elif a[0] == 'run': print(os.environ['NODE_VERSION'] + ' linux/x64')
elif a[0] == 'version':
    if os.environ['ENGINE'] == 'unavailable': raise SystemExit(1)
    print(os.environ['ENGINE'])
elif a[:2] == ['buildx', 'version']: print('github.com/docker/buildx ' + os.environ['BUILDX'])
elif a[0] == 'info': print(os.environ['DRIVER'])
else: raise SystemExit(1)
""")
            git.chmod(0o700)
            docker.chmod(0o700)
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                       CALLS=str(root / 'calls'), GITHUB_OUTPUT=str(root / 'outputs'),
                       GITHUB_SHA='a' * 40, NODE_VERSION='26.13.1', NODE_IMAGE='docker.io/library/node@sha256:' + 'a' * 64)
            containerd = 'driver-type io.containerd.snapshotter.v1'
            cases = [
                ('true', '28.0.1', 'v0.21.0', containerd, True),
                ('true', '30.0.1', 'v0.32.0', containerd, True),
                ('true', '27.9.9', 'v0.32.0', containerd, False),
                ('true', '30.0.1', 'v0.20.9', containerd, False),
                ('true', '30.0.1', 'v0.32.0', 'Backing Filesystem extfs', False),
                ('true', 'unavailable', 'v0.32.0', containerd, False),
                ('false', '30.0.1', 'v0.32.0', containerd, False),
            ]
            for request, engine, buildx, driver, enabled in cases:
                with self.subTest(request=request, engine=engine, buildx=buildx, driver=driver):
                    (root / 'calls').write_text('')
                    (root / 'outputs').write_text('')
                    result = subprocess.run(['bash', '-c', script], env={**env, 'CACHE_REQUESTED': request,
                                            'ENGINE': engine, 'BUILDX': buildx, 'DRIVER': driver},
                                            capture_output=True, text=True, timeout=15)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    outputs = dict(line.split('=', 1) for line in (root / 'outputs').read_text().splitlines())
                    self.assertEqual(outputs['trusted_cache'], str(enabled).lower())
                    self.assertRegex(outputs['base_elapsed_s'], r'^\d+$')
                    self.assertRegex(outputs['bake_started_s'], r'^\d+$')
                    calls = (root / 'calls').read_text().splitlines()
                    self.assertEqual(calls[:2], ['pull', 'run'])
                    if request == 'false':
                        self.assertEqual(calls, ['pull', 'run'])

    def test_bake_resolves_exact_local_targets_and_optional_cache_without_daemon(self):
        docker = shutil.which('docker')
        if docker is None:
            self.skipTest('Docker CLI unavailable; Bake print requires no daemon.')
        with tempfile.TemporaryDirectory(prefix='codex-bake-print-test-') as folder:
            root = Path(folder)
            plugins = Path('/Applications/Docker.app/Contents/Resources/cli-plugins')
            if (plugins / 'docker-buildx').is_file():
                (root / 'config.json').write_text(json.dumps({'cliPluginsExtraDirs': [str(plugins)]}))
            node = 'docker.io/library/node@sha256:' + 'a' * 64
            revision = 'b' * 40
            env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'DOCKER_CONFIG': str(root),
                   'DOCKER_HOST': 'unix://' + str(root / 'no-daemon.sock'),
                   'NODE_IMAGE': node, 'APP_REVISION': revision}
            version = subprocess.run([docker, 'buildx', 'version'], env=env,
                                     capture_output=True, text=True, timeout=20)
            if version.returncode:
                self.skipTest('Docker Buildx CLI plugin unavailable; no daemon is needed.')
            for cache in ('false', 'true'):
                result = subprocess.run([docker, 'buildx', 'bake', '--print', '--load', '--file', 'docker-bake.hcl', 'default'],
                                        cwd=DOCKERFILE.parent, env={**env, 'TRUSTED_BUILDKIT_CACHE': cache},
                                        capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, 0, result.stderr)
                model = json.loads(result.stdout)
                self.assertEqual(set(model['group']['default']['targets']), {'runtime', 'datastore-check'})
                self.assertEqual(set(model['target']), {'runtime', 'datastore-check'})
                for key, image, scope in (('runtime', 'codex-christi-next', 'runtime'),
                                          ('datastore-check', 'codex-christi-datastore-check', 'checker')):
                    target = model['target'][key]
                    self.assertEqual(target['context'], '.')
                    self.assertEqual(target['dockerfile'], 'Dockerfile')
                    self.assertEqual(target['args'], {'NODE_IMAGE': node, 'APP_REVISION': revision})
                    self.assertEqual(target['platforms'], ['linux/amd64'])
                    self.assertEqual(target['target'], key)
                    self.assertEqual(target['tags'], [f'{image}:{revision}'])
                    self.assertEqual(target['output'], [{'type': 'docker'}])
                    self.assertFalse(target.get('secret'))
                    self.assertFalse(target.get('ssh'))
                    for direction in ('cache-from', 'cache-to'):
                        if cache == 'true':
                            self.assertEqual(len(target[direction]), 1)
                            record = target[direction][0]
                            self.assertEqual(record['scope'], f'codex-christi-frontend-{scope}-amd64-v1')
                            self.assertEqual(record['type'], 'gha')
                            self.assertEqual(record['version'], '2')
                        else:
                            self.assertFalse(target.get(direction))

    def test_no_production_source_uses_static_next_public_environment_lookups(self):
        root = DOCKERFILE.parent
        static_lookup = re.compile(r"\bprocess\s*\.\s*env\s*(?:\.\s*NEXT_PUBLIC_\w+|\[\s*['\"]NEXT_PUBLIC_\w+['\"]\s*\])")
        paths = [root / 'next.config.mjs', *(root / 'src').rglob('*')]
        offenders = []
        for path in paths:
            if (path.suffix not in ('.ts', '.tsx', '.js', '.jsx', '.mjs') or not path.is_file()
                    or 'generated' in path.parts or re.search(r'\.(?:test|spec)\.', path.name)):
                continue
            if static_lookup.search(path.read_text()):
                offenders.append(str(path.relative_to(root)))
        self.assertEqual(offenders, [], 'Static browser build lookups must be replaced with runtime configuration.')
        self.assertIn('config/public-build.env', (root / '.dockerignore').read_text())
        self.assertIn('/config/public-build.env', (root / '.gitignore').read_text())

    def test_stage_transmits_only_fixed_request_and_checks_receipt(self):
        workflow = WORKFLOW.read_text()
        body = workflow.split('      - name: Submit the checked image pair to the private inbox\n', 1)[1]
        body = body.split('        run: |\n', 1)[1].split('\n      - name:', 1)[0]
        script = '\n'.join(line[10:] for line in body.splitlines()) + '\n'
        with tempfile.TemporaryDirectory(prefix='codex-workflow-stage-fixture-') as folder:
            root = Path(folder)
            artifact = b'synthetic archive bytes\n'
            (root / 'frontend-release.tar.gz').write_bytes(artifact)
            revision = 'a' * 40
            digest = hashlib.sha256(artifact).hexdigest()
            stub = root / 'ssh'
            stub.write_text('''#!/usr/bin/env python3
import hashlib, os, sys
data = sys.stdin.buffer.read()
args = sys.argv[1:]
revision = os.environ['GITHUB_SHA']
digest = hashlib.sha256(data).hexdigest()
assert args[-2] == 'codex-christi-frontend-deploy@216.22.53.127'
assert args[-1] == f'stage {revision} {len(data)} {digest}'
assert 'StrictHostKeyChecking=yes' in args and 'IdentityAgent=none' in args
print('wrong-receipt' if os.environ['BAD_RECEIPT'] == '1' else f'CODEX_RELEASE_STAGED=frontend:{revision}:{digest}:{len(data)}')
''')
            stub.chmod(0o700)
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                       RUNNER_TEMP=str(root), GITHUB_SHA=revision, VPS_USER='codex-christi-frontend-deploy',
                       VPS_HOST='216.22.53.127', BAD_RECEIPT='0', GITHUB_OUTPUT=str(root / 'outputs'))
            result = subprocess.run(['bash', '-c', script], env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root / 'frontend-stage-receipt').read_text(),
                             f'CODEX_RELEASE_STAGED=frontend:{revision}:{digest}:{len(artifact)}\n')
            self.assertRegex((root / 'outputs').read_text(), r'archive_hash_s=\d+\ntransfer_and_receipt_s=\d+\n')
            (root / 'frontend-stage-receipt').unlink()
            env['BAD_RECEIPT'] = '1'
            result = subprocess.run(['bash', '-c', script], env=env, capture_output=True, text=True, timeout=15)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((root / 'frontend-stage-receipt').exists())

    def test_staging_proof_never_claims_deployment(self):
        body = WORKFLOW.read_text().split('      - name: Prepare staging evidence\n', 1)[1]
        body = body.split('        run: |\n', 1)[1].split('\n      - uses:', 1)[0]
        script = '\n'.join(line[10:] for line in body.splitlines()) + '\n'
        with tempfile.TemporaryDirectory(prefix='codex-stage-proof-fixture-') as folder:
            root = Path(folder)
            receipt = root / 'frontend-stage-receipt'
            revision, digest = 'a' * 40, 'b' * 64
            valid = f'CODEX_RELEASE_STAGED=frontend:{revision}:{digest}:10\n'
            env = dict(os.environ, RUNNER_TEMP=folder, GITHUB_SHA=revision, GITHUB_SERVER_URL='https://github.com',
                       GITHUB_REPOSITORY='fixture/frontend', GITHUB_RUN_ID='1', GITHUB_RUN_ATTEMPT='2',
                       NODE_IMAGE='docker.io/library/node@sha256:' + 'a' * 64, NODE_VERSION='26.13.1',
                       RUNTIME_IMAGE=NEW, CHECKER_IMAGE=CHECK)
            for raw, outcome, image_outcome, staged in ((valid, 'success', 'success', True),
                                                       (valid, 'failure', 'success', False),
                                                       (valid + '\n', 'success', 'success', False),
                                                       (valid, 'success', 'failure', False)):
                receipt.write_text(raw)
                result = subprocess.run(['bash', '-c', script], cwd=root, env={**env, 'STAGE_OUTCOME': outcome,
                                        'IMAGE_CHECK_OUTCOME': image_outcome},
                                        capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr)
                proof = json.loads((root / 'staging-proof' / 'proof.json').read_text())
                self.assertEqual(proof['staged'], staged)
                self.assertFalse(proof['deployment_verified'])
                self.assertEqual(proof['run_attempt'], '2')
                self.assertEqual(proof['node_image'], env['NODE_IMAGE'])
                self.assertEqual(proof['node_version'], env['NODE_VERSION'])
                self.assertEqual('sha256' in proof, staged)
                self.assertEqual(proof['images_verified'], image_outcome == 'success')
                self.assertEqual(proof.get('runtime_image'), NEW if image_outcome == 'success' else None)
                self.assertEqual(proof.get('checker_image'), CHECK if image_outcome == 'success' else None)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='codex-release-test-')
        self.root = Path(self.temp.name)
        self.repo = self.root / 'frontend'
        self.repo.mkdir()
        (self.repo / 'devScripts').mkdir()
        shutil.copyfile(SOURCE, self.repo / 'devScripts' / 'production.sh')
        (self.repo / '.gitignore').write_text('.deploy/\n.env.production\n')
        (self.repo / 'docker-compose.yml').write_text('name: codex-christi-frontend\nservices: {}\n')
        self.git('init', '-q')
        self.git('config', 'user.email', 'release-fixture@example.invalid')
        self.git('config', 'user.name', 'Release Fixture')
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        self.revision = self.git('rev-parse', 'HEAD').stdout.strip()
        (self.repo / '.env.production').write_text('PRIVATE_FIXTURE=unused\n')
        deploy = self.repo / '.deploy'
        deploy.mkdir()
        self.old_manifest = f'DEPLOY_REVISION={OLD_REV}\nDEPLOY_IMAGE={OLD}\nDATASTORE_CHECK_IMAGE={OLD_CHECK}\n'
        (deploy / 'current.env').write_text(self.old_manifest)
        (deploy / 'current-compose.yml').write_text('name: prior-fixture\nservices: {}\n')
        (deploy / 'current-runtime.env').write_text('PRIVATE_FIXTURE=previous\n')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.executable('docker', FAKE_DOCKER)
        # CI uses real GNU flock and timeout. macOS fixtures only need commands to
        # exist: release behavior is tested separately from those system tools.
        self.executable('flock', r'''#!/usr/bin/env python3
import fcntl, sys
try:
    fcntl.flock(int(sys.argv[-1]), fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(1)
''')
        self.executable('timeout', '#!/bin/sh\nshift 3\nexec "$@"\n')
        self.proxy = self.root / 'reload.sh'
        self.proxy.write_text(FAKE_PROXY)
        self.proxy.chmod(0o700)
        self.state = self.root / 'fixture.json'
        self.state.write_text(json.dumps({'mode':'success','old':OLD,'new':NEW,'check':CHECK,
            'old_revision':OLD_REV,'new_revision':self.revision,'current':OLD}))
        self.env = {**os.environ, 'PATH':str(self.bin)+os.pathsep+os.environ['PATH'],
            'APP_DIR':str(self.repo),'PROXY_RELOAD_SCRIPT':str(self.proxy),
            'DEPLOY_REVISION':self.revision,'DEPLOY_IMAGE':NEW,'DATASTORE_CHECK_IMAGE':CHECK,
            'RELEASE_FIXTURE':str(self.state), 'PROJECT_RELEASE_LOCK':str(self.root/'project-release.lock')}
        self.env.pop('DEPLOYMENT_LOCK_FD', None)

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.repo, text=True, capture_output=True, check=True)

    def executable(self, name, content):
        path=self.bin/name
        path.write_text(content)
        path.chmod(0o700)

    def run_release(self, mode='success', *args):
        state=json.loads(self.state.read_text()); state['mode']=mode; self.state.write_text(json.dumps(state))
        result=subprocess.run(['bash', str(self.repo/'devScripts'/'production.sh'), *args], env=self.env,
                              cwd=self.repo, text=True, capture_output=True)
        self.calls=[json.loads(s) for s in self.state.with_suffix('.calls').read_text().splitlines()] if self.state.with_suffix('.calls').exists() else []
        self.assertNotIn('PRIVATE_FIXTURE', result.stdout+result.stderr)
        self.assertFalse(any(set(c['args']) & {'prune','migrate','db','down','--remove-orphans'} for c in self.calls))
        return result

    def test_success_records_exact_release_and_config(self):
        result=self.run_release()
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn(f'Release {self.revision} is healthy.',result.stdout)
        self.assertIn(f'DEPLOY_IMAGE={NEW}',(self.repo/'.deploy/current.env').read_text())
        self.assertEqual((self.repo/'.deploy/current-runtime.env').read_text(),'PRIVATE_FIXTURE=unused\n')
        self.assertEqual(json.loads(self.state.read_text())['current'],NEW)
        checks=[c for c in self.calls if 'run' in c['args']]
        ups=[c for c in self.calls if 'up' in c['args']]
        self.assertEqual([call['args'][-1] for call in checks],['release-settings-check','datastore-check'])
        self.assertEqual(len(ups),1)
        self.assertLess(self.calls.index(checks[0]),self.calls.index(ups[0]))

    def test_settings_mismatch_stops_before_datastore_or_app_replacement(self):
        result=self.run_release('settings_failure')
        self.assertNotEqual(result.returncode,0)
        self.assertEqual([call['args'][-1] for call in self.calls if 'run' in call['args']],['release-settings-check'])
        self.assertFalse(any('up' in call['args'] for call in self.calls))
        self.assertEqual(json.loads(self.state.read_text())['current'],OLD)
        self.assertEqual((self.repo/'.deploy/current.env').read_text(),self.old_manifest)

    def test_failed_oneoff_cleanup_removes_only_the_matching_owned_settings_container(self):
        for mode in ('settings_failure_retained','settings_foreign_retained'):
            with self.subTest(mode=mode):
                result=self.run_release(mode)
                self.assertNotEqual(result.returncode,0)
                removals=[call for call in self.calls if call['args'][:2]==['container','rm']]
                self.assertEqual(len(removals),1 if mode=='settings_failure_retained' else 0)
                self.assertFalse(any('up' in call['args'] or call['args'][-1:] == ['datastore-check'] for call in self.calls))
                self.assertEqual(json.loads(self.state.read_text())['current'],OLD)
                # Each subcase needs a fresh call log and retained-container state.
                self.state.with_suffix('.calls').unlink()
                state=json.loads(self.state.read_text()); state['checks']={}; self.state.write_text(json.dumps(state))

    def test_preexisting_oneoff_name_is_preserved_without_start_or_cleanup(self):
        result=self.run_release('settings_collision')
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(any('run' in call['args'] or call['args'][:2]==['container','rm'] for call in self.calls))

    def test_ordinary_release_cannot_skip_settings_by_omitting_the_image_feature_label(self):
        for mode in ('missing_settings_label', 'compiled_settings_label'):
            with self.subTest(mode=mode):
                result=self.run_release(mode)
                self.assertNotEqual(result.returncode,0)
                self.assertFalse(any('run' in call['args'] or 'up' in call['args'] for call in self.calls))

    def test_neon_failure_keeps_current_service(self):
        result=self.run_release('database_failure')
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(any('up' in c['args'] for c in self.calls))
        self.assertEqual(json.loads(self.state.read_text())['current'],OLD)
        self.assertEqual((self.repo/'.deploy/current.env').read_text(),self.old_manifest)

    def test_app_failure_recovers_prior_image_and_runtime_env(self):
        result=self.run_release('app_failure')
        self.assertNotEqual(result.returncode,0)
        ups=[c for c in self.calls if 'up' in c['args']]
        self.assertEqual([c['image'] for c in ups],[NEW,OLD])
        self.assertTrue(ups[-1]['runtime_env'].endswith('/previous-runtime.env'))
        self.assertEqual(json.loads(self.state.read_text())['current'],OLD)
        self.assertEqual((self.repo/'.deploy/current.env').read_text(),self.old_manifest)

    def test_proxy_failure_recovers_prior_image(self):
        result=self.run_release('proxy_failure')
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(json.loads(self.state.read_text())['current'],OLD)
        self.assertIn('Previous frontend release recovered.',result.stderr)

    def test_foreign_container_never_replaced(self):
        result=self.run_release('foreign')
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(any('up' in c['args'] for c in self.calls))

    def test_mismatched_image_never_replaced(self):
        result=self.run_release('wrong_image_label')
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(any('up' in c['args'] for c in self.calls))

    def test_wrong_platform_never_replaced(self):
        result=self.run_release('wrong_platform')
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(any('up' in c['args'] for c in self.calls))

    def test_manifest_mismatch_stops_before_datastore_or_replacement(self):
        path=self.repo/'.deploy/current.env'
        path.write_text(path.read_text().replace(OLD,NEW))
        result=self.run_release()
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(any('up' in c['args'] or 'run' in c['args'] for c in self.calls))

    def test_failed_recovery_does_not_report_success(self):
        result=self.run_release('recovery_failure')
        self.assertNotEqual(result.returncode,0)
        self.assertNotIn('is healthy.',result.stdout)
        self.assertIn('Automatic frontend recovery did not pass',result.stderr)
        self.assertEqual(len([c for c in self.calls if 'up' in c['args']]),2)

    def test_failed_state_update_triggers_recovery_without_success_claim(self):
        (self.repo/'.deploy/current.env.tmp').mkdir()
        result=self.run_release()
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(json.loads(self.state.read_text())['current'],OLD)
        self.assertNotIn('is healthy.',result.stdout)
        self.assertIn('Automatic frontend recovery did not pass',result.stderr)

    def test_shared_project_lock_blocks_release_before_any_docker_command(self):
        with (self.root/'project-release.lock').open('a+') as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            result=self.run_release()
        self.assertNotEqual(result.returncode,0)
        self.assertIn('shared project lock',result.stderr)
        self.assertEqual(self.calls,[])
        self.assertEqual(json.loads(self.state.read_text())['current'],OLD)

    def test_dirty_repository_stops_before_docker(self):
        (self.repo/'unexpected-feature.ts').write_text('export const pending = true;\n')
        result=self.run_release()
        self.assertNotEqual(result.returncode,0)
        self.assertIn('uncommitted',result.stderr)
        self.assertEqual(self.calls,[])

    def test_manual_rollback_uses_prior_checkpoint(self):
        result=self.run_release()
        self.assertEqual(result.returncode,0,result.stderr)
        checkpoint=next((self.repo/'.deploy/checkpoints').iterdir())
        result=self.run_release('success','--rollback',str(checkpoint))
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(json.loads(self.state.read_text())['current'],OLD)
        self.assertEqual((self.repo/'.deploy/current.env').read_text(),self.old_manifest)
        self.assertEqual((self.repo/'.deploy/current-runtime.env').read_text(),'PRIVATE_FIXTURE=previous\n')

    def test_modern_manual_rollback_checks_settings_and_stops_on_mismatch(self):
        result=self.run_release()
        self.assertEqual(result.returncode,0,result.stderr)
        checkpoint=next((self.repo/'.deploy/checkpoints').iterdir())
        state=json.loads(self.state.read_text()); state['modern_old']=True; self.state.write_text(json.dumps(state))
        self.state.with_suffix('.calls').unlink()
        result=self.run_release('settings_failure','--rollback',str(checkpoint))
        self.assertNotEqual(result.returncode,0)
        self.assertEqual([call['args'][-1] for call in self.calls if 'run' in call['args']],['release-settings-check'])
        self.assertFalse(any('up' in call['args'] for call in self.calls))
        self.assertEqual(json.loads(self.state.read_text())['current'],NEW)


if __name__ == '__main__':
    unittest.main()
