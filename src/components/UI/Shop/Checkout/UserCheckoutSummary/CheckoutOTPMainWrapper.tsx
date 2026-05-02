import { useVerifyBackendOrderIntentWithOTP } from '@/lib/hooks/shopHooks/checkout/useVerifyBackendOrderIntentWithOTP';
import {
  CheckoutOTPModal,
  CheckoutOTPModalProps,
  CheckoutOTPModalHandles,
} from './CheckoutOTPModal';
import { forwardRef, useCallback, useEffect } from 'react';
import loadingToast from '@/lib/loading-toast';
import { toast } from 'sonner';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';

type CheckoutOTPMainWrapperProps = Omit<CheckoutOTPModalProps, 'onComplete'> & {
  proceedToPaymentTrigger: (itemValue: 'basic-checkout-info' | 'payment-section') => void;
  otpSendHookProps: ReturnType<typeof useVerifyBackendOrderIntentWithOTP>;
};

export const CheckoutOTPMainWrapper = forwardRef<
  CheckoutOTPModalHandles,
  CheckoutOTPMainWrapperProps
>((props, ref) => {
  const { otpSendHookProps, proceedToPaymentTrigger, ...rest } = props;
  const {
    backendOrderIntentResp,
    resendBackendOrderIntentOTP,
    triggerVerifyBackendOrderIntentOTP,
    isResending,
    isVerifying,
    isBackendOrderIntentLoading,
  } = otpSendHookProps;
  const { id: djangoOrderIntentUuid, order_id } = backendOrderIntentResp?.data || {};
  const setDjangoOrderIntent = useDjangoOrderIntentStore((s) => s.setDjangoOrderIntent);
  const { email } = rest;

  useEffect(() => {
    let toastID: number;
    if (isVerifying || isBackendOrderIntentLoading || isResending) {
      toast.dismiss();
      toastID = loadingToast({
        message: isBackendOrderIntentLoading
          ? 'Sending OTP...'
          : isResending
            ? 'Resending OTP...'
            : 'Verifying OTP...',
        duration: 5000,
      });

      return () => {
        toast.dismiss(toastID);
      };
    }
  }, [isVerifying, isBackendOrderIntentLoading, isResending]);

  // Main JSX
  return (
    <CheckoutOTPModal
      ref={ref}
      {...rest}
      isResendingOTP={isResending}
      onResendOTP={email ? () => resendBackendOrderIntentOTP(email) : undefined}
      onComplete={useCallback(
        async (otp: string) => {
          // Handle OTP completion

          if (email && order_id) {
            const resp = await triggerVerifyBackendOrderIntentOTP({ email, order_id, otp });
            setTimeout(() => {
              rest.onOpenChange?.(false);
              if (resp && resp?.data.otp_status === 'verified') {
                if (!resp.data.order_id) {
                  return;
                }
                console.log('[checkout-otp.verified-intent-for-paypal]', {
                  djangoOrderIntentUuid: resp.data.id ?? djangoOrderIntentUuid,
                  djangoOrderIntentOrderId: resp.data.order_id,
                  email: resp.data.email,
                  otp_status: resp.data.otp_status,
                });
                setDjangoOrderIntent({
                  djangoOrderIntentUuid: resp.data.id ?? djangoOrderIntentUuid,
                  djangoOrderIntentOrderId: resp.data.order_id,
                  djangoOrderIntentVerifyPayload: resp,
                });
                proceedToPaymentTrigger('payment-section');
              }
            }, 500);
          }
        },
        [
          djangoOrderIntentUuid,
          email,
          order_id,
          proceedToPaymentTrigger,
          rest,
          setDjangoOrderIntent,
          triggerVerifyBackendOrderIntentOTP,
        ],
      )}
    />
  );
});

CheckoutOTPMainWrapper.displayName = 'CheckoutOTPMainWrapper';
