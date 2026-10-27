import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchProductOptions, ProductOptionsError } from './productOptions';

const signal = new AbortController().signal;

test('product options use an encoded product/country URL, no-store and the caller signal', async () => {
  const result = await fetchProductOptions(
    'product/1',
    'NGA&other=USA',
    signal,
    async (url, init) => {
      assert.equal(url, '/next-api/shop/products/product%2F1/variants?country=NGA%26other%3DUSA');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.credentials, 'same-origin');
      assert.equal(init?.signal, signal);
      return Response.json({
        data: [],
        countryName: 'Nigeria',
        unavailabilityReason: 'shipping_unavailable',
      });
    },
  );
  assert.equal(result.countryName, 'Nigeria');
  assert.equal(result.unavailabilityReason, 'shipping_unavailable');
  assert.deepEqual(result.data, []);
});

test('a confirmed empty destination is distinct from an incomplete verification', async () => {
  await assert.rejects(
    fetchProductOptions('product-1', 'USA', signal, async () =>
      Response.json({ data: [], verificationIncomplete: true }),
    ),
    (error: unknown) => error instanceof ProductOptionsError && error.retryable,
  );
  const result = await fetchProductOptions('product-1', 'USA', signal, async () =>
    Response.json({
      data: [{ _id: 'verified-option' }],
      verificationIncomplete: true,
    }),
  );
  assert.equal(result.data.length, 1);
  assert.equal(result.verificationIncomplete, true);
});

test('only transient HTTP errors qualify for an automatic retry', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    await assert.rejects(
      fetchProductOptions('product-1', 'USA', signal, async () =>
        Response.json({ error: 'Please try again.' }, { status }),
      ),
      (error: unknown) =>
        error instanceof ProductOptionsError &&
        error.message === 'Please try again.' &&
        error.retryable === (status === 429 || status >= 500),
    );
  }
});

test('malformed success responses cannot enable option selection', async () => {
  for (const payload of [null, [], {}, { data: null }, { data: 'not options' }]) {
    await assert.rejects(
      fetchProductOptions('product-1', 'USA', signal, async () => Response.json(payload)),
      ProductOptionsError,
    );
  }
});

test('an HTML error page retains its HTTP retry policy', async () => {
  for (const status of [404, 503]) {
    await assert.rejects(
      fetchProductOptions(
        'product-1',
        'USA',
        signal,
        async () => new Response('<html>Unavailable</html>', { status }),
      ),
      (error: unknown) =>
        error instanceof ProductOptionsError && error.retryable === (status === 503),
    );
  }
});

test('aborting a response read is not converted into a new retryable error', async () => {
  const controller = new AbortController();
  const cancelled = new Error('Request cancelled');
  await assert.rejects(
    fetchProductOptions(
      'product-1',
      'USA',
      controller.signal,
      async () =>
        ({
          ok: true,
          json: async () => {
            controller.abort();
            throw cancelled;
          },
        }) as unknown as Response,
    ),
    (error: unknown) => error === cancelled,
  );
});
