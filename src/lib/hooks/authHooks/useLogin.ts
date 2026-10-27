'use client';

import { useRouter } from 'next/navigation';
import { loginUser } from '@/actions/login';
import { useAuthReturnPath, useAuthRoutes } from '@/components/UI/Auth/AuthRoutesProvider';
import {
  clearPrivateClientState,
  isGuestSession,
  publishSessionChange,
} from '@/lib/auth/client-session';
import useAuthStore from '@/stores/authStore';
import successToast from '@/lib/success-toast';
import { useAuthTask } from './useAuthTask';

export const useLogin = () => {
  const task = useAuthTask();
  const routes = useAuthRoutes();
  const next = useAuthReturnPath();
  const router = useRouter();
  const login = (input: { email: string; password: string }) => {
    const wasGuest = isGuestSession(useAuthStore.getState());
    return task.run(
      () => loginUser(input),
      async (result) => {
        const currentOwner = useAuthStore.getState().accountOwnerId;
        await clearPrivateClientState({
          preserveGuestCheckout:
            wasGuest && (!currentOwner || currentOwner === result.sessionState.user_id),
        });
        useAuthStore.getState().setSessionState(result.sessionState);
        publishSessionChange('login');
        successToast({ message: 'Signed in successfully.' });
        router.replace(next ?? routes.account);
        router.refresh();
      },
    );
  };
  return { ...task, login };
};
