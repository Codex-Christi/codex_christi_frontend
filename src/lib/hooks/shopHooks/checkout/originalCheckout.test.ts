import assert from 'node:assert/strict';
import test from 'node:test';
import useAuthStore from '@/stores/authStore';
import {
  beginCheckoutAttempt,
  captureCheckoutAttempt,
  completeCheckoutAttempt,
  setCheckoutAttemptStage,
  usePayPalIntentStore,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import type { OriginalCheckout } from '@/lib/shop/checkout/originalCheckout';
import { CartController, type CartView } from '@/lib/cart/controller';
import { reconcileCart } from '@/lib/cart/model';
import { cartLine, deferred, memoryRepository } from '@/lib/cart/test-support';
import { loadOriginalCheckout, resumeOriginalPayPalOrder } from './originalCheckout';

usePayPalIntentStore.persist.setOptions({
  storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
});

function setup(key: string) {
  useAuthStore.setState({ isAuthenticated: false, accountOwnerId: null });
  usePayPalIntentStore.getState().clearIntent();
  const attempt = beginCheckoutAttempt(key);
  completeCheckoutAttempt(attempt, {
    orderToken: `order-${key}`,
    paypalOrderId: `provider-${key}`,
  });
  const current = captureCheckoutAttempt()!;
  const checkout: OriginalCheckout = {
    orderToken: current.orderToken!,
    paypalOrderId: current.paypalOrderId!,
    reviewKey: 'original-hash',
    customer: { name: 'Original Customer', email: 'guest@example.com' },
    deliveryAddress: {
      shipping_address_line_1: '12 Main Road',
      shipping_address_line_2: '',
      shipping_city: 'Los Angeles',
      shipping_state: 'CA',
      shipping_country: 'USA',
      zip_code: '90001',
    },
    countryCode: 'US',
    quote: { currency: 'USD', subtotal: 50, shipping: 5, total: 55 },
    lines: [
      {
        id: 'shirt-m',
        title: 'Original shirt',
        image: null,
        quantity: 2,
        options: 'Size: M',
        unitAmount: '25.00',
        lineAmount: '50.00',
      },
    ],
  };
  return { attempt: current, checkout };
}

test('sign-in resumes the original provider order while merged and later cart additions remain intact', async (t) => {
  const { attempt, checkout } = setup('merge');
  const repository = memoryRepository();
  await repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3), cartLine('other', 1)]),
  );
  let view: CartView;
  const controller = new CartController(
    repository,
    (next) => {
      view = next;
    },
    {
      read: async () => [],
      write: async () => assert.fail('Resume must not upload cart changes'),
    },
    () => false,
  );
  t.after(() => controller.dispose());
  await controller.activate('guest', false);
  await controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  await controller.recordCheckout(attempt.orderToken!, controller.checkoutSnapshot());
  const reviewed = await loadOriginalCheckout(attempt, {
    request: async () => Response.json({ checkout }),
  });
  await controller.activate('user:alice', true);
  useAuthStore.setState({ isAuthenticated: true, accountOwnerId: 'alice' });
  const before = structuredClone(view!.variants);
  const requests: string[] = [];
  const provider = await resumeOriginalPayPalOrder(reviewed, attempt, {
    request: async (url, init) => {
      requests.push(`${init?.method ?? 'GET'} ${url}`);
      return Response.json(init?.method === 'POST' ? { ok: true } : { checkout });
    },
  });
  assert.equal(provider, attempt.paypalOrderId);
  assert.deepEqual(view!.variants, before);
  assert.equal(view!.variants.find((line) => line.variantId === 'shirt-m')?.quantity, 5);
  assert.deepEqual(requests, [
    'POST /next-api/shop/checkout/claim',
    `GET /next-api/shop/checkout/${attempt.orderToken}/resume`,
  ]);
  assert.equal(usePayPalIntentStore.getState().checkoutAttempt?.attemptId, attempt.attemptId);
  await controller.command({ type: 'add', line: cartLine('shirt-m', 1) });
  await controller.consumePurchase(attempt.orderToken!, [{ variantId: 'shirt-m', quantity: 2 }]);
  assert.equal(view!.variants.find((line) => line.variantId === 'shirt-m')?.quantity, 4);
  assert.equal(view!.variants.find((line) => line.variantId === 'other')?.quantity, 1);
  await controller.consumePurchase(attempt.orderToken!, [{ variantId: 'shirt-m', quantity: 2 }]);
  assert.equal(view!.variants.find((line) => line.variantId === 'shirt-m')?.quantity, 4);
});

test('payment creation rechecks the saved review and rejects changed or malformed original orders', async () => {
  const { attempt, checkout } = setup('changed');
  for (const changed of [
    { ...checkout, reviewKey: 'different-hash' },
    { ...checkout, paypalOrderId: 'different-provider' },
    { ...checkout, quote: { ...checkout.quote, total: null } },
    { ...checkout, lines: [] },
    { ...checkout, lines: [null] },
    { ...checkout, lines: [{ ...checkout.lines[0], unitAmount: 25 }] },
  ]) {
    await assert.rejects(
      resumeOriginalPayPalOrder(checkout, attempt, {
        request: async () => Response.json({ checkout: changed }),
      }),
    );
  }
});

test('approval and late account changes cannot reopen an original payment', async () => {
  for (const scenario of ['approved', 'account-switch']) {
    const { attempt, checkout } = setup(scenario);
    const gate = deferred<Response>();
    const work = loadOriginalCheckout(attempt, { request: async () => gate.promise });
    await new Promise(setImmediate);
    if (scenario === 'approved') setCheckoutAttemptStage(attempt, 'paypal_approved');
    else useAuthStore.setState({ isAuthenticated: true, accountOwnerId: 'someone-else' });
    gate.resolve(Response.json({ checkout }));
    await assert.rejects(work, /changed|already needs checking/);
  }
});

test('a stalled preview preserves the bound order and permits a fresh read', async () => {
  const { attempt, checkout } = setup('preview-timeout');
  const late = deferred<Response>();
  await assert.rejects(
    loadOriginalCheckout(attempt, { request: async () => late.promise, timeoutMs: 5 }),
    /taking too long/,
  );
  assert.equal(captureCheckoutAttempt()?.paypalOrderId, attempt.paypalOrderId);
  assert.equal(
    (await loadOriginalCheckout(attempt, { request: async () => Response.json({ checkout }) }))
      .reviewKey,
    checkout.reviewKey,
  );
  late.resolve(Response.json({ checkout: { ...checkout, paypalOrderId: 'obsolete' } }));
});

test('a progressed attempt or failed account claim prevents any resume GET', async () => {
  const { attempt } = setup('claim-rejected');
  useAuthStore.setState({ isAuthenticated: true, accountOwnerId: 'alice' });
  let calls = 0;
  await assert.rejects(
    loadOriginalCheckout(attempt, {
      request: async (_url, init) => {
        calls += 1;
        assert.equal(init?.method, 'POST');
        return Response.json({}, { status: 403 });
      },
    }),
    /couldn’t link/,
  );
  assert.equal(calls, 1);
  setCheckoutAttemptStage(attempt, 'capture_checking');
  await assert.rejects(
    loadOriginalCheckout(attempt, {
      request: async () => assert.fail('No request after approval'),
    }),
    /already needs checking/,
  );
});
