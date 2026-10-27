import assert from 'node:assert/strict';
import test from 'node:test';
import { useWishlist } from './use-wishlist';
import type { WishlistResponse } from '@/lib/wishlist/types';

const sample: WishlistResponse = {
  status: 200,
  success: true,
  message: 'ok',
  userId: 'user-a',
  data: [{ productId: 'product-a', title: 'Product', image: null, price: 30, available: true }],
};

function seedWishlist(wishlist: WishlistResponse) {
  useWishlist.getState().clearWishlist();
  useWishlist.setState({ wishlist });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

test('shares concurrent fetches and does not resurrect rows after clearing an account', async (t) => {
  useWishlist.getState().clearWishlist();
  const pending = deferredResponse();
  const fetchMock = t.mock.method(globalThis, 'fetch', () => pending.promise);
  const first = useWishlist.getState().getWishlist();
  const second = useWishlist.getState().getWishlist();
  assert.equal(first, second);
  assert.equal(fetchMock.mock.callCount(), 1);
  useWishlist.getState().clearWishlist();
  pending.resolve(Response.json(sample));
  await first;
  assert.equal(useWishlist.getState().wishlist, null);
  assert.equal(useWishlist.getState().isLoading, false);
});

test('keeps saved products on remove failure and blocks duplicate submissions', async (t) => {
  seedWishlist(sample);
  const pending = deferredResponse();
  const fetchMock = t.mock.method(globalThis, 'fetch', () => pending.promise);
  const first = useWishlist.getState().removeWishlistItem('product-a');
  await useWishlist.getState().removeWishlistItem('product-a');
  assert.deepEqual(useWishlist.getState().pendingProductIds, ['product-a']);
  assert.equal(fetchMock.mock.callCount(), 1);
  pending.resolve(Response.json({ success: false, message: 'Please retry.' }, { status: 502 }));
  await first;
  assert.deepEqual(useWishlist.getState().wishlist?.data, sample.data);
  assert.deepEqual(useWishlist.getState().pendingProductIds, []);
  assert.equal(useWishlist.getState().error, 'Please retry.');
});

test('updates removals after success and refreshes the server list', async (t) => {
  seedWishlist(sample);
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    calls.push(options?.method ?? 'GET');
    return Response.json(
      options?.method === 'POST'
        ? { success: true, userId: 'user-a', message: 'Removed.' }
        : { ...sample, data: [] },
    );
  });
  await useWishlist.getState().removeWishlistItem('product-a');
  assert.deepEqual(calls, ['POST', 'GET']);
  assert.deepEqual(useWishlist.getState().wishlist?.data, []);
  assert.deepEqual(useWishlist.getState().pendingProductIds, []);
});

test('expired authentication clears rows without redirecting from the store', async (t) => {
  seedWishlist(sample);
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ success: false, message: 'Sign in.' }, { status: 401 }),
  );
  await useWishlist.getState().getWishlist();
  assert.equal(useWishlist.getState().wishlist, null);
  assert.equal(useWishlist.getState().authRequired, true);
  assert.equal(useWishlist.getState().error, 'Sign in.');
});

test('an outstanding mutation cannot refresh another account after clear', async (t) => {
  seedWishlist(sample);
  const pending = deferredResponse();
  const fetchMock = t.mock.method(globalThis, 'fetch', () => pending.promise);
  const mutation = useWishlist.getState().removeWishlistItem('product-a');
  useWishlist.getState().clearWishlist();
  pending.resolve(Response.json({ success: true, userId: 'user-a', message: 'Removed.' }));
  await mutation;
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(useWishlist.getState().wishlist, null);
  assert.deepEqual(useWishlist.getState().pendingProductIds, []);
});

test('a refresh started before another removal completes cannot resurrect its product', async (t) => {
  const secondProduct = { ...sample.data[0], productId: 'product-b' };
  seedWishlist({ ...sample, data: [...sample.data, secondProduct] });
  const firstRemoval = deferredResponse();
  const secondRemoval = deferredResponse();
  const firstRefresh = deferredResponse();
  const secondRefresh = deferredResponse();
  let refreshCount = 0;
  t.mock.method(globalThis, 'fetch', (_url: unknown, options?: RequestInit) => {
    if (options?.method === 'POST') {
      const body = JSON.parse(String(options.body)) as { product_ids: string[] };
      return body.product_ids[0] === 'product-a' ? firstRemoval.promise : secondRemoval.promise;
    }
    refreshCount += 1;
    return refreshCount === 1 ? firstRefresh.promise : secondRefresh.promise;
  });
  const first = useWishlist.getState().removeWishlistItem('product-a');
  const second = useWishlist.getState().removeWishlistItem('product-b');
  firstRemoval.resolve(Response.json({ success: true, userId: 'user-a', message: 'Removed.' }));
  await new Promise(setImmediate);
  assert.equal(refreshCount, 1);
  secondRemoval.resolve(Response.json({ success: true, userId: 'user-a', message: 'Removed.' }));
  await new Promise(setImmediate);
  assert.equal(refreshCount, 2);
  secondRefresh.resolve(Response.json({ ...sample, data: [] }));
  await second;
  firstRefresh.resolve(Response.json({ ...sample, data: [secondProduct] }));
  await first;
  assert.deepEqual(useWishlist.getState().wishlist?.data, []);
});
