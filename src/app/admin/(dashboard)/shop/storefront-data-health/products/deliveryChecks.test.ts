import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deliveryCheckInputSchema,
  runDeliveryQueue,
  isSameOriginDeliveryRequest,
} from './deliveryChecks';
import {
  presentDeliveryStatus,
  readDeliveryCheckEvents,
  requestDeliveryChecks,
  type DeliveryCheckEvent,
} from './deliveryStatus';

test('the delivery queue covers products across pages with at most four active checks', async () => {
  const ids = Array.from({ length: 29 }, (_, index) => `product-${index}`);
  let active = 0;
  let maximum = 0;
  const completed = new Set<string>();
  await runDeliveryQueue(
    ids,
    async (id) => {
      maximum = Math.max(maximum, ++active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active -= 1;
      if (id === 'product-7') throw Error('Fixture provider outage');
      return id;
    },
    (id, result) => {
      completed.add(id);
      assert.equal(result.status, id === 'product-7' ? 'rejected' : 'fulfilled');
    },
    new AbortController().signal,
  );
  assert.equal(maximum, 4);
  assert.equal(completed.size, ids.length);
});

test('cancellation stops queued delivery checks and suppresses late updates', async () => {
  const controller = new AbortController();
  const started: string[] = [];
  const completed: string[] = [];
  await runDeliveryQueue(
    Array.from({ length: 20 }, (_, i) => String(i)),
    async (id) => {
      started.push(id);
      await new Promise<void>((resolve) => setImmediate(resolve));
      controller.abort();
    },
    (id) => {
      completed.push(id);
    },
    controller.signal,
  );
  assert.equal(started.length, 4);
  assert.deepEqual(completed, []);
});

test('delivery input bounds work, requires valid ISO3 countries, and does not force renewal by default', () => {
  assert.equal(deliveryCheckInputSchema.parse({ productIds: ['p'], country: 'NGA' }).force, false);
  for (const country of ['NG', 'invalid', 'ZZZ'])
    assert.equal(deliveryCheckInputSchema.safeParse({ productIds: ['p'], country }).success, false);
  assert.equal(
    deliveryCheckInputSchema.safeParse({ productIds: [], country: 'USA' }).success,
    false,
  );
  assert.equal(
    deliveryCheckInputSchema.safeParse({ productIds: Array(101).fill('p'), country: 'USA' })
      .success,
    false,
  );
});

test('delivery requests reject cross-origin calls before authentication or provider work', async () => {
  const cases: Record<string, string>[] = [
    {},
    { origin: 'https://other.example' },
    { origin: 'http://localhost:3001' },
    { origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' },
  ];
  for (const headers of cases) {
    const allowed = isSameOriginDeliveryRequest(
      new Request('http://localhost:3000/admin/shop/storefront-data-health/products/check', {
        method: 'POST',
        headers,
      }),
    );
    assert.equal(allowed, false);
  }
  assert.equal(
    isSameOriginDeliveryRequest(
      new Request('http://localhost:3000/admin/shop/storefront-data-health/products/check', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
      }),
    ),
    true,
  );
  assert.equal(
    isSameOriginDeliveryRequest(
      new Request('http://app:3000/admin/shop/storefront-data-health/products/check', {
        method: 'POST',
        headers: { origin: 'https://codexchristi.org', 'x-forwarded-host': 'codexchristi.org' },
      }),
    ),
    true,
  );
});

function streamedResponse(text: string, size = 3) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(output) {
        for (let offset = 0; offset < bytes.length; offset += size)
          output.enqueue(bytes.slice(offset, offset + size));
        output.close();
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } },
  );
}

test('delivery events arrive progressively despite arbitrary UTF-8 and line chunk boundaries', async () => {
  const events: DeliveryCheckEvent[] = [
    { type: 'checking', productId: 'p' },
    {
      type: 'result',
      productId: 'p',
      result: presentDeliveryStatus(undefined, 'Côte d’Ivoire', 2, 48 * 3_600_000),
    },
    { type: 'complete' },
  ];
  const received: DeliveryCheckEvent[] = [];
  await readDeliveryCheckEvents(
    streamedResponse(events.map((event) => JSON.stringify(event)).join('\n') + '\n'),
    (event) => received.push(event),
  );
  assert.deepEqual(received, events);
});

test('interrupted, unauthorized, and failed streams do not appear complete', async () => {
  await assert.rejects(
    () => readDeliveryCheckEvents(new Response(null, { status: 403 }), () => {}),
    /Unlock/,
  );
  await assert.rejects(
    () =>
      readDeliveryCheckEvents(streamedResponse('{"type":"checking","productId":"p"}\n'), () => {}),
    /interrupted/,
  );
  await assert.rejects(
    () =>
      readDeliveryCheckEvents(
        streamedResponse('{"type":"error","message":"Retry remaining"}\n'),
        () => {},
      ),
    /Retry remaining/,
  );
});

test('fresh local delivery evidence is reused, while missing, legacy, failed, and stale evidence renews automatically', () => {
  const check = {
    checkedAt: new Date(),
    availableCount: 3,
    unsupportedCount: 0,
    unverifiedCount: 0,
    reason: null,
    completed: true,
    stale: false,
    source: 'catalog' as const,
  };
  assert.equal(presentDeliveryStatus(check, 'Nigeria', 0, 100).requiresCheck, false);
  assert.equal(
    presentDeliveryStatus(
      { ...check, reason: 'shipping_unavailable', availableCount: 0, unsupportedCount: 3 },
      'Nigeria',
      0,
      100,
    ).requiresCheck,
    false,
  );
  for (const value of [
    undefined,
    { ...check, source: 'live' as const },
    { ...check, stale: true },
    { ...check, completed: false },
    { ...check, unverifiedCount: 1 },
  ])
    assert.equal(presentDeliveryStatus(value, 'Nigeria', 0, 100).requiresCheck, true);
});

test('large delivery selections use bounded sequential requests without per-product authentication calls', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const sizes: number[] = [];
  globalThis.fetch = (async (_input, init) => {
    const input = JSON.parse(String(init?.body));
    sizes.push(input.productIds.length);
    assert.equal(init?.credentials, 'same-origin');
    assert.equal(input.country, 'NGA');
    assert.equal(input.force, false);
    return streamedResponse('{"type":"complete"}\n');
  }) as typeof fetch;
  await requestDeliveryChecks(
    '/admin/check',
    Array.from({ length: 205 }, (_, i) => String(i)),
    'NGA',
    false,
    new AbortController().signal,
    () => {},
  );
  assert.deepEqual(sizes, [100, 100, 5]);
});

test('cancelling a multi-request selection prevents subsequent batches', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    controller.abort();
    return streamedResponse('{"type":"complete"}\n');
  }) as typeof fetch;
  await assert.rejects(
    () =>
      requestDeliveryChecks(
        '/admin/check',
        Array(205).fill('p'),
        'USA',
        false,
        controller.signal,
        () => {},
      ),
    { name: 'AbortError' },
  );
  assert.equal(calls, 1);
});
