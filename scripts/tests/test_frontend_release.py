"""Exercise the release script against a fake Docker daemon and real Git checkout.

No network, Docker daemon, real database, SSH account or production file is used.
"""
import fcntl
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
            print('1' if (image==s['new'] and s['mode']!='missing_settings_label') or (image==s['old'] and s.get('modern_old')) else '')
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

    def test_only_enabled_main_pushes_can_deploy_and_remote_fetch_agrees(self):
        workflow = WORKFLOW.read_text()
        condition = re.search(r'^    if: (.+)$', workflow, re.MULTILINE)[1]
        comparisons = []
        for clause in condition.split('&&'):
            match = re.fullmatch(r"\s*(github\.event_name|github\.ref|vars\.LEASEWEB_FRONTEND_DEPLOY_ENABLED)\s*==\s*'([^']*)'\s*", clause)
            self.assertIsNotNone(match, 'The deployment condition needs explicit policy review.')
            comparisons.append(match.groups())
        self.assertEqual(len(comparisons), 3)
        for event, ref, gate, expected in (
                ('push', 'refs/heads/main', 'true', True),
                ('push', 'refs/heads/main', '', False),
                ('push', 'refs/heads/main', 'false', False),
                ('push', 'refs/heads/review/leaseweb', 'true', False),
                ('push', 'refs/tags/main', 'true', False),
                ('pull_request', 'refs/heads/main', 'true', False)):
            values = {'github.event_name': event, 'github.ref': ref,
                      'vars.LEASEWEB_FRONTEND_DEPLOY_ENABLED': gate}
            self.assertEqual(all(values[key] == value for key, value in comparisons), expected)
        self.assertIn('git fetch origin main >', workflow)
        self.assertNotIn('release/leaseweb', workflow)


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
        result=self.run_release('missing_settings_label')
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
