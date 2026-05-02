// src/lib/hooks/shopHooks/checkout/useVerifyBackendOrderIntentWithOTP.ts

'use client';

import successToast from '@/lib/success-toast';
import { useVerifiedEmailsStore } from '@/stores/shop_stores/checkoutStore/useVerifiedEmailsStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { useCallback, useState } from 'react';
import errorToast from '@/lib/error-toast';
import {
  BackendOrderIntentPayload,
  useCreateBackendOrderIntentMutation,
  useResendBackendOrderIntentOTPMutation,
  useVerifyBackendOrderIntentOTPMutation,
} from './backendOrderIntentMutationHooks';

export const useVerifyBackendOrderIntentWithOTP = (
  email: string | undefined,
  openOTPModal: () => void,
) => {
  const {
    trigger,
    data: backendOrderIntentResp,
    error: mutationError,
    isMutating,
    reset: resetBackendOrderIntentMutation,
  } = useCreateBackendOrderIntentMutation();
  const {
    trigger: verifyTrigger,
    data: verifyData,
    error: verifyError,
    isMutating: isVerifying,
  } = useVerifyBackendOrderIntentOTPMutation();
  const {
    trigger: resendTrigger,
    data: resendData,
    error: resendError,
    isMutating: isResending,
  } = useResendBackendOrderIntentOTPMutation();

  const getEmailStatus = useVerifiedEmailsStore((s) => s.getEmailStatus);
  const addEmailToVerifiedList = useVerifiedEmailsStore((s) => s.addEmailToVerifiedList);
  const setDjangoOrderIntent = useDjangoOrderIntentStore((s) => s.setDjangoOrderIntent);
  const storeVerified = email ? getEmailStatus(email) === true : false;
  const [locallyVerifiedEmail, setLocallyVerifiedEmail] = useState<string | null>(null);
  const isEmailVerified = storeVerified || (email ? locallyVerifiedEmail === email : false);

  const createBackendOrderIntent = useCallback(
    async (payload: BackendOrderIntentPayload, extraHeaders?: HeadersInit) => {
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

        // Dev probe: compare id/order_id/address/date_updated across repeated UI submissions.
        console.log('[backend-order-intent.create.response]', {
          id: data?.id,
          order_id: data?.order_id,
          email: data?.email,
          address: data?.address,
          address_2: data?.address_2,
          city: data?.city,
          state: data?.state,
          zip_code: data?.zip_code,
          country: data?.country,
          otp_status: data?.otp_status,
          has_pending_otp: data?.has_pending_otp,
          otp_time_remaining: data?.otp_time_remaining,
          otp_expires_at: data?.otp_expires_at,
          date_created: data?.date_created,
          date_updated: data?.date_updated,
        });

        setDjangoOrderIntent({
          djangoOrderIntentUuid: data?.id,
          djangoOrderIntentOrderId: data?.order_id,
          djangoOrderIntentPayload: resp,
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
        } else {
          openOTPModal();
          successToast({
            header: 'Request Sent',
            message: 'If this email is valid, an OTP will arrive shortly.',
          });
          return resp;
        }
      } catch (err: unknown) {
        const message =
          (err as Error)?.message ??
          mutationError?.message ??
          'An error occurred while creating the order verification intent';
        errorToast({ header: 'Order verification failed', message });
      }
    },
    [addEmailToVerifiedList, isMutating, mutationError, openOTPModal, setDjangoOrderIntent, trigger],
  );

  const triggerVerifyBackendOrderIntentOTP = useCallback(
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

      if (verifyError) {
        const errorsArr = Array.isArray(verifyError.info?.errors)
          ? (verifyError.info.errors as { code: string; message: string }[])
          : [];
        if (errorsArr[0]) {
          const error = errorsArr[0];
          errorToast({ header: 'OTP Verification failed', message: error.message });
          return;
        }

        errorToast({ message: verifyError.message ?? 'An error occurred during verification' });
        return;
      }

      try {
        const resp = await verifyTrigger({ email, otp, order_id });
        const data = resp?.data;
        const otpStatus = data?.otp_status;

        // Dev probe: this is the verified Django intent that should later link to PayPal ledger.
        console.log('[backend-order-intent.verify.response]', {
          id: data?.id,
          order_id: data?.order_id,
          email: data?.email,
          address: data?.address,
          address_2: data?.address_2,
          city: data?.city,
          state: data?.state,
          zip_code: data?.zip_code,
          country: data?.country,
          otp_status: data?.otp_status,
          has_pending_otp: data?.has_pending_otp,
          otp_expires_at: data?.otp_expires_at,
          date_created: data?.date_created,
          date_updated: data?.date_updated,
        });

        setDjangoOrderIntent({
          djangoOrderIntentUuid: data?.id,
          djangoOrderIntentOrderId: data?.order_id,
          djangoOrderIntentVerifyPayload: resp,
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
        const message =
          (err as Error)?.message ??
          mutationError?.message ??
          'An error occurred while verifying the OTP';
        errorToast({ header: 'Email verification failed', message });
      }
    },
    [
      isVerifying,
      verifyTrigger,
      verifyError,
      addEmailToVerifiedList,
      mutationError?.message,
      setDjangoOrderIntent,
    ],
  );

  const resendBackendOrderIntentOTP = useCallback(
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
        const data = resp?.data;

        // Dev probe: confirms which Django intent the email-only resend endpoint targets.
        console.log('[backend-order-intent.resend.response]', {
          id: data?.id,
          order_id: data?.order_id,
          email: data?.email,
          address: data?.address,
          address_2: data?.address_2,
          city: data?.city,
          state: data?.state,
          zip_code: data?.zip_code,
          country: data?.country,
          otp_status: data?.otp_status,
          has_pending_otp: data?.has_pending_otp,
          otp_time_remaining: data?.otp_time_remaining,
          otp_expires_at: data?.otp_expires_at,
          date_created: data?.date_created,
          date_updated: data?.date_updated,
        });

        successToast({
          header: 'OTP Sent - Check your email',
          message: resp.message ?? 'OTP resent. Check your email.',
          duration: 15000,
        });
        return resp;
      } catch (err: unknown) {
        const message =
          (err as Error)?.message ??
          resendError?.message ??
          'An error occurred while resending OTP';
        errorToast({ header: 'OTP resend failed', message });
      }
    },
    [isResending, resendError?.message, resendTrigger],
  );

  return {
    triggerVerifyBackendOrderIntentOTP,
    resendBackendOrderIntentOTP,
    verifyData,
    verifyError,
    resendData,
    resendError,
    isVerifying,
    isResending,
    isEmailVerified,
    createBackendOrderIntent,
    resetBackendOrderIntentMutation,
    backendOrderIntentResp,
    backendOrderIntentError: mutationError,
    isBackendOrderIntentLoading: isMutating,
  };
};
