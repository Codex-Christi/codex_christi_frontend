'use client';

import { useRouter } from 'next/navigation';
import { registerAccount } from '@/actions/account/registration';
import { useAuthReturnPath, useAuthRoutes } from '@/components/UI/Auth/AuthRoutesProvider';
import { authFlowUrl } from '@/lib/auth/domain-routing';
import successToast from '@/lib/success-toast';
import { useAuthTask } from './useAuthTask';

export type UserDataSendType = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};
export const useRegularSignUp = () => {
  const task = useAuthTask();
  const router = useRouter();
  const routes = useAuthRoutes();
  const next = useAuthReturnPath();
  const signUp = (input: UserDataSendType) =>
    task.run(
      () => registerAccount(input),
      (result) => {
        successToast({ message: 'Account created. Check your email for a verification code.' });
        router.replace(authFlowUrl(routes.verify, { email: result.email ?? input.email, next }));
      },
    );
  return { ...task, signUp };
};
