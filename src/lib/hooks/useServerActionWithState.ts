// hooks/useServerActionWithState.ts
'use client';

import { startTransition, useCallback, useRef } from 'react';
import { useActionState } from 'react';

export type ServerActionResult<T> = T | null;

/**
 * Calls the server action ONCE per invocation.
 * - `result` and `isPending` come from useActionState.
 * - `call(...)` returns a Promise<Res | null> that resolves when the reducer completes.
 */
export function useServerActionWithState<Args extends unknown[], Res>(
  serverAction: (...args: Args) => Promise<Res>,
  initial: Awaited<Res> | null = null,
) {
  // Refs to resolve/reject the promise returned by `call(...)`
  const resolveRef = useRef<((v: ServerActionResult<Res>) => void) | null>(null);
  const rejectRef = useRef<((e: unknown) => void) | null>(null);

  const [result, action, isPending] = useActionState<ServerActionResult<Res>, Args>(
    async (_prev, payload) => {
      try {
        const out = await serverAction(...payload);
        // resolve the pending promise (if any)
        resolveRef.current?.(out ?? null);
        resolveRef.current = null;
        rejectRef.current = null;
        return out ?? null;
      } catch (err) {
        // reject the pending promise (if any)
        rejectRef.current?.(err);
        resolveRef.current = null;
        rejectRef.current = null;
        // keep previous result on error (or return null if you prefer)
        return _prev;
      }
    },
    initial,
  );

  const call = useCallback(
    (...args: Args) =>
      new Promise<ServerActionResult<Res>>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;

        // Drive UI state (result/isPending) via useActionState
        startTransition(() => {
          action(args); // <- this triggers the reducer above (which calls serverAction ONCE)
        });
      }),
    [action],
  );

  return { result, call, isPending };
}
