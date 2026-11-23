"""Exercise the base-image resolver with registry/runtime fixtures only."""

import importlib.util
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('resolve_node_image', ROOT / 'scripts/resolve-node-image.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
FIXTURE = 'sha256:' + 'a' * 64
DOCKERFILE = 'ARG NODE_IMAGE=node:26-bookworm-slim\nFROM ${NODE_IMAGE}\nARG NODE_IMAGE\n'
OCI_INDEX = 'application/vnd.oci.image.index.v1+json'
OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json'
DOCKER_INDEX = 'application/vnd.docker.distribution.manifest.list.v2+json'
DOCKER_MANIFEST = 'application/vnd.docker.distribution.manifest.v2+json'


def descriptor(architecture='amd64', **fields):
    return {'mediaType': OCI_MANIFEST, 'digest': FIXTURE,
            'platform': {'os': 'linux', 'architecture': architecture}, **fields}


def index(*entries, media_type=OCI_INDEX):
    return {'schemaVersion': 2, 'mediaType': media_type, 'manifests': list(entries)}


def identity(**fields):
    return {'version': '26.14.2', 'platform': 'linux', 'arch': 'x64',
            'osRelease': 'ID=debian\nVERSION_CODENAME=bookworm\n', **fields}


class ResolverTests(unittest.TestCase):
    def test_current_policy_and_image_labels(self):
        source = (ROOT / 'Dockerfile').read_text()
        self.assertEqual(MODULE.read_policy(source), ('node:26-bookworm-slim', '26'))
        self.assertEqual(source.count('LABEL org.codex-christi.node.base=${NODE_IMAGE}'), 2)

    def test_single_official_major_policy_is_required(self):
        for source in ('ARG NODE_IMAGE=node:lts-bookworm-slim\nFROM ${NODE_IMAGE}',
                       'ARG NODE_IMAGE=node:26-alpine\nFROM ${NODE_IMAGE}',
                       'ARG NODE_IMAGE=node:26.13.1-bookworm-slim\nFROM ${NODE_IMAGE}',
                       'ARG NODE_IMAGE=example.com/node:26-bookworm-slim\nFROM ${NODE_IMAGE}',
                       'FROM scratch\nARG NODE_IMAGE=node:26-bookworm-slim',
                       DOCKERFILE + 'ARG NODE_IMAGE=node:28-bookworm-slim\n'):
            with self.subTest(source=source), self.assertRaises(ValueError):
                MODULE.read_policy(source)

    def test_unique_amd64_manifest_is_selected(self):
        self.assertEqual(MODULE.select_amd64_digest(index(descriptor('arm64'), descriptor())), FIXTURE)
        self.assertEqual(MODULE.select_amd64_digest(index(descriptor(mediaType=DOCKER_MANIFEST), media_type=DOCKER_INDEX)), FIXTURE)

    def test_unexpected_and_ambiguous_manifests_are_rejected(self):
        for value in ({'schemaVersion': 2, 'mediaType': OCI_MANIFEST},
                      index(descriptor('arm64')), index(descriptor(), descriptor()),
                      index(descriptor(digest='sha256:invalid')),
                      index(descriptor(mediaType='application/json')),
                      index(descriptor(platform={'os': 'linux', 'architecture': 'amd64', 'variant': 'v3'}))):
            with self.subTest(value=value), self.assertRaises(ValueError):
                MODULE.select_amd64_digest(value)

    def fixture_runner(self, runtime):
        calls = []

        def run(*args):
            calls.append(args)
            if args[1:5] == ('buildx', 'imagetools', 'inspect', '--raw'):
                return json.dumps(index(descriptor())).encode()
            if args[1] == 'pull':
                return b''
            if args[1] == 'run':
                return json.dumps(runtime).encode()
            raise AssertionError('Unexpected command')

        return run, calls

    def test_resolves_moving_tag_once_and_verifies_only_the_selected_digest(self):
        runner, calls = self.fixture_runner(identity())
        resolved, version = MODULE.resolve(DOCKERFILE, run=runner)
        self.assertEqual(resolved, 'docker.io/library/node@' + FIXTURE)
        self.assertEqual(version, '26.14.2')
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[0][-1], 'docker.io/library/node:26-bookworm-slim')
        self.assertEqual(calls[1][-1], resolved)
        self.assertIn(resolved, calls[2])
        self.assertIn('--network', calls[2])
        self.assertIn('never', calls[2])

    def test_rejects_runtime_identity_drift(self):
        for value in (identity(version='28.0.0'), identity(version='26.14.2-rc.1'),
                      identity(arch='arm64'), identity(platform='darwin'),
                      identity(osRelease='ID=debian\nVERSION_CODENAME=trixie\n'),
                      identity(osRelease='ID=ubuntu\nVERSION_CODENAME=bookworm\n')):
            runner, _ = self.fixture_runner(value)
            with self.subTest(value=value), self.assertRaises(ValueError):
                MODULE.resolve(DOCKERFILE, run=runner)


if __name__ == '__main__':
    unittest.main()
