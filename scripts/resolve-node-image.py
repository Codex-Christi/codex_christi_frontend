#!/usr/bin/env python3
"""Resolve the Dockerfile's Node policy once for CI's linux/amd64 builds."""

import argparse
import json
import re
import subprocess
from pathlib import Path


INDEX_TYPES = {
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
}
MANIFEST_TYPES = {
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.docker.distribution.manifest.v2+json',
}
DIGEST = re.compile(r'sha256:[0-9a-f]{64}')
POLICY = re.compile(r'node:([1-9][0-9]{0,2})-bookworm-slim')
VERSION = re.compile(r'([1-9][0-9]{0,2})\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)')


def read_policy(source):
    """Require one explicit official Node major tag, before the first FROM."""
    values = re.findall(r'^ARG[ \t]+NODE_IMAGE[ \t]*=[ \t]*([^\s]+)[ \t]*$', source, re.M)
    if len(values) != 1 or not (match := POLICY.fullmatch(values[0])):
        raise ValueError('Expected one official Node major/bookworm-slim policy in the Dockerfile.')
    globals_only = re.split(r'^FROM\b', source, maxsplit=1, flags=re.M)[0]
    if not re.search(r'^ARG[ \t]+NODE_IMAGE[ \t]*=[ \t]*' + re.escape(values[0]) + r'[ \t]*$', globals_only, re.M):
        raise ValueError('The Node image policy must be declared before the first FROM.')
    return values[0], match[1]


def select_amd64_digest(index):
    """Reject a missing, duplicate, or unexpected amd64 image descriptor."""
    if (not isinstance(index, dict) or index.get('schemaVersion') != 2
            or index.get('mediaType') not in INDEX_TYPES or not isinstance(index.get('manifests'), list)):
        raise ValueError('Expected the official Node multi-platform manifest index.')
    candidates = [entry for entry in index['manifests'] if isinstance(entry, dict)
                  and isinstance(entry.get('platform'), dict)
                  and entry['platform'].get('os') == 'linux'
                  and entry['platform'].get('architecture') == 'amd64']
    if len(candidates) != 1:
        raise ValueError('Expected exactly one linux/amd64 Node image manifest.')
    entry = candidates[0]
    digest = entry.get('digest', '')
    if (entry.get('mediaType') not in MANIFEST_TYPES or not isinstance(digest, str)
            or not DIGEST.fullmatch(digest) or entry['platform'].get('variant', '') not in ('', 'v1')):
        raise ValueError('Unexpected linux/amd64 Node manifest descriptor.')
    return digest


def command(*args):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, timeout=180).stdout


def resolve(dockerfile, run=command):
    tag, major = read_policy(dockerfile)
    raw = run('docker', 'buildx', 'imagetools', 'inspect', '--raw', f'docker.io/library/{tag}')
    digest = select_amd64_digest(json.loads(raw))
    image = f'docker.io/library/node@{digest}'
    run('docker', 'pull', '--platform', 'linux/amd64', image)
    identity = json.loads(run(
        'docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only',
        '--platform', 'linux/amd64', '--entrypoint', 'node', image, '-e',
        'const fs=require("node:fs");'
        'console.log(JSON.stringify({version:process.versions.node,platform:process.platform,'
        'arch:process.arch,osRelease:fs.readFileSync("/etc/os-release","utf8")}))',
    ))
    if not isinstance(identity, dict) or set(identity) != {'version', 'platform', 'arch', 'osRelease'}:
        raise ValueError('Unexpected Node image identity.')
    version = identity['version']
    match = VERSION.fullmatch(version) if isinstance(version, str) else None
    os_release = identity['osRelease']
    if (not match or match[1] != major or identity['platform'] != 'linux' or identity['arch'] != 'x64'
            or not isinstance(os_release, str)
            or not re.search(r'^ID=(?:debian|"debian")$', os_release, re.M)
            or not re.search(r'^VERSION_CODENAME=(?:bookworm|"bookworm")$', os_release, re.M)):
        raise ValueError('Resolved image does not run the approved Node major on Debian Bookworm linux/amd64.')
    return image, version


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dockerfile', type=Path, default=Path('Dockerfile'))
    parser.add_argument('--github-output', type=Path, required=True)
    args = parser.parse_args()
    try:
        image, version = resolve(args.dockerfile.read_text(encoding='utf-8'))
        with args.github_output.open('a', encoding='utf-8') as output:
            output.write(f'node_image={image}\nnode_version={version}\n')
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        parser.exit(1, f'Node image resolution failed: {error}\n')
    print(f'Qualified Node {version}, linux/amd64, Debian Bookworm: {image}')


if __name__ == '__main__':
    main()
