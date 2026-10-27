import type { DeliveryCheckEvent } from './deliveryStatus';

/** Stop waiting without cancelling supplier work that may serve another customer. */
export function waitForDeliveryWork<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', aborted);
    const aborted = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener('abort', aborted, { once: true });
    // Keep both handlers attached after cancellation so a late rejection is still handled.
    work.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (reason) => {
        cleanup();
        reject(reason);
      },
    );
    if (signal.aborted) aborted();
  });
}

type DeliveryCheckSummary = { completed: number; failed: number };

export function createDeliveryCheckStream({
  requestSignal,
  check,
  audit,
  timeoutMs = 120_000,
}: {
  requestSignal: AbortSignal;
  check: (
    signal: AbortSignal,
    emit: (event: DeliveryCheckEvent) => void,
  ) => Promise<DeliveryCheckSummary>;
  audit: (
    outcome: 'success' | 'failure',
    metadata: Record<string, number | boolean>,
  ) => Promise<unknown>;
  timeoutMs?: number;
}) {
  const consumer = new AbortController();
  const deadline = new AbortController();
  const signal = AbortSignal.any([requestSignal, consumer.signal, deadline.signal]);
  const timer = setTimeout(() => deadline.abort(), timeoutMs);
  const encoder = new TextEncoder();
  let closed = false;

  return new ReadableStream<Uint8Array>({
    async start(output) {
      const progress: DeliveryCheckSummary = { completed: 0, failed: 0 };
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', aborted);
        // A consumer cancellation has already closed the stream itself.
        if (!consumer.signal.aborted) output.close();
      };
      const emit = (event: DeliveryCheckEvent) => {
        if (!closed && !signal.aborted) {
          if (event.type === 'result') {
            progress.completed += 1;
            if (event.result.requiresCheck) progress.failed += 1;
          }
          output.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      };
      const aborted = () => {
        if (closed) return;
        if (deadline.signal.aborted && !requestSignal.aborted && !consumer.signal.aborted)
          output.enqueue(
            encoder.encode(
              `${JSON.stringify({ type: 'error', message: 'The check timed out. Retry the remaining products.' })}\n`,
            ),
          );
        close();
      };
      signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) aborted();

      let outcome: 'success' | 'failure' = 'failure';
      let summary: DeliveryCheckSummary | undefined;
      try {
        signal.throwIfAborted();
        summary = await waitForDeliveryWork(check(signal, emit), signal);
        if (!signal.aborted) {
          emit({ type: 'complete' });
          outcome = summary.failed ? 'failure' : 'success';
        }
      } catch {
        emit({
          type: 'error',
          message: 'The delivery check could not complete. Retry the remaining products.',
        });
      } finally {
        // Audit persistence must not hold the response open after success or cancellation.
        close();
        await audit(outcome, { ...(summary ?? progress), cancelled: signal.aborted }).catch(
          () => undefined,
        );
      }
    },
    cancel() {
      consumer.abort();
    },
  });
}
