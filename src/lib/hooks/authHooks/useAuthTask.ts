'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import loadingToast from '@/lib/loading-toast';
import errorToast from '@/lib/error-toast';

type Result = { success: true } | { success: false; error: string };

export function useAuthTask() {
  const busy = useRef(false);
  const [state, setState] = useState({ isLoading: false, isError: false, errorMsg: '' });
  const run = useCallback(
    async <T extends Result>(
      task: () => Promise<T>,
      onSuccess?: (result: Extract<T, { success: true }>) => void | Promise<void>,
    ) => {
      if (busy.current) return null;
      busy.current = true;
      setState({ isLoading: true, isError: false, errorMsg: '' });
      const id = loadingToast({ message: 'Please wait a moment...' });
      try {
        const result = await task();
        if (!result.success) throw new Error(result.error);
        await onSuccess?.(result as Extract<T, { success: true }>);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Please try again.';
        setState({ isLoading: false, isError: true, errorMsg: message });
        errorToast({ message });
        return null;
      } finally {
        toast.dismiss(id);
        busy.current = false;
        setState((previous) => ({ ...previous, isLoading: false }));
      }
    },
    [],
  );
  return { ...state, run };
}
