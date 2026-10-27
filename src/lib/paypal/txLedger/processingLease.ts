export class ProcessingLeaseLostError extends Error {
  constructor() {
    super('Another worker owns this order. Processing stopped.');
    this.name = 'ProcessingLeaseLostError';
  }
}

export function requireProcessingLease(result: { count: number }) {
  if (result.count !== 1) throw new ProcessingLeaseLostError();
}

type Schedule = (tick: () => void, intervalMs: number) => () => void;
const scheduleHeartbeat: Schedule = (tick, intervalMs) => {
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
};

/** A failed renewal permanently fences this worker, including after a transient DB outage. */
export function startProcessingLease(
  renew: () => Promise<boolean>,
  {
    intervalMs = 60_000,
    schedule = scheduleHeartbeat,
  }: { intervalMs?: number; schedule?: Schedule } = {},
) {
  let lost = false;
  let stopped = false;
  let pending: Promise<void> = Promise.resolve();
  const assertOwned = () => {
    const check = pending.then(async () => {
      if (lost || stopped) throw new ProcessingLeaseLostError();
      try {
        if (!(await renew())) lost = true;
      } catch {
        lost = true;
      }
      if (lost) throw new ProcessingLeaseLostError();
    });
    pending = check.catch(() => {});
    return check;
  };
  const cancel = schedule(() => void assertOwned().catch(() => {}), intervalMs);
  return {
    assertOwned,
    async stop() {
      stopped = true;
      cancel();
      await pending;
    },
  };
}
