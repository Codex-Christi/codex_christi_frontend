// src/lib/hooks/shopHooks/checkout/useVerifyEmailWithOTP.ts

import successToast from '@/lib/success-toast';
import { useVerifiedEmailsStore } from '@/stores/shop_stores/checkoutStore/useVerifiedEmailsStore';
import { useCallback, useEffect, useState } from 'react';
import errorToast from '@/lib/error-toast';
import { useSendFirstCheckoutEmailOTPMutation } from './customMutationHooks';

export const useVerifyEmailWithOTP = (email: string | undefined, openOTPModal: () => void) => {
  const {
    trigger,
    data,
    error: mutationError,
    isMutating,
    reset,
  } = useSendFirstCheckoutEmailOTPMutation();

  const getEmailStatus = useVerifiedEmailsStore((s) => s.getEmailStatus);
  // Derive verified status from store
  const storeVerified = email ? getEmailStatus(email) === true : false;
  // Local state, initially from store
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(storeVerified);

  // Sync local state if store changes
  useEffect(() => {
    setIsEmailVerified(storeVerified);
  }, [storeVerified]);

  //
  const sendInitialOTPToEmail = useCallback(
    async (email: string | undefined, extraHeaders?: HeadersInit) => {
      if (!email) {
        errorToast({ message: 'No email provided' });
        return;
      }

      // Avoid duplicate requests while a send is in flight
      if (isMutating) {
        return;
      }

      if (isEmailVerified) {
        successToast({ header: 'Good news!', message: 'Email already verified...' });
        setIsEmailVerified(true);
        return;
      }

      // Open the popover first so the user sees the OTP UI immediately
      try {
        setIsEmailVerified(false);
        openOTPModal();

        const resp = await trigger({ email, headers: extraHeaders });
        const otpStatus = resp?.data?.otp_status;

        if (otpStatus === 'pending') {
          successToast({
            header: 'OTP Sent - Check your email',
            message: resp.message ?? 'OTP Sent - Check your email',
            duration: 10000,
          });
        } else {
          // Fallback toast when API shape differs or status not pending
          successToast({
            header: 'Request Sent',
            message: 'If this email is valid, an OTP will arrive shortly.',
          });
        }
      } catch (err: unknown) {
        const message =
          (err as Error)?.message ??
          mutationError?.message ??
          'An error occurred while sending the OTP';
        errorToast({ header: 'Email verification failed', message });
      }
    },
    [isEmailVerified, isMutating, mutationError, openOTPModal, trigger],
  );

  return {
    isEmailVerified,
    sendInitialOTPToEmail,
    resetVerificationState: reset,
    data,
    error: mutationError,
    isMutating,
  };
};
