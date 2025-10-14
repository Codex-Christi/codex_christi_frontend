// src/lib/hooks/shopHooks/checkout/useVerifyEmailWithOTP.ts

'use client';

import successToast from '@/lib/success-toast';
import { useVerifiedEmailsStore } from '@/stores/shop_stores/checkoutStore/useVerifiedEmailsStore';
import { useCallback, useEffect, useState } from 'react';
import errorToast from '@/lib/error-toast';
import {
  useSendFirstCheckoutEmailOTPMutation,
  useVerifySentEmailOTPMutation,
} from './customMutationHooks';

export const useVerifyEmailWithOTP = (email: string | undefined, openOTPModal: () => void) => {
  const {
    trigger,
    data: initialOTPSendResp,
    error: mutationError,
    isMutating,
    reset: resetInitialOTPMutation,
  } = useSendFirstCheckoutEmailOTPMutation();
  const {
    trigger: verifyTrigger,
    data: verifyData,
    error: verifyError,
    isMutating: isVerifying,
  } = useVerifySentEmailOTPMutation();

  const getEmailStatus = useVerifiedEmailsStore((s) => s.getEmailStatus);
  const addEmailToVerifiedList = useVerifiedEmailsStore((s) => s.addEmailToVerifiedList);
  // Derive verified status from store
  const storeVerified = email ? getEmailStatus(email) === true : false;
  // Local state, initially from store
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(storeVerified);

  // Sync local state if store changes
  useEffect(() => {
    setIsEmailVerified(storeVerified);
  }, [storeVerified]);

  //  first mutation to send OTP to email
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
        const order_id = resp?.data?.order_id;
        const ORDString = `ORD-${order_id}`;

        if (otpStatus === 'pending') {
          successToast({
            header: 'OTP Sent - Check your email',
            message: resp.message ?? 'OTP Sent - Check your email',
            duration: 15000,
          });

          return ORDString;
        } else if (otpStatus === 'verified') {
          successToast({
            header: 'Email verified',
            message: 'Email already verified. Proceeding to payment...',
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

  // 2nd mutation to verify the OTP entered by user
  const triggerVerifySentOTP = useCallback(
    async ({
      otp,
      order_id,
      email,
    }: {
      otp: string;
      order_id: string;
      email: string | undefined;
    }) => {
      if (!email) {
        errorToast({ message: 'No email provided' });
        return;
      }
      if (!otp || otp.length < 6) {
        errorToast({ message: 'Please enter a valid 6-digit OTP' });
        return;
      }

      // Avoid duplicate requests while a verify is in flight
      if (isVerifying) {
        return;
      }

      try {
        const resp = await verifyTrigger({ email, otp, order_id });
        const otpStatus = resp?.data?.otp_status;

        if (otpStatus === 'verified') {
          successToast({
            header: 'Email verified',
            message: resp.message ?? 'Email successfully verified. Proceeding to payment...',
          });
          setIsEmailVerified(true);
          addEmailToVerifiedList(email);
          return resp;
        } else {
          errorToast({
            header: 'Email verification failed',
            message: resp.message ?? 'Email verification failed. Please try again.',
          });
        }
      } catch (err: unknown) {
        const message =
          (err as Error)?.message ??
          mutationError?.message ??
          'An error occurred while verifying the OTP';
        errorToast({ header: 'Email verification failed', message });
      }
    },
    [isVerifying, mutationError, verifyTrigger, addEmailToVerifiedList],
  );

  return {
    triggerVerifySentOTP,
    verifyData,
    verifyError,
    isVerifying,
    isEmailVerified,
    sendInitialOTPToEmail,
    resetInitialOTPMutation,
    initialOTPSendResp,
    initialOTPSendError: mutationError,
    isInitialSendLoading: isMutating,
  };
};
