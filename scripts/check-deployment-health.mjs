import { pathToFileURL } from 'node:url';

export async function checkDeploymentHealth({
  url = 'http://127.0.0.1:3000/api/health/ready',
  revision = process.env.APP_REVISION,
  timeoutMs = 3000,
} = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
  if (!response.ok) throw new Error(`Readiness returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body?.status !== 'ready' || (revision && body.revision !== revision)) {
    throw new Error('The expected application release is not ready.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void checkDeploymentHealth().catch(() => {
    console.error('Application readiness check failed.');
    process.exitCode = 1;
  });
}
