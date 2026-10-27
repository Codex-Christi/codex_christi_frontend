import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('deployment verification runs the auth suite before the deploy job', () => {
  const root = new URL('../../../', import.meta.url);
  const { scripts } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.match(scripts['test:auth'], /--conditions=react-server/);
  assert.match(scripts['test:auth'], /src\/lib\/auth\/\*\.test\.ts/);
  assert.match(scripts['test:auth'], /src\/lib\/session\/\*\.test\.ts/);
  const workflow = readFileSync(new URL('.github/workflows/push-to-main.yml', root), 'utf8');
  const [verify, deploy] = workflow.split(/^  deploy:/m);
  assert.match(verify, /run: yarn test:auth/);
  assert.match(deploy, /needs: verify/);
});
