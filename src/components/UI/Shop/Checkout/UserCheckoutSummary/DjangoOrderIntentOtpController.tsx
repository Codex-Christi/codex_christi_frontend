import { useDjangoOrderIntentEmailVerification } from '@/lib/hooks/shopHooks/checkout/useDjangoOrderIntentEmailVerification';
import {
  DjangoOrderIntentOtpModal,
  DjangoOrderIntentOtpModalProps,
  DjangoOrderIntentOtpModalHandles,
} from './DjangoOrderIntentOtpModal';
import { forwardRef, useCallback, useEffect } from 'react';
import loadingToast from '@/lib/loading-toast';
import { toast } from 'sonner';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';

type DjangoOrderIntentOtpControllerProps = Omit<
  DjangoOrderIntentOtpModalProps,
  'onComplete'
> & {
  proceedToPaymentTrigger: (itemValue: 'basic-checkout-info' | 'payment-section') => void;
  djangoOrderIntentEmailVerification: ReturnType<typeof useDjangoOrderIntentEmailVerification>;
};

export const DjangoOrderIntentOtpController = forwardRef<
  DjangoOrderIntentOtpModalHandles,
  DjangoOrderIntentOtpControllerProps
>((props, ref) => {
  const { djangoOrderIntentEmailVerification, proceedToPaymentTrigger, ...rest } = props;
  const {
    djangoOrderIntentResp,
    resendDjangoOrderIntentOTP,
    triggerVerifyDjangoOrderIntentOTP,
    isResending,
    isVerifying,
    isDjangoOrderIntentLoading,
  } = djangoOrderIntentEmailVerification;
  const { id: djangoOrderIntentUuid, order_id } = djangoOrderIntentResp?.data || {};
  const setDjangoOrderIntent = useDjangoOrderIntentStore((s) => s.setDjangoOrderIntent);
  const { email } = rest;

  useEffect(() => {
    let toastID: number;
    if (isVerifying || isDjangoOrderIntentLoading || isResending) {
      toast.dismiss();
      toastID = loadingToast({
        message: isDjangoOrderIntentLoading
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
  }, [isVerifying, isDjangoOrderIntentLoading, isResending]);

  // Main JSX
  return (
    <DjangoOrderIntentOtpModal
      ref={ref}
      {...rest}
      isResendingOTP={isResending}
      onResendOTP={email ? () => resendDjangoOrderIntentOTP(email) : undefined}
      onComplete={useCallback(
        async (otp: string) => {
          // Handle OTP completion

          if (email && order_id) {
            const resp = await triggerVerifyDjangoOrderIntentOTP({ email, order_id, otp });

            if (resp && resp?.data.otp_status === 'verified') {
              if (!resp.data.order_id) {
                return;
              }

              setDjangoOrderIntent({
                djangoOrderIntentUuid: resp.data.id ?? djangoOrderIntentUuid,
                djangoOrderIntentOrderId: resp.data.order_id,
                djangoOrderIntentVerifyPayload: resp,
                djangoOrderIntentVerifiedAt: new Date().toISOString(),
              });
              rest.onOpenChange?.(false);
              proceedToPaymentTrigger('payment-section');
            }
          }
        },
        [
          djangoOrderIntentUuid,
          email,
          order_id,
          proceedToPaymentTrigger,
          rest,
          setDjangoOrderIntent,
          triggerVerifyDjangoOrderIntentOTP,
        ],
      )}
    />
  );
});

DjangoOrderIntentOtpController.displayName = 'DjangoOrderIntentOtpController';
