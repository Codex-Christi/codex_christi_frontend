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
      return Response.json(
        init?.method !== 'POST'
          ? { checkout }
          : String(url).endsWith('/resume')
            ? { ok: true, reviewKey: checkout.reviewKey, paypalOrderId: checkout.paypalOrderId }
            : { ok: true },
      );
    },
  });
  assert.equal(provider, attempt.paypalOrderId);
  assert.deepEqual(view!.variants, before);
  assert.equal(view!.variants.find((line) => line.variantId === 'shirt-m')?.quantity, 5);
  assert.deepEqual(requests, [
    'POST /next-api/shop/checkout/claim',
    `GET /next-api/shop/checkout/${attempt.orderToken}/resume`,
    `POST /next-api/shop/checkout/${attempt.orderToken}/resume`,
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
    { message: 'We couldn’t load your purchase review. Please try again.' },
  );
  assert.equal(captureCheckoutAttempt()?.paypalOrderId, attempt.paypalOrderId);
  assert.equal(
    (await loadOriginalCheckout(attempt, { request: async () => Response.json({ checkout }) }))
      .reviewKey,
    checkout.reviewKey,
  );
  late.resolve(Response.json({ checkout: { ...checkout, paypalOrderId: 'obsolete' } }));
});

test('temporary review-read failures preserve the purchase and allow a read-only retry', async (t) => {
  for (const failure of ['network', 'body', 408, 429, 500, 503] as const) {
    await t.test(String(failure), async () => {
      const { attempt, checkout } = setup(`review-read-${failure}`);
      const calls: string[] = [];
      let fail = true;
      const request: typeof fetch = async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        assert.equal(init?.method, undefined, 'Review reads must never submit payment');
        if (!fail) return Response.json({ checkout });
        if (failure === 'network') throw new TypeError('Synthetic connection failure');
        if (failure === 'body')
          return new Response(
            new ReadableStream({
              start: (controller) => controller.error(new TypeError('Read failed')),
            }),
          );
        return Response.json({ code: 'CHECKOUT_UNAVAILABLE' }, { status: failure });
      };
      await assert.rejects(loadOriginalCheckout(attempt, { request }), {
        message: 'We couldn’t load your purchase review. Please try again.',
      });
      assert.deepEqual(captureCheckoutAttempt(), attempt);
      fail = false;
      assert.deepEqual(await loadOriginalCheckout(attempt, { request }), checkout);
      assert.deepEqual(calls, [
        `GET /next-api/shop/checkout/${attempt.orderToken}/resume`,
        `GET /next-api/shop/checkout/${attempt.orderToken}/resume`,
      ]);
    });
  }
});

test('review-read access and payment-state failures keep their distinct guidance', async (t) => {
  for (const status of [401, 403, 404, 409]) {
    await t.test(String(status), async () => {
      const { attempt } = setup(`review-access-${status}`);
      await assert.rejects(
        loadOriginalCheckout(attempt, {
          request: async () => Response.json({ code: 'CHECKOUT_ACCESS_REQUIRED' }, { status }),
        }),
        {
          message:
            status === 401 || status === 403
              ? 'Sign in or verify your email to reopen this checkout.'
              : 'This checkout needs a status check before payment can continue.',
        },
      );
      assert.deepEqual(captureCheckoutAttempt(), attempt);
    });
  }
});

test('a failed review read after account change preserves the ownership warning', async () => {
  const { attempt } = setup('review-read-owner-change');
  const late = deferred();
  const work = loadOriginalCheckout(attempt, {
    request: async () => {
      await late.promise;
      throw new TypeError('Synthetic connection failure');
    },
  });
  await new Promise(setImmediate);
  useAuthStore.setState({ isAuthenticated: true, accountOwnerId: 'another-account' });
  late.resolve();
  await assert.rejects(work, /This checkout changed/);
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

test('reopening payment requires the original review to be saved without creating a new order', async () => {
  const { attempt, checkout } = setup('renewed-review');
  const requests: string[] = [];
  const request: typeof fetch = async (url, init) => {
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    if (init?.method !== 'POST') return Response.json({ checkout });
    assert.deepEqual(JSON.parse(String(init.body)), {
      acknowledged: true,
      reviewKey: checkout.reviewKey,
    });
    return Response.json({
      ok: true,
      reviewKey: checkout.reviewKey,
      paypalOrderId: checkout.paypalOrderId,
    });
  };
  assert.equal(
    await resumeOriginalPayPalOrder(checkout, attempt, { request }),
    checkout.paypalOrderId,
  );
  assert.deepEqual(requests, [
    `GET /next-api/shop/checkout/${attempt.orderToken}/resume`,
    `POST /next-api/shop/checkout/${attempt.orderToken}/resume`,
  ]);
  for (const result of [
    { ok: false },
    { ok: true, reviewKey: 'changed', paypalOrderId: checkout.paypalOrderId },
    { ok: true, reviewKey: checkout.reviewKey, paypalOrderId: 'different-payment' },
  ])
    await assert.rejects(
      resumeOriginalPayPalOrder(checkout, attempt, {
        request: async (_url, init) =>
          Response.json(init?.method === 'POST' ? result : { checkout }),
      }),
      /changed/,
    );
  await assert.rejects(
    resumeOriginalPayPalOrder(checkout, attempt, {
      request: async (_url, init) =>
        init?.method === 'POST'
          ? Response.json({ ok: false }, { status: 409 })
          : Response.json({ checkout }),
    }),
    /couldn’t save your review/,
  );
  assert.equal(captureCheckoutAttempt()?.paypalOrderId, checkout.paypalOrderId);
});

test('an account change while saving the original review cannot reopen payment', async () => {
  const { attempt, checkout } = setup('review-account-change');
  const gate = deferred<Response>();
  const saving = deferred<void>();
  const work = resumeOriginalPayPalOrder(checkout, attempt, {
    request: async (_url, init) => {
      if (init?.method !== 'POST') return Response.json({ checkout });
      saving.resolve();
      return gate.promise;
    },
  });
  await saving.promise;
  useAuthStore.setState({ isAuthenticated: true, accountOwnerId: 'another-account' });
  gate.resolve(
    Response.json({
      ok: true,
      reviewKey: checkout.reviewKey,
      paypalOrderId: checkout.paypalOrderId,
    }),
  );
  await assert.rejects(work, /changed/);
});
