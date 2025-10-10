// src/lib/hooks/shopHooks/checkout/useVerifyEmailWithOTP.ts

import successToast from '@/lib/success-toast';
import { useVerifiedEmailsStore } from '@/stores/shop_stores/checkoutStore/useVerifiedEmailsStore';
import { useCallback, useEffect, useState } from 'react';
import errorToast from '@/lib/error-toast';
import { useSendFirstCheckoutEmailOTPMutation } from './customMutationHooks';

export const useVerifyEmailWithOTP = (email: string | undefined) => {
  const { trigger, data, error, isMutating, reset } = useSendFirstCheckoutEmailOTPMutation();

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
    (email: string | undefined, extraHeaders?: HeadersInit) => {
      if (!email) {
        errorToast({ message: 'No email provided' });
        return;
      } else {
        if (!isEmailVerified) {
          setIsEmailVerified(false);

          trigger({ email, headers: extraHeaders })
            .then((resp) => {
              const {
                data: { id, otp_status },
              } = resp;
              console.log(id);

              if (otp_status === 'pending') {
                successToast({ header: 'OTP Sent', message: 'Check your email.' });
              }
            })
            .catch((err: typeof error) => {
              errorToast({
                header: 'Email verification failed',
                message: err ? err.message : error ? error.message : 'Error occured',
              });
            });
        } else {
          successToast({ header: 'Good news!', message: 'Email already verified...' });
          setIsEmailVerified(true);
        }
      }
    },
    [error, isEmailVerified, trigger],
  );

  return {
    isEmailVerified,
    sendInitialOTPToEmail,
    resetVerificationState: reset,
    data,
    error,
    isMutating,
  };
};
