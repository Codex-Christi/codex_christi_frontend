import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginCheckoutAttempt,
  captureCheckoutAttempt,
  clearCheckoutAttempt,
  completeCheckoutAttempt,
  isCurrentCheckoutAttempt,
  usePayPalIntentStore,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { deferred } from '@/lib/cart/test-support';
import { finalizePayPalAttempt } from './finalizePayPalAttempt';

usePayPalIntentStore.persist.setOptions({
  storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
});
function setup(key: string) {
  usePayPalIntentStore.getState().clearIntent();
  const attempt = beginCheckoutAttempt(key);
  completeCheckoutAttempt(attempt, { orderToken: `token-${key}`, paypalOrderId: `paypal-${key}` });
  return captureCheckoutAttempt()!;
}
const authorized = () =>
  Response.json({
    purchaseUnits: [{ payments: { authorizations: [{ id: 'authorization-one' }] } }],
  });
const captured = () => Response.json({ status: 'COMPLETED' });

test('immutable checkout setup reuses one UUID after reload, while changed input invalidates earlier responses', async () => {
  const first = setup('A');
  assert.equal(beginCheckoutAttempt('A').attemptId, first.attemptId);
  const persisted = {
    state: {
      checkoutAttempt: first,
      orderToken: first.orderToken,
      activeCheckout: usePayPalIntentStore.getState().activeCheckout,
    },
    version: 0,
  };
  usePayPalIntentStore.persist.setOptions({
    storage: {
      getItem: async () => structuredClone(persisted),
      setItem: async () => {},
      removeItem: async () => {},
    },
  });
  usePayPalIntentStore.setState({
    checkoutAttempt: null,
    orderToken: undefined,
    activeCheckout: null,
  });
  await usePayPalIntentStore.persist.rehydrate();
  assert.equal(beginCheckoutAttempt('A').attemptId, first.attemptId);
  assert.throws(() => beginCheckoutAttempt('B'), /earlier payment/);
  assert.equal(captureCheckoutAttempt()?.attemptId, first.attemptId);
  clearCheckoutAttempt(first);
  const second = beginCheckoutAttempt('B');
  assert.notEqual(second.attemptId, first.attemptId);
  assert.equal(completeCheckoutAttempt(first, { orderToken: 'old', paypalOrderId: 'old' }), false);
  assert.equal(clearCheckoutAttempt(first), false);
  assert.equal(isCurrentCheckoutAttempt(second), true);
});

test('provider approval must match the attempt and duplicate approval callbacks share one authorization and capture', async () => {
  const attempt = setup('single');
  const gate = deferred<Response>();
  const requests: string[] = [];
  const navigations: string[] = [];
  const options = {
    request: async (url: string | URL | Request) => {
      requests.push(String(url));
      return requests.length === 1 ? gate.promise : captured();
    },
    onCompleted: (token: string) => navigations.push(token),
  };
  await assert.rejects(
    finalizePayPalAttempt(attempt, 'another-provider-order', options),
    /attempt changed/,
  );
  assert.equal(requests.length, 0);
  const first = finalizePayPalAttempt(attempt, attempt.paypalOrderId!, options);
  const duplicate = finalizePayPalAttempt(attempt, attempt.paypalOrderId!, options);
  assert.equal(first, duplicate);
  gate.resolve(authorized());
  assert.deepEqual(await Promise.all([first, duplicate]), ['completed', 'completed']);
  assert.equal(requests.length, 2);
  assert.deepEqual(navigations, ['token-single']);
});

test('logout during authorization stops before capture and cannot recreate cleared checkout state', async () => {
  const attempt = setup('logout');
  const gate = deferred<Response>();
  let requests = 0;
  const work = finalizePayPalAttempt(attempt, attempt.paypalOrderId!, {
    request: async () => {
      requests += 1;
      return gate.promise;
    },
    onCompleted: () => assert.fail('obsolete checkout navigated'),
  });
  usePayPalIntentStore.getState().clearActiveCheckout();
  usePayPalIntentStore.getState().clearIntent();
  gate.resolve(authorized());
  assert.equal(await work, 'superseded');
  assert.equal(requests, 1);
  assert.equal(usePayPalIntentStore.getState().activeCheckout, null);
});

test('a late capture for A neither clears nor navigates away from the newer B checkout', async () => {
  const attempt = setup('late-A');
  const gate = deferred<Response>();
  const captureStarted = deferred();
  let requests = 0;
  const work = finalizePayPalAttempt(attempt, attempt.paypalOrderId!, {
    request: async () => {
      requests += 1;
      if (requests === 1) return authorized();
      captureStarted.resolve();
      return gate.promise;
    },
    onCompleted: () => assert.fail('old capture navigated'),
  });
  await captureStarted.promise;
  clearCheckoutAttempt(attempt); // An explicit account boundary invalidates the old attempt.
  const next = beginCheckoutAttempt('late-B');
  completeCheckoutAttempt(next, { orderToken: 'token-B', paypalOrderId: 'paypal-B' });
  gate.resolve(captured());
  assert.equal(await work, 'superseded');
  assert.equal(usePayPalIntentStore.getState().orderToken, 'token-B');
  assert.equal(usePayPalIntentStore.getState().activeCheckout?.orderToken, 'token-B');
});

test('a failed capture keeps its recovery attempt instead of declaring the payment cancelled', async () => {
  const attempt = setup('uncertain');
  let requests = 0;
  await assert.rejects(
    finalizePayPalAttempt(attempt, attempt.paypalOrderId!, {
      request: async () => {
        if (++requests === 1) return authorized();
        throw new Error('connection lost');
      },
      onCompleted: () => assert.fail('unconfirmed capture navigated'),
    }),
    /connection lost/,
  );
  assert.equal(usePayPalIntentStore.getState().activeCheckout?.stage, 'capture_checking');
  assert.equal(isCurrentCheckoutAttempt(attempt), true);
});

test('an explicitly preserved guest checkout continues after sign-in advances auth generation', async () => {
  const { advanceAuthGeneration } = await import('@/lib/auth/session-generation');
  const attempt = setup('guest-sign-in');
  const gate = deferred<Response>();
  let requests = 0;
  let confirmed = false;
  const work = finalizePayPalAttempt(attempt, attempt.paypalOrderId!, {
    request: async () => (++requests === 1 ? gate.promise : captured()),
    onCompleted: () => {
      confirmed = true;
    },
  });
  advanceAuthGeneration();
  gate.resolve(authorized());
  assert.equal(await work, 'completed');
  assert.equal(confirmed, true);
  assert.equal(requests, 2);
});

test('a server rejection exposes recovery guidance without internal payment diagnostics', async () => {
  const attempt = setup('safe-error');
  await assert.rejects(
    finalizePayPalAttempt(attempt, attempt.paypalOrderId!, {
      request: async () =>
        Response.json(
          {
            error: {
              message: '[capture_internal] secret-provider-diagnostic',
              requestId: 'secret-id',
            },
          },
          { status: 500 },
        ),
      onCompleted: () => assert.fail('rejected payment navigated'),
    }),
    (error: Error) =>
      /Check its status before trying again/.test(error.message) &&
      !error.message.includes('secret'),
  );
});
