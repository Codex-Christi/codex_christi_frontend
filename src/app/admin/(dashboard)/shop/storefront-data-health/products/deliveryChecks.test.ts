import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
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
import { createDeliveryCheckStream, waitForDeliveryWork } from './deliveryCheckStream';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

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

test(
  'cancelled queue settles while an uncancelled customer keeps its shared supplier read',
  { timeout: 1000 },
  async () => {
    const controller = new AbortController();
    const shared = deferred<string>();
    const active = deferred<void>();
    const started: string[] = [];
    const results: string[] = [];
    const customerRead = shared.promise.then((value) => `customer:${value}`);
    const queue = runDeliveryQueue(
      ['a', 'b', 'c', 'd', 'queued'],
      (id) => {
        started.push(id);
        if (started.length === 4) active.resolve();
        return shared.promise;
      },
      (id) => {
        results.push(id);
      },
      controller.signal,
    );
    await active.promise;
    controller.abort();
    await queue;
    assert.deepEqual(started, ['a', 'b', 'c', 'd']);
    assert.deepEqual(results, []);

    shared.resolve('available');
    assert.equal(await customerRead, 'customer:available');
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(started, ['a', 'b', 'c', 'd']);
    assert.deepEqual(results, []);
  },
);

test(
  'a late shared rejection after cancellation does not emit a false failure or become unhandled',
  { timeout: 1000 },
  async () => {
    const controller = new AbortController();
    const shared = deferred<never>();
    const active = deferred<void>();
    let started = 0;
    const results: PromiseSettledResult<never>[] = [];
    const queue = runDeliveryQueue(
      ['a', 'b', 'c', 'd', 'queued'],
      () => {
        if (++started === 4) active.resolve();
        return shared.promise;
      },
      (_id, result) => {
        results.push(result);
      },
      controller.signal,
    );
    await active.promise;
    controller.abort();
    await queue;
    shared.reject(new Error('Late shared supplier failure'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(started, 4);
    assert.deepEqual(results, []);
  },
);

test('delivery waiters remove abort listeners after completion and cancellation', async () => {
  const finished = new AbortController();
  const result = deferred<string>();
  const waiting = waitForDeliveryWork(result.promise, finished.signal);
  assert.equal(getEventListeners(finished.signal, 'abort').length, 1);
  result.resolve('done');
  assert.equal(await waiting, 'done');
  assert.equal(getEventListeners(finished.signal, 'abort').length, 0);

  const cancelled = new AbortController();
  const shared = deferred<string>();
  const stopped = waitForDeliveryWork(shared.promise, cancelled.signal);
  cancelled.abort();
  await assert.rejects(stopped, { name: 'AbortError' });
  assert.equal(getEventListeners(cancelled.signal, 'abort').length, 0);
  shared.resolve('still usable');
  assert.equal(await shared.promise, 'still usable');
});

test(
  'the stream closes at its deadline while shared supplier work and audit persistence remain pending',
  { timeout: 1000 },
  async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const shared = deferred<{ completed: number; failed: number }>();
    const pendingAudit = deferred<void>();
    const audits: Array<{ outcome: string; cancelled: number | boolean }> = [];
    let checkSignal: AbortSignal | undefined;
    const stream = createDeliveryCheckStream({
      requestSignal: new AbortController().signal,
      check: (signal, emit) => {
        checkSignal = signal;
        emit({ type: 'checking', productId: 'p' });
        return shared.promise.then((value) => {
          emit({ type: 'checking', productId: 'late' });
          return value;
        });
      },
      audit: (outcome, metadata) => {
        audits.push({ outcome, cancelled: metadata.cancelled });
        return pendingAudit.promise;
      },
    });
    let closed = false;
    const text = new Response(stream).text().then((value) => {
      closed = true;
      return value;
    });
    t.mock.timers.tick(119_999);
    await Promise.resolve();
    assert.equal(closed, false);
    t.mock.timers.tick(1);
    const events = (await text)
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(checkSignal?.aborted, true);
    assert.deepEqual(events, [
      { type: 'checking', productId: 'p' },
      { type: 'error', message: 'The check timed out. Retry the remaining products.' },
    ]);
    assert.deepEqual(audits, [{ outcome: 'failure', cancelled: true }]);
    shared.resolve({ completed: 1, failed: 0 });
    pendingAudit.resolve();
    await shared.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(audits.length, 1);
  },
);

test(
  'request cancellation closes the stream without an outage result or completion event',
  { timeout: 1000 },
  async () => {
    const request = new AbortController();
    const shared = deferred<{ completed: number; failed: number }>();
    const audits: Array<{ outcome: string; metadata: Record<string, number | boolean> }> = [];
    const result: DeliveryCheckEvent = {
      type: 'result',
      productId: 'complete',
      result: presentDeliveryStatus(
        {
          checkedAt: new Date('2026-10-27T00:00:00.000Z'),
          availableCount: 1,
          unsupportedCount: 0,
          unverifiedCount: 0,
          reason: null,
          completed: true,
          stale: false,
          source: 'catalog',
        },
        'United States',
        0,
        100,
      ),
    };
    const stream = createDeliveryCheckStream({
      requestSignal: request.signal,
      check: (_signal, emit) => {
        emit(result);
        emit({ type: 'checking', productId: 'p' });
        return shared.promise;
      },
      audit: async (outcome, metadata) => {
        audits.push({ outcome, metadata });
      },
    });
    const text = new Response(stream).text();
    request.abort();
    assert.deepEqual(
      (await text)
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
      [result, { type: 'checking', productId: 'p' }],
    );
    assert.deepEqual(audits, [
      { outcome: 'failure', metadata: { completed: 1, failed: 0, cancelled: true } },
    ]);
    shared.reject(new Error('Provider rejected after request cancellation'));
    await new Promise<void>((resolve) => setImmediate(resolve));
  },
);

test(
  'consumer cancellation aborts only the check context and promptly settles the stream',
  { timeout: 1000 },
  async () => {
    const shared = deferred<{ completed: number; failed: number }>();
    let checkSignal: AbortSignal | undefined;
    const audits: Array<{ cancelled: number | boolean }> = [];
    const stream = createDeliveryCheckStream({
      requestSignal: new AbortController().signal,
      check: (signal, emit) => {
        checkSignal = signal;
        emit({ type: 'checking', productId: 'p' });
        return shared.promise;
      },
      audit: async (_outcome, metadata) => {
        audits.push({ cancelled: metadata.cancelled });
      },
    });
    const reader = stream.getReader();
    assert.equal((await reader.read()).done, false);
    await reader.cancel();
    assert.equal(checkSignal?.aborted, true);
    assert.deepEqual(audits, [{ cancelled: true }]);
    shared.resolve({ completed: 1, failed: 0 });
    assert.equal((await shared.promise).completed, 1);
  },
);

test(
  'successful checks close the stream before audit persistence completes',
  { timeout: 1000 },
  async () => {
    const audit = deferred<void>();
    const outcomes: string[] = [];
    const stream = createDeliveryCheckStream({
      requestSignal: new AbortController().signal,
      check: async () => ({ completed: 2, failed: 0 }),
      audit: (outcome) => {
        outcomes.push(outcome);
        return audit.promise;
      },
    });
    assert.equal(await new Response(stream).text(), '{"type":"complete"}\n');
    assert.deepEqual(outcomes, ['success']);
    audit.reject(new Error('Fixture audit storage failure'));
    await new Promise<void>((resolve) => setImmediate(resolve));
  },
);

test('a genuine check failure ends the stream with safe retry wording', async () => {
  const audits: Array<{ outcome: string; cancelled: number | boolean }> = [];
  const stream = createDeliveryCheckStream({
    requestSignal: new AbortController().signal,
    check: async () => {
      throw new Error('Private provider diagnostic');
    },
    audit: async (outcome, metadata) => {
      audits.push({ outcome, cancelled: metadata.cancelled });
    },
  });
  assert.equal(
    await new Response(stream).text(),
    '{"type":"error","message":"The delivery check could not complete. Retry the remaining products."}\n',
  );
  assert.deepEqual(audits, [{ outcome: 'failure', cancelled: false }]);
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
