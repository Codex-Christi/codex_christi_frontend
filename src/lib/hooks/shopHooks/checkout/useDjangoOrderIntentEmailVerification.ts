'use client';

import successToast from '@/lib/success-toast';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { useCallback, useEffect, useRef } from 'react';
import errorToast from '@/lib/error-toast';
import { mergeCheckoutVerification } from './mergeCheckoutVerification';
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

  const setDjangoOrderIntent = useDjangoOrderIntentStore((s) => s.setDjangoOrderIntent);
  const storedUuid = useDjangoOrderIntentStore((s) => s.djangoOrderIntentUuid);
  const latestEmail = useRef(email);
  const requestSequence = useRef(0);
  useEffect(() => {
    latestEmail.current = email;
    return () => {
      requestSequence.current += 1;
    };
  }, [email]);
  const captureRequest = useCallback(() => {
    const sequence = ++requestSequence.current;
    const startedGeneration = useDjangoOrderIntentStore.getState().generation;
    const startedEmail = latestEmail.current;
    return () =>
      sequence === requestSequence.current &&
      startedGeneration === useDjangoOrderIntentStore.getState().generation &&
      latestEmail.current === startedEmail;
  }, []);

  const createDjangoOrderIntent = useCallback(
    async (
      payload: DjangoOrderIntentPayload,
      extraHeaders?: HeadersInit,
      isCurrent?: () => boolean,
    ) => {
      if (!payload.email) {
        errorToast({ message: 'No email provided' });
        return;
      }

      if (isMutating) {
        return;
      }

      const requestCurrent = captureRequest();
      const current = () => requestCurrent() && (!isCurrent || isCurrent());
      try {
        const resp = await trigger({ ...payload, headers: extraHeaders });
        if (!current()) return;
        const data = resp?.data;
        const otpStatus = data?.otp_status;

        setDjangoOrderIntent({
          djangoOrderIntentUuid: data?.id,
          djangoOrderIntentOrderId: data?.order_id,
          djangoOrderIntentPayload: resp,
          djangoOrderIntentVerifyPayload: otpStatus === 'verified' ? resp : null,
          djangoOrderIntentVerifiedAt: otpStatus === 'verified' ? new Date().toISOString() : null,
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
        if (!current()) return;
        const message = getDjangoOrderIntentErrorMessage(
          err,
          mutationError?.message ??
            'An error occurred while creating the order verification intent',
        );
        errorToast({ header: 'Order verification failed', message });
      }
    },
    [
      captureRequest,
      isMutating,
      mutationError,
      openOTPModal,
      setDjangoOrderIntent,
      trigger,
    ],
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

      const current = captureRequest();
      try {
        resetVerifyDjangoOrderIntentMutation();

        const intent = useDjangoOrderIntentStore.getState();
        if (!intent.djangoOrderIntentUuid)
          throw new Error('Submit your contact details before verifying your email.');
        const result = await verifyTrigger({
          email,
          otp,
          order_id,
          intentUuid: intent.djangoOrderIntentUuid,
        });
        if (!current()) return;
        const resp = mergeCheckoutVerification(result, intent.djangoOrderIntentPayload);
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
          return resp;
        } else {
          errorToast({
            header: 'Email verification failed',
            message: resp.message ?? 'Email verification failed. Please try again.',
          });
        }
      } catch (err: unknown) {
        if (!current()) return;
        const message = getDjangoOrderIntentErrorMessage(
          err,
          verifyError?.message ?? 'An error occurred while verifying the OTP',
        );
        errorToast({ header: 'Email verification failed', message });
      }
    },
    [
      isVerifying,
      captureRequest,
      verifyTrigger,
      verifyError,
      resetVerifyDjangoOrderIntentMutation,
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

      const current = captureRequest();
      try {
        const intentUuid = useDjangoOrderIntentStore.getState().djangoOrderIntentUuid;
        if (!intentUuid)
          throw new Error('Submit your contact details before requesting another code.');
        const resp = await resendTrigger({ email, intentUuid, headers: extraHeaders });
        if (!current()) return;

        successToast({
          header: 'OTP Sent - Check your email',
          message: resp.message ?? 'OTP resent. Check your email.',
          duration: 15000,
        });
        return resp;
      } catch (err: unknown) {
        if (!current()) return;
        const message = getDjangoOrderIntentErrorMessage(
          err,
          resendError?.message ?? 'An error occurred while resending OTP',
        );
        errorToast({ header: 'OTP resend failed', message });
      }
    },
    [captureRequest, isResending, resendError?.message, resendTrigger],
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
    createDjangoOrderIntent,
    resetDjangoOrderIntentMutation,
    djangoOrderIntentResp:
      djangoOrderIntentResp?.data.id === storedUuid ? djangoOrderIntentResp : undefined,
    djangoOrderIntentError: mutationError,
    isDjangoOrderIntentLoading: isMutating,
  };
};
