type Flight = {
  controller: AbortController;
  promise: Promise<unknown>;
  consumers: number;
  settled: boolean;
};

/** Bounded single-flight reads; canceling a subscriber cannot cancel another subscriber. */
export function createBoundedProviderReader() {
  const flights = new Map<string, Flight>();
  const failures = new Map<string, number>();
  const queue: Array<() => void> = [];
  let active = 0;

  async function acquire(signal: AbortSignal) {
    signal.throwIfAborted();
    if (active < 4) {
      active++;
      return;
    }
    if (queue.length >= 64) throw new Error('Supplier verification is busy.');
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      };
      const start = () => {
        cleanup();
        resolve();
      };
      const cancel = (reason: unknown) => {
        const index = queue.indexOf(start);
        if (index >= 0) queue.splice(index, 1);
        cleanup();
        reject(reason);
      };
      const abort = () => cancel(signal.reason);
      const timer = setTimeout(
        () => cancel(new Error('Supplier verification queue timed out.')),
        15_000,
      );
      queue.push(start);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  return async function read<T>(
    key: string,
    request: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    let flight = flights.get(key);
    if (!flight) {
      if ((failures.get(key) ?? 0) > Date.now())
        throw new Error('Supplier verification is cooling down.');
      const controller = new AbortController();
      flight = { controller, consumers: 0, settled: false, promise: Promise.resolve() };
      const current = flight;
      current.promise = (async () => {
        await acquire(controller.signal);
        try {
          controller.signal.throwIfAborted();
          return await request(controller.signal);
        } finally {
          const next = queue.shift();
          if (next) next();
          else active--;
        }
      })()
        .catch((error) => {
          if (!controller.signal.aborted) {
            if (failures.size >= 256) failures.delete(failures.keys().next().value!);
            failures.set(key, Date.now() + 5_000);
          }
          throw error;
        })
        .finally(() => {
          current.settled = true;
          if (flights.get(key) === current) flights.delete(key);
        });
      flights.set(key, current);
    }
    const current = flight;
    return new Promise<T>((resolve, reject) => {
      current.consumers++;
      let finished = false;
      const finish = (callback: () => void) => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener('abort', abort);
        current.consumers--;
        if (!current.consumers && !current.settled) {
          if (flights.get(key) === current) flights.delete(key);
          current.controller.abort(
            new DOMException('No active supplier-read callers.', 'AbortError'),
          );
        }
        callback();
      };
      const abort = () => finish(() => reject(signal?.reason));
      signal?.addEventListener('abort', abort, { once: true });
      current.promise.then(
        (value) => finish(() => resolve(value as T)),
        (error) => finish(() => reject(error)),
      );
      if (signal?.aborted) abort();
    });
  };
}
