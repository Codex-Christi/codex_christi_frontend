// src/lib/hooks/shopHooks/checkout/useDjangoOrderIntentEmailVerification.ts

'use client';

import successToast from '@/lib/success-toast';
import { useVerifiedEmailsStore } from '@/stores/shop_stores/checkoutStore/useVerifiedEmailsStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { useCallback, useState } from 'react';
import errorToast from '@/lib/error-toast';
import {
  DjangoOrderIntentPayload,
  useCreateDjangoOrderIntentMutation,
  useResendDjangoOrderIntentOTPMutation,
  useVerifyDjangoOrderIntentOTPMutation,
} from './djangoOrderIntentMutationHooks';

function getDjangoOrderIntentErrorMessage(error: unknown, fallback: string) {
  const info =
    error && typeof error === 'object' && 'info' in error
      ? (error.info as Record<string, unknown> | null)
      : null;
  const errors = Array.isArray(info?.errors) ? info.errors : [];
  const messages = errors
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const record = entry as Record<string, unknown>;
      const fieldName = typeof record.field_name === 'string' ? record.field_name : null;
      const message = typeof record.message === 'string' ? record.message : null;

      if (fieldName && message) return `${fieldName}: ${message}`;
      return message;
    })
    .filter((message): message is string => Boolean(message));

  if (messages.length) return messages.join(' ');
  if (typeof info?.message === 'string' && info.message) return info.message;
  if (typeof info?.detail === 'string' && info.detail) return info.detail;
  if (error instanceof Error && error.message) return error.message;

  return fallback;
}

export const useDjangoOrderIntentEmailVerification = (
  email: string | undefined,
  openOTPModal: () => void,
) => {
  const {
    trigger,
    data: djangoOrderIntentResp,
    error: mutationError,
    isMutating,
    reset: resetDjangoOrderIntentMutation,
  } = useCreateDjangoOrderIntentMutation();
  const {
    trigger: verifyTrigger,
    data: verifyData,
    error: verifyError,
    isMutating: isVerifying,
    reset: resetVerifyDjangoOrderIntentMutation,
  } = useVerifyDjangoOrderIntentOTPMutation();
  const {
    trigger: resendTrigger,
    data: resendData,
    error: resendError,
    isMutating: isResending,
  } = useResendDjangoOrderIntentOTPMutation();

  const getEmailStatus = useVerifiedEmailsStore((s) => s.getEmailStatus);
  const addEmailToVerifiedList = useVerifiedEmailsStore((s) => s.addEmailToVerifiedList);
  const setDjangoOrderIntent = useDjangoOrderIntentStore((s) => s.setDjangoOrderIntent);
  const storeVerified = email ? getEmailStatus(email) === true : false;
  const [locallyVerifiedEmail, setLocallyVerifiedEmail] = useState<string | null>(null);
  const isEmailVerified = storeVerified || (email ? locallyVerifiedEmail === email : false);

  const createDjangoOrderIntent = useCallback(
    async (payload: DjangoOrderIntentPayload, extraHeaders?: HeadersInit) => {
      if (!payload.email) {
        errorToast({ message: 'No email provided' });
        return;
      }

      if (isMutating) {
        return;
      }

      try {
        setLocallyVerifiedEmail(null);

        const resp = await trigger({ ...payload, headers: extraHeaders });
        const data = resp?.data;
        const otpStatus = data?.otp_status;

        setDjangoOrderIntent({
          djangoOrderIntentUuid: data?.id,
          djangoOrderIntentOrderId: data?.order_id,
          djangoOrderIntentPayload: resp,
          djangoOrderIntentVerifyPayload: otpStatus === 'verified' ? resp : undefined,
          djangoOrderIntentVerifiedAt:
            otpStatus === 'verified' ? new Date().toISOString() : undefined,
        });

        if (otpStatus === 'pending') {
          openOTPModal();
          successToast({
            header: 'OTP Sent - Check your email',
            message: resp.message ?? 'OTP Sent - Check your email',
            duration: 15000,
          });
          return resp;
        } else if (otpStatus === 'verified') {
          setLocallyVerifiedEmail(payload.email);
          addEmailToVerifiedList(payload.email);
          successToast({
            header: 'Email verified',
            message: 'Email already verified. Proceeding to payment...',
          });
          return resp;
        } else if (otpStatus === 'expired') {
          openOTPModal();
          errorToast({
            header: 'Verification code expired',
            message: 'Use Resend to request a fresh checkout verification code.',
          });
          return resp;
        } else {
          openOTPModal();
          successToast({
            header: 'Request Sent',
            message: 'If this email is valid, an OTP will arrive shortly.',
          });
          return resp;
        }
      } catch (err: unknown) {
        const message = getDjangoOrderIntentErrorMessage(
          err,
          mutationError?.message ??
            'An error occurred while creating the order verification intent',
        );
        errorToast({ header: 'Order verification failed', message });
      }
    },
    [addEmailToVerifiedList, isMutating, mutationError, openOTPModal, setDjangoOrderIntent, trigger],
  );

  const triggerVerifyDjangoOrderIntentOTP = useCallback(
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

      if (isVerifying) {
        return;
      }

      try {
        resetVerifyDjangoOrderIntentMutation();

        const resp = await verifyTrigger({ email, otp, order_id });
        const data = resp?.data;
        const otpStatus = data?.otp_status;

        setDjangoOrderIntent({
          djangoOrderIntentUuid: data?.id,
          djangoOrderIntentOrderId: data?.order_id,
          djangoOrderIntentVerifyPayload: resp,
          djangoOrderIntentVerifiedAt:
            otpStatus === 'verified' ? new Date().toISOString() : undefined,
        });

        if (otpStatus === 'verified') {
          successToast({
            header: 'Email verified',
            message: resp.message ?? 'Email successfully verified. Proceeding to payment...',
          });
          setLocallyVerifiedEmail(email);
          addEmailToVerifiedList(email);
          return resp;
        } else {
          errorToast({
            header: 'Email verification failed',
            message: resp.message ?? 'Email verification failed. Please try again.',
          });
        }
      } catch (err: unknown) {
        const message = getDjangoOrderIntentErrorMessage(
          err,
          verifyError?.message ?? 'An error occurred while verifying the OTP',
        );
        errorToast({ header: 'Email verification failed', message });
      }
    },
    [
      isVerifying,
      verifyTrigger,
      verifyError,
      resetVerifyDjangoOrderIntentMutation,
      addEmailToVerifiedList,
      setDjangoOrderIntent,
    ],
  );

  const resendDjangoOrderIntentOTP = useCallback(
    async (email: string | undefined, extraHeaders?: HeadersInit) => {
      if (!email) {
        errorToast({ message: 'No email provided' });
        return;
      }

      if (isResending) {
        return;
      }

      try {
        const resp = await resendTrigger({ email, headers: extraHeaders });

        successToast({
          header: 'OTP Sent - Check your email',
          message: resp.message ?? 'OTP resent. Check your email.',
          duration: 15000,
        });
        return resp;
      } catch (err: unknown) {
        const message = getDjangoOrderIntentErrorMessage(
          err,
          resendError?.message ?? 'An error occurred while resending OTP',
        );
        errorToast({ header: 'OTP resend failed', message });
      }
    },
    [isResending, resendError?.message, resendTrigger],
  );

  return {
    triggerVerifyDjangoOrderIntentOTP,
    resendDjangoOrderIntentOTP,
    verifyData,
    verifyError,
    resendData,
    resendError,
    isVerifying,
    isResending,
    isEmailVerified,
    createDjangoOrderIntent,
    resetDjangoOrderIntentMutation,
    djangoOrderIntentResp,
    djangoOrderIntentError: mutationError,
    isDjangoOrderIntentLoading: isMutating,
  };
};
