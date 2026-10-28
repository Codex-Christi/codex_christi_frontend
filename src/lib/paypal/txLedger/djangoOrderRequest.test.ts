import assert from 'node:assert/strict';
import test from 'node:test';
import { postDjangoOrder } from './djangoOrderRequest';
import { DjangoOrderError } from './djangoOrderContract';

test('Django POST transport is bounded, private, nonredirecting and never retries', async (t) => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_DJANGO_API_BASE_URL: 'https://django.example/api/v1',
    DJANGO_INTERNAL_BASE_URL: 'https://django.example/api/v1',
    SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY: 'transport-test-secret',
  });
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  });
  let calls = 0;
  let reply = () => Promise.resolve(Response.json({ success: true }, { status: 201 }));
  t.mock.method(globalThis, 'fetch', async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.method, 'POST');
    assert.ok(init?.signal instanceof AbortSignal);
    return reply();
  });
  assert.deepEqual(await postDjangoOrder('/orders/order-payment', {}), { success: true });
  for (const [status, outcome] of [
    [400, 'uncertain'],
    [401, 'rejected'],
    [409, 'uncertain'],
    [500, 'uncertain'],
    [202, 'uncertain'],
    [302, 'uncertain'],
  ] as const) {
    const before = calls;
    reply = async () => Response.json({ success: false }, { status });
    await assert.rejects(
      () => postDjangoOrder('/orders/order-payment', {}),
      (error) =>
        error instanceof DjangoOrderError &&
        error.failure.outcome === outcome &&
        error.failure.httpStatus === status,
    );
    assert.equal(calls, before + 1);
  }
  reply = async () =>
    Response.json(
      {
        success: false,
        errors: [{ field_name: 'address', code: 'required', message: 'Required' }],
      },
      { status: 400 },
    );
  await assert.rejects(
    () => postDjangoOrder('/orders/order-payment', {}),
    (error) => error instanceof DjangoOrderError && error.failure.outcome === 'rejected',
  );
  for (const badReply of [
    async () => {
      throw new DOMException('Timed out', 'TimeoutError');
    },
    async () => new Response('<html>Bad gateway</html>'),
    async () => new Response('x'.repeat(256 * 1024 + 1)),
  ]) {
    reply = badReply;
    await assert.rejects(
      () => postDjangoOrder('/orders/order-payment', {}),
      (error) => error instanceof DjangoOrderError && error.failure.outcome === 'uncertain',
    );
  }
  const before = calls;
  delete process.env.SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY;
  await assert.rejects(
    () => postDjangoOrder('/orders/order-payment', {}),
    (error) => error instanceof DjangoOrderError && error.failure.outcome === 'not_sent',
  );
  assert.equal(calls, before);
});
