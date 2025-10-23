// hooks/useServerActionWithState.ts
'use client';
import { startTransition, useCallback } from 'react';
import { useActionState } from 'react';

export type ServerActionResult<T> = T | null;

export function useServerActionWithState<Args extends unknown[], Res>(
  serverAction: (...args: Args) => Promise<Res>,
  initial: Awaited<Res> | null = null,
) {
  // `useActionState` is still used for UI-level state management (`result` and `isPending`).
  // The action here is a pass-through to trigger the `useActionState` mechanics.
  const [result, action, isPending] = useActionState<Res | null, Args>(
    async (prev: Res | null, payload: Args) => {
      // We still need to call the server action here to trigger the state update.
      return serverAction(...payload);
    },
    initial,
  );

  // A new `call` wrapper that directly returns the promise result.
  // We use useCallback to ensure referential stability.
  const call = useCallback(
    async (...args: Args) => {
      // Manually trigger the transition for the state update
      // `useActionState`'s action function and `isPending` will still work.
      startTransition(() => {
        // Trigger the `useActionState` action. This will update the `result` and `isPending`
        // for any UI elements that depend on them.
        action(args);
      });

      // Directly call and await the server action to get the synchronous result
      // for chaining promises.
      try {
        const r = await serverAction(...args);
        return r ?? null;
      } catch (err) {
        console.error('Error during server action call:', err);
        // It's good practice to re-throw so the caller can handle it.
        throw err;
      }
    },
    [action, serverAction],
  );

  return { result: result as ServerActionResult<Res>, call, isPending };
}
