import assert from 'node:assert/strict';
import test from 'node:test';
import { deferred } from '@/lib/cart/test-support';
import { boundedCheckoutRequest, CheckoutRequestTimeoutError } from './boundedCheckoutRequest';

test('a hanging operation settles at its deadline even when it ignores abort', async () => {
  const gate = deferred<string>();
  let signal: AbortSignal | undefined;
  const work = boundedCheckoutRequest((current) => {
    signal = current;
    return gate.promise;
  }, 10);
  await assert.rejects(work, CheckoutRequestTimeoutError);
  assert.equal(signal?.aborted, true);
  gate.resolve('late');
  await assert.rejects(work, CheckoutRequestTimeoutError);
});

test('the deadline includes a response body that never finishes', async () => {
  const body = deferred<string>();
  await assert.rejects(
    boundedCheckoutRequest(async () => ({ text: () => body.promise }).text(), 10),
    CheckoutRequestTimeoutError,
  );
  body.resolve('late body');
});

test('successful operations and ordinary errors retain their original result', async () => {
  assert.equal(await boundedCheckoutRequest(async () => 'ready'), 'ready');
  const error = new Error('connection lost');
  await assert.rejects(
    boundedCheckoutRequest(async () => {
      throw error;
    }),
    (received) => received === error,
  );
});

test('leaving a view cancels its request even if the transport ignores abort', async () => {
  const cancellation = new AbortController();
  const gate = deferred<string>();
  const work = boundedCheckoutRequest(() => gate.promise, 1000, cancellation.signal);
  await new Promise(setImmediate);
  cancellation.abort();
  await assert.rejects(work, { name: 'AbortError' });
  gate.resolve('obsolete');
  await assert.rejects(
    boundedCheckoutRequest(
      async () => assert.fail('No dispatch after cancellation'),
      1000,
      cancellation.signal,
    ),
    { name: 'AbortError' },
  );
});
