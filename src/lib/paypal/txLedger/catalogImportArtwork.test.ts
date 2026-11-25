import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { finalizeCanonicalOrderSnapshot } from '../orderSnapshot/canonicalize';
import { DjangoOrderError } from './djangoOrderContract';
import { isAcceptedDjangoFulfillmentProcessResponse } from './fulfillmentProcessResponse';
import {
  FulfillmentPayloadValidationError,
  sendMerchizeFulfillmentOrder,
} from './sendMerchizeFulfillmentOrder';

const productId = 'fixture-product';
const anotherProductId = 'other-product';
const variantId = 'fixture-large';
const merchizeBase = 'https://merchize.example.test';
const djangoBase = 'https://django.example.test';

function origin(side: string, product = productId, lifetimeSeconds = 3600) {
  const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  return `https://merchize-artworks.s3.us-west-1.amazonaws.com/fixture/artworks/${product}/${side}.png?Expires=${expires}&Signature=fixture%2Bsignature`;
}

function artwork(side: string, attributes: Record<string, unknown> = {}) {
  return {
    product: productId,
    side,
    is_uploaded: true,
    is_deleted: false,
    origin_url: origin(side),
    ...attributes,
  };
}

function order(selections = [{ productId, variantId }]) {
  const money = (value: string) => ({ value, currency: 'USD' as const });
  const subtotal = money((20 * selections.length).toFixed(2));
  const shipping = money('0.00');
  const canonicalOrderSnapshot = finalizeCanonicalOrderSnapshot({
    version: 'shop-alpha-order-v1',
    hashAlgorithm: 'sha256',
    createdAt: '2026-01-01T00:00:00.000Z',
    destination: { countryIso3: 'USA', region: 'CA' },
    currency: 'USD',
    lines: selections.map((line) => ({
      ...line,
      lineId: `${line.productId}:${line.variantId}`,
      supplierProductId: 'fixture-supplier-product',
      supplierVariantId: 'fixture-supplier-variant',
      sku: 'FIXTURE-SUPPLIER-SKU',
      sellerSku: 'FIXTURE-SELLER-SKU',
      title: 'Fixture item',
      selectedOptions: [{ name: 'Color', value: 'Grey' }],
      imageUrl: 'https://example.test/mockup.jpg',
      quantity: 1,
      unitAmount: money('20.00'),
      lineAmount: money('20.00'),
      shippingAllocation: shipping,
    })),
    subtotal,
    shipping,
    total: subtotal,
  });

  return {
    canonicalOrderSnapshot,
    cartSnapshot: [],
    djangoPaymentSaveCustomId: 'payment-1',
    djangoOrderIntentUuid: 'intent-1',
    djangoOrderIntentOrderId: 'ORD-1',
    identifier: 'fixture',
    currency: 'USD',
    customerName: 'Test Customer',
    countryIso2: 'US',
    fulfillmentAddress: {
      shipping_address_line_1: 'Test address',
      shipping_address_line_2: '',
      shipping_city: 'Test city',
      shipping_state: 'CA',
      zip_code: '00000',
      shipping_country: 'USA',
    },
  };
}

function mockProviders(
  t: TestContext,
  lists: Record<string, { rows: unknown[]; total?: number }>,
  options?: { exemptProduct?: string; djangoStatus?: number },
) {
  const env = {
    MERCHIZE_BO_API_BASE_URL: merchizeBase,
    MERCHIZE_BASE_URL: merchizeBase,
    MERCHIZE_API_KEY: 'fixture-api-key',
    NEXT_PUBLIC_DJANGO_API_BASE_URL: djangoBase,
    DJANGO_INTERNAL_BASE_URL: djangoBase,
    SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY: 'fixture-otp-key',
    SHOP_CHECKOUT_SERVER_ACTIONS_POST_PROCESSING_CRYPTO_SECRET: 'fixture-crypto-secret',
  };
  for (const [key, value] of Object.entries(env)) {
    const originalValue = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (originalValue === undefined) delete process.env[key];
      else process.env[key] = originalValue;
    });
  }
  const lookups: string[] = [];
  const productReads: string[] = [];
  const writes: { items: Record<string, unknown>[] }[] = [];
  const requests = t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin === merchizeBase && url.pathname === '/artwork/artworks') {
      assert.equal(init?.method, 'GET');
      assert.equal(new Headers(init?.headers).get('X-API-KEY'), 'fixture-api-key');
      assert.equal(new Headers(init?.headers).has('Authorization'), false);
      assert.equal(init?.redirect, 'error');
      const product = url.searchParams.get('product')!;
      lookups.push(product);
      assert.ok(Object.hasOwn(lists, product), 'Unexpected artwork lookup');
      const { rows, total = rows.length } = lists[product];
      return Response.json({ success: true, data: { total, artworks: rows } });
    }
    if (url.origin === merchizeBase && url.pathname.startsWith('/product/products/')) {
      assert.ok(!init?.method || init.method === 'GET');
      const product = url.pathname.split('/').at(-1)!;
      productReads.push(product);
      return Response.json({
        success: true,
        data: {
          _id: options?.exemptProduct ?? product,
          title: 'Fixture',
          retail_price: '20.00',
          no_need_artworks: Boolean(options?.exemptProduct),
        },
      });
    }
    assert.equal(url.origin, djangoBase, 'Only the mocked hosts may be called');
    assert.equal(url.pathname, '/orders/process/payment-1');
    assert.equal(init?.method, 'POST');
    const payload = JSON.parse(String(init?.body));
    writes.push(payload);
    const status = options?.djangoStatus ?? 201;
    if (status !== 201) {
      return Response.json({ success: false, request_data: payload }, { status });
    }
    return Response.json({
      status,
      success: true,
      data: {
        id: 'd73b4b97-3ec0-4163-8a34-55d649404f81',
        order_payment_custom_id: 'payment-1',
        order_intent_id: 'intent-1',
        order_intent_order_id: 'ORD-1',
        processing_status: 'completed',
        error_message: 'Order created but details not available',
        request_data: payload,
        response_data: { data: { data: { order_id: 'ORD-1', items: payload.items } } },
      },
    }, { status });
  });
  return { lookups, productReads, writes, requests };
}

function designs(item: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => key.startsWith('design_')));
}

test('catalog handoff sends only verified sides and deduplicates artwork lookups by product', async (t) => {
  const defaultFront = artwork('front');
  const largeFront = artwork('front', {
    variant_id: variantId,
    origin_url: origin('large-front'),
  });
  const back = artwork('back');
  const sleeve = artwork('sleeve');
  const hood = artwork('hood');
  const capFront = artwork('front', {
    product: anotherProductId,
    origin_url: origin('front', anotherProductId),
  });
  const { lookups, productReads, writes, requests } = mockProviders(t, {
    [productId]: { rows: [
      defaultFront, largeFront, back, sleeve, hood,
      artwork('not-a-supported-side', { is_deleted: true }),
      artwork('not-a-supported-side', { variant: { _id: 'unselected' } }),
    ] },
    [anotherProductId]: { rows: [capFront] },
  });
  const result = await sendMerchizeFulfillmentOrder(order([
    { productId, variantId },
    { productId, variantId: 'fixture-small' },
    { productId: anotherProductId, variantId: 'fixture-one-size' },
  ]));

  assert.deepEqual(lookups, [productId, anotherProductId]);
  assert.deepEqual(productReads, []);
  assert.equal(requests.mock.callCount(), 3);
  assert.equal(writes.length, 1);
  const expected = {
    design_front: largeFront.origin_url,
    design_back: back.origin_url,
    design_sleeve: sleeve.origin_url,
    design_hood: hood.origin_url,
  };
  assert.deepEqual(designs(writes[0].items[0]), expected);
  assert.deepEqual(designs(writes[0].items[1]), { ...expected, design_front: defaultFront.origin_url });
  assert.deepEqual(designs(writes[0].items[2]), { design_front: capFront.origin_url });
  assert.equal(writes[0].items[0].sku, 'FIXTURE-SELLER-SKU');
  assert.equal(writes[0].items[0].merchize_sku, 'FIXTURE-SUPPLIER-SKU');
  assert.equal(isAcceptedDjangoFulfillmentProcessResponse(result), true);
  assert.deepEqual(designs(result.requestPayload.items[0]), {});
  assert.doesNotMatch(JSON.stringify(result), /Signature=|fixture%2Bsignature/);
  assert.match(JSON.stringify(result.data?.response_data), /redacted-artwork-url/);
});

test('artwork failure is marked not sent, before any Django request', async (t) => {
  const cases = [
    ['ambiguous side', { rows: [artwork('front'), artwork('front')] }],
    ['unsupported selected side', { rows: [artwork('left')] }],
    ['unavailable file', { rows: [artwork('front', { is_uploaded: false })] }],
    ['variant mismatch', { rows: [artwork('front', { variant_id: 'other-variant' })] }],
    ['ambiguous scope', { rows: [artwork('front', { variants: ['other-variant'] })] }],
    ['product mismatch', { rows: [artwork('front', { product: anotherProductId })] }],
    ['expired source', { rows: [artwork('front', { origin_url: origin('front', productId, -1) })] }],
    ['asset for another product', { rows: [artwork('front', { origin_url: origin('front', anotherProductId) })] }],
    ['preview instead of source', { rows: [artwork('front', { origin_url: 'https://example.test/preview.png' })] }],
    ['incomplete provider reply', { rows: [artwork('front')], total: 2 }],
    ['no matching artwork', { rows: [] }],
  ] as const;
  for (const [name, { rows, ...metadata }] of cases) {
    await t.test(name, async (t) => {
      const { writes } = mockProviders(t, { [productId]: { rows: [...rows], ...metadata } });
      await assert.rejects(() => sendMerchizeFulfillmentOrder(order()), (error) =>
        error instanceof FulfillmentPayloadValidationError &&
        error.failure.outcome === 'not_sent' &&
        error.issues.some(({ field }) => field === 'items.artwork'));
      assert.equal(writes.length, 0);
    });
  }
});

test('a product can proceed without artwork only on an exact explicit exemption', async (t) => {
  for (const id of [productId, anotherProductId]) {
    await t.test(id, async (t) => {
      const { writes, productReads } = mockProviders(t, { [productId]: { rows: [] } }, {
        exemptProduct: id,
      });
      if (id === productId) {
        await sendMerchizeFulfillmentOrder(order());
        assert.deepEqual(designs(writes[0].items[0]), {});
      } else {
        await assert.rejects(() => sendMerchizeFulfillmentOrder(order()), FulfillmentPayloadValidationError);
        assert.equal(writes.length, 0);
      }
      assert.deepEqual(productReads, [productId]);
    });
  }
});

test('Django error evidence also removes echoed artwork sources', async (t) => {
  const { writes } = mockProviders(
    t,
    { [productId]: { rows: [artwork('front')] } },
    { djangoStatus: 422 },
  );
  await assert.rejects(() => sendMerchizeFulfillmentOrder(order()), (error: unknown) => {
    assert.doesNotMatch(JSON.stringify(error), /Signature=|fixture%2Bsignature/);
    assert.match(JSON.stringify(error), /redacted-artwork-url/);
    return true;
  });
  assert.equal(writes.length, 1);
});

test('the worker cannot dispatch if it lost the order lock during the artwork lookup', async (t) => {
  const { lookups, writes } = mockProviders(t, { [productId]: { rows: [artwork('front')] } });
  let lookupsBeforeLockCheck: string[] | undefined;
  await assert.rejects(() => sendMerchizeFulfillmentOrder({
    ...order(),
    assertProcessingLease: async () => {
      lookupsBeforeLockCheck = [...lookups];
      throw new Error('Order lock expired');
    },
  }), (error) => error instanceof DjangoOrderError && error.failure.outcome === 'not_sent');
  assert.deepEqual(lookupsBeforeLockCheck, [productId]);
  assert.equal(writes.length, 0);
});
