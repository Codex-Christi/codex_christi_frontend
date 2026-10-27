'use client';

import { useRouter } from 'next/navigation';
import { requestPasswordCode, resetAccountPassword } from '@/actions/account/registration';
import { useAuthReturnPath, useAuthRoutes } from '@/components/UI/Auth/AuthRoutesProvider';
import { authFlowUrl } from '@/lib/auth/domain-routing';
import successToast from '@/lib/success-toast';
import { useAuthTask } from './useAuthTask';

export const usePasswordReset = () => {
  const task = useAuthTask();
  const router = useRouter();
  const routes = useAuthRoutes();
  const next = useAuthReturnPath();
  const passwordResetOTP = (input: { email: string }) =>
    task.run(
      () => requestPasswordCode(input),
      () => {
        successToast({ message: 'If an account exists, a reset code has been sent.' });
        router.replace(authFlowUrl(routes.reset, { email: input.email, next }));
      },
    );
  const resetPassword = (input: { email: string; otp: string; password: string }) =>
    task.run(
      () => resetAccountPassword(input),
      () => {
        successToast({ message: 'Password changed. Sign in with your new password.' });
        router.replace(authFlowUrl(routes.login, { email: input.email, next }));
      },
    );
  return { ...task, passwordResetOTP, resetPassword };
};
