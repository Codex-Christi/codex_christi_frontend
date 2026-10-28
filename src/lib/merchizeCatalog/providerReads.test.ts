import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoundedProviderReader } from './providerReads';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('canceling one subscriber leaves another subscriber and the shared request alive', async () => {
  const read = createBoundedProviderReader();
  const first = new AbortController();
  const response = deferred<string>();
  let signal!: AbortSignal;
  let calls = 0;
  const request = (value: AbortSignal) => {
    calls++;
    signal = value;
    return response.promise;
  };
  const a = read('product', request, first.signal);
  const b = read('product', request);
  await Promise.resolve();
  first.abort();
  await assert.rejects(a, { name: 'AbortError' });
  assert.equal(signal.aborted, false);
  response.resolve('verified');
  assert.equal(await b, 'verified');
  assert.equal(calls, 1);
});

test('canceling the last subscriber stops upstream and does not poison a subsequent request', async () => {
  const read = createBoundedProviderReader();
  const controller = new AbortController();
  const started = deferred<void>();
  let signal!: AbortSignal;
  const result = read(
    'product',
    (value) => {
      signal = value;
      started.resolve();
      return new Promise<string>((_resolve, reject) =>
        value.addEventListener('abort', () => reject(value.reason), { once: true }),
      );
    },
    controller.signal,
  );
  await started.promise;
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(signal.aborted, true);
  assert.equal(await read('product', async () => 'fresh'), 'fresh');
});

test('queued cancellation removes its request without using a slot or starting provider work', async () => {
  const read = createBoundedProviderReader();
  const response = deferred<string>();
  let active = 0;
  const held = Array.from({ length: 4 }, (_, i) =>
    read(String(i), async () => {
      active++;
      return response.promise;
    }),
  );
  await Promise.resolve();
  assert.equal(active, 4);
  const controller = new AbortController();
  const queued = read(
    'queued',
    async () => {
      assert.fail('Canceled queued request must not start');
    },
    controller.signal,
  );
  controller.abort();
  await assert.rejects(queued, { name: 'AbortError' });
  response.resolve('done');
  await Promise.all(held);
  assert.equal(await read('next', async () => 'ready'), 'ready');
});

test('a real provider failure still shares the existing cooldown policy', async () => {
  const read = createBoundedProviderReader();
  await assert.rejects(
    read('failure', async () => {
      throw new Error('provider down');
    }),
    /provider down/,
  );
  await assert.rejects(
    read('failure', async () => 'not called'),
    /cooling down/,
  );
});

test('a pre-aborted caller creates no provider request', async () => {
  const read = createBoundedProviderReader();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    read('none', async () => assert.fail('No request expected'), controller.signal),
    { name: 'AbortError' },
  );
});

test('queued reads keep their deadline and release their timer and slot on timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => t.mock.timers.reset());
  const read = createBoundedProviderReader();
  const response = deferred<string>();
  const held = Array.from({ length: 4 }, (_, i) => read(String(i), async () => response.promise));
  const queued = read('queued', async () => assert.fail('Timed-out request must not start'));
  const rejected = assert.rejects(queued, /queue timed out/);
  t.mock.timers.tick(15_000);
  await rejected;
  response.resolve('done');
  await Promise.all(held);
  assert.equal(await read('after timeout', async () => 'ready'), 'ready');
});
