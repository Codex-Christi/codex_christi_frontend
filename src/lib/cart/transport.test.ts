import assert from 'node:assert/strict';
import test from 'node:test';
import { cartTransport, CartTransportError } from './transport';
import { cartDjangoRequest, parseCartMutation, readRemoteCart } from './protocol';
import type { CartVariant } from './types';

const ownerId = 'user-a';
const line: CartVariant = {
  variantId: 'variant-m',
  quantity: 2,
  title: 'Saved hoodie',
  slug: 'saved-hoodie',
  itemDetail: {
    _id: 'variant-m',
    product: 'product-a',
    sku: 'HOODIE-M',
    title: 'Variant title',
    retail_price: 40,
    is_default: false,
    image_uris: [],
    options: [],
  },
};

function remoteItem() {
  return {
    variant_id: line.variantId,
    quantity: line.quantity,
    slug: line.slug,
    item_detail: line.itemDetail,
  };
}

test('Django snake-case records map into the shared cart model without trusting totals', () => {
  const items = readRemoteCart(
    { success: true, data: { user: ownerId, items: [remoteItem()], total_price: 'untrusted' } },
    ownerId,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].variantId, line.variantId);
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].title, 'Variant title');
  assert.equal(items[0].itemDetail.product, 'product-a');
  assert.deepEqual(
    readRemoteCart(
      { success: true, data: { items: [{ variant_id: 'removed', quantity: 0 }] } },
      ownerId,
    ),
    [],
  );
});

test('unreadable, duplicate and wrong-account server records never silently become an empty cart', () => {
  const bad = [
    { success: false, data: { items: [] } },
    { success: true, data: { items: 'not-an-array' } },
    { success: true, data: { items: [{ ...remoteItem(), quantity: -1 }] } },
    { success: true, data: { items: [{ ...remoteItem(), item_detail: {} }] } },
    { success: true, data: { items: [remoteItem(), remoteItem()] } },
    { success: true, data: { user: 'user-b', items: [remoteItem()] } },
  ];
  for (const payload of bad) assert.throws(() => readRemoteCart(payload, ownerId));
});

test('existing Django endpoints receive only the documented mutation fields', () => {
  const add = cartDjangoRequest(parseCartMutation({ ownerId, action: 'add', item: line }));
  assert.equal(add.path, '/cart/add-items');
  assert.equal(add.init.method, 'POST');
  const added = JSON.parse(add.init.body).items[0];
  assert.equal(added.itemDetail.title, line.title);
  assert.equal(added.title, undefined);
  assert.equal(added.variantId, line.variantId);
  const update = cartDjangoRequest(parseCartMutation({ ownerId, action: 'update', item: line }));
  assert.equal(update.init.method, 'PATCH');
  assert.equal(update.path, '/cart/update-items');
  assert.deepEqual(JSON.parse(update.init.body), {
    items: [{ variantId: line.variantId, quantity: 2 }],
  });
  const remove = cartDjangoRequest(
    parseCartMutation({
      ownerId,
      action: 'remove',
      item: { variantId: line.variantId, quantity: 0 },
    }),
  );
  assert.equal(remove.path, '/cart/remove-items');
  assert.deepEqual(JSON.parse(remove.init.body), { items: [{ variantId: line.variantId }] });
});

test('invalid quantities and undocumented actions are rejected before remote writes', () => {
  for (const quantity of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2147483648]) {
    assert.throws(() =>
      parseCartMutation({ ownerId, action: 'update', item: { variantId: 'variant-m', quantity } }),
    );
  }
  for (const action of ['clear', 'replace', 'constructor', 'toString']) {
    assert.throws(() => parseCartMutation({ ownerId, action, item: line }));
  }
  assert.throws(() =>
    parseCartMutation({ ownerId: '../other-account', action: 'add', item: line }),
  );
});

test('browser reads stay same-origin and never contain bearer credentials', async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('x-cart-owner'), ownerId);
      assert.equal(headers.get('authorization'), null);
      assert.equal(init?.credentials, 'same-origin');
      assert.equal(init?.cache, 'no-store');
      return Response.json({ success: true, ownerId, items: [line] });
    },
  );
  const result = await cartTransport.read(ownerId);
  assert.equal(result[0].quantity, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], '/next-api/shop/cart');
});

test('an account switch or malformed successful read cannot hydrate another account cart', async (t) => {
  const responses = [
    { success: true, ownerId: 'user-b', items: [line] },
    { success: true, ownerId, items: [{ ...line, quantity: -3 }] },
  ];
  t.mock.method(globalThis, 'fetch', async () => Response.json(responses.shift()));
  for (let count = 0; count < 2; count += 1) {
    await assert.rejects(
      cartTransport.read(ownerId),
      (error: unknown) => error instanceof CartTransportError && !error.uncertain,
    );
  }
});

test('definite auth/validation rejections and pre-forward outages are distinguished from uncertain writes', async (t) => {
  let status = 401;
  let uncertain = false;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ success: false, message: 'Not applied.', uncertain }, { status }),
  );
  for (status of [400, 401, 403, 409, 503]) {
    await assert.rejects(
      cartTransport.write(ownerId, 'add', line),
      (error: unknown) =>
        error instanceof CartTransportError && error.status === status && !error.uncertain,
    );
  }
  status = 502;
  uncertain = true;
  await assert.rejects(
    cartTransport.write(ownerId, 'add', line),
    (error: unknown) => error instanceof CartTransportError && error.uncertain,
  );
});

test('lost write responses stay uncertain and are never automatically replayed', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Network lost');
  });
  await assert.rejects(
    cartTransport.write(ownerId, 'add', line),
    (error: unknown) => error instanceof CartTransportError && error.uncertain,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  await assert.rejects(
    cartTransport.read(ownerId),
    (error: unknown) => error instanceof CartTransportError && !error.uncertain,
  );
});

test('invalid successful acknowledgements are uncertain, while cancellation before send stays queued', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('invalid-json'));
  await assert.rejects(
    cartTransport.write(ownerId, 'update', line),
    (error: unknown) => error instanceof CartTransportError && error.uncertain,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    cartTransport.write(ownerId, 'add', line, controller.signal),
    (error: unknown) => error instanceof CartTransportError && !error.uncertain,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('update and remove browser payloads omit stale display metadata', async (t) => {
  const bodies: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ success: true, ownerId });
  });
  await cartTransport.write(ownerId, 'update', line);
  await cartTransport.write(ownerId, 'remove', { ...line, quantity: 0 });
  assert.deepEqual(bodies, [
    { ownerId, action: 'update', item: { variantId: line.variantId, quantity: 2 } },
    { ownerId, action: 'remove', item: { variantId: line.variantId } },
  ]);
});
