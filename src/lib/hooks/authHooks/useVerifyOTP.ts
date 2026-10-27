'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  verifyAccountCode,
  resendAccountCode,
  requestPasswordCode,
} from '@/actions/account/registration';
import { useAuthReturnPath, useAuthRoutes } from '@/components/UI/Auth/AuthRoutesProvider';
import { authFlowUrl } from '@/lib/auth/domain-routing';
import successToast from '@/lib/success-toast';
import { useAuthTask } from './useAuthTask';

export const useVerifyOTP = () => {
  const task = useAuthTask();
  const router = useRouter();
  const routes = useAuthRoutes();
  const next = useAuthReturnPath();
  const verifyOTP = (input: { email: string; otp: string }) =>
    task.run(
      () => verifyAccountCode(input),
      () => {
        successToast({ message: 'Email verified. Sign in to continue.' });
        router.replace(
          authFlowUrl(routes.login, {
            email: input.email,
            next,
          }),
        );
      },
    );
  return { ...task, verifyOTP };
};

export const useResendOTP = (purpose: 'account' | 'password-reset' = 'account') => {
  const task = useAuthTask();
  const [retryIn, setRetryIn] = useState(0);
  useEffect(() => {
    if (!retryIn) return;
    const timer = window.setTimeout(() => setRetryIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryIn]);
  const resendOTP = (input: { email: string }) => {
    if (retryIn) return Promise.resolve(null);
    return task.run(
      () => (purpose === 'password-reset' ? requestPasswordCode(input) : resendAccountCode(input)),
      () => {
        setRetryIn(30);
        successToast({ message: 'If an account exists, a code has been sent.' });
      },
    );
  };
  return { ...task, retryIn, resendOTP };
};
