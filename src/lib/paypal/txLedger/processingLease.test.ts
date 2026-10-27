import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProcessingLeaseLostError,
  requireProcessingLease,
  startProcessingLease,
} from './processingLease';

function scheduler() {
  let tick: (() => void) | undefined;
  let cancelled = false;
  return {
    schedule: (callback: () => void) => {
      tick = callback;
      return () => {
        cancelled = true;
      };
    },
    beat: () => tick?.(),
    cancelled: () => cancelled,
  };
}

test('heartbeats and stage checks renew the same lease and stop cleanly', async () => {
  const timer = scheduler();
  let renewals = 0;
  const lease = startProcessingLease(
    async () => {
      renewals++;
      return true;
    },
    { schedule: timer.schedule },
  );
  await lease.assertOwned();
  timer.beat();
  await lease.assertOwned();
  assert.equal(renewals, 3);
  await lease.stop();
  assert.equal(timer.cancelled(), true);
  await assert.rejects(lease.assertOwned(), ProcessingLeaseLostError);
  assert.equal(renewals, 3);
});

test('a worker that loses its lock cannot resume side effects even if storage recovers', async () => {
  const timer = scheduler();
  let owns = true;
  const lease = startProcessingLease(async () => owns, { schedule: timer.schedule });
  await lease.assertOwned();
  owns = false;
  timer.beat();
  await assert.rejects(lease.assertOwned(), ProcessingLeaseLostError);
  owns = true;
  let sent = false;
  await assert.rejects(async () => {
    await lease.assertOwned();
    sent = true;
  }, ProcessingLeaseLostError);
  assert.equal(sent, false);
  await lease.stop();
});

test('a failed renewal fences the worker and conditional checkpoints require ownership', async () => {
  const timer = scheduler();
  const lease = startProcessingLease(
    async () => {
      throw new Error('Database unavailable');
    },
    { schedule: timer.schedule },
  );
  await assert.rejects(lease.assertOwned(), ProcessingLeaseLostError);
  assert.throws(() => requireProcessingLease({ count: 0 }), ProcessingLeaseLostError);
  assert.doesNotThrow(() => requireProcessingLease({ count: 1 }));
  await lease.stop();
});

test('lease checks serialize and stopping waits for an in-flight renewal', async () => {
  const timer = scheduler();
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let active = 0;
  let overlapping = false;
  const lease = startProcessingLease(
    async () => {
      if (++active > 1) overlapping = true;
      await waiting;
      active--;
      return true;
    },
    { schedule: timer.schedule },
  );
  const check = lease.assertOwned();
  await Promise.resolve();
  timer.beat();
  const stopping = lease.stop();
  finish();
  await check;
  await stopping;
  assert.equal(overlapping, false);
  assert.equal(active, 0);
});
