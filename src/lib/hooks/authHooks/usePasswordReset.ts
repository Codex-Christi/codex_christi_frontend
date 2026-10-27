'use client';

import { useRouter } from 'next/navigation';
import { requestPasswordCode } from '@/actions/account/registration';
import { resetPasswordAndSignOut } from '@/lib/auth/password-reset-client';
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
      () => resetPasswordAndSignOut(input),
      () => {
        const destination = new URL(
          authFlowUrl(routes.login, { email: input.email, next }),
          window.location.origin,
        );
        destination.searchParams.set('from-password-reset', 'true');
        window.location.replace(`${destination.pathname}${destination.search}`);
      },
    );
  return { ...task, passwordResetOTP, resetPassword };
};
