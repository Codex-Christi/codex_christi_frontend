import assert from 'node:assert/strict';
import test from 'node:test';
import { deferred } from '@/lib/cart/test-support';
import { readCheckoutStatus } from './readCheckoutStatus';

test('status recovery reads only its original order and preserves access responses', async () => {
  const result = await readCheckoutStatus('original', {
    request: async (url, init) => {
      assert.equal(url, '/next-api/paypal/tx-ledger/payments/original/status');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.method, undefined);
      return Response.json({ orderToken: 'original', status: 'captured' });
    },
  });
  assert.equal(result.data?.status, 'captured');
  assert.deepEqual(
    await readCheckoutStatus('original', {
      request: async () => new Response(null, { status: 403 }),
    }),
    { status: 403, data: null },
  );
  await assert.rejects(
    readCheckoutStatus('original', { request: async () => Response.json({ orderToken: 'other' }) }),
    /mismatch/,
  );
});

test('a stalled status body releases recovery controls without changing payment', async () => {
  const body = deferred<unknown>();
  await assert.rejects(
    readCheckoutStatus('original', {
      timeoutMs: 5,
      request: async () => ({ ok: true, status: 200, json: () => body.promise }) as Response,
    }),
    /taking too long/,
  );
  body.resolve({ orderToken: 'original', status: 'captured' });
});
