import { useVerifyEmailWithOTP } from '@/lib/hooks/shopHooks/checkout/useVerifyEmailWithOTP';
import {
  CheckoutOTPModal,
  CheckoutOTPModalProps,
  CheckoutOTPModalHandles,
} from './CheckoutOTPModal';
import { forwardRef, useCallback, useEffect } from 'react';
import loadingToast from '@/lib/loading-toast';
import { toast } from 'sonner';
import { useOrderStringStore } from '@/stores/shop_stores/checkoutStore/ORD-stringStore';

type CheckoutOTPMainWrapperProps = Omit<CheckoutOTPModalProps, 'onComplete'> & {
  proceedToPaymentTrigger: (itemValue: 'basic-checkout-info' | 'payment-section') => void;
  otpSendHookProps: ReturnType<typeof useVerifyEmailWithOTP>;
};

export const CheckoutOTPMainWrapper = forwardRef<
  CheckoutOTPModalHandles,
  CheckoutOTPMainWrapperProps
>((props, ref) => {
  const { otpSendHookProps, proceedToPaymentTrigger, ...rest } = props;
  const { initialOTPSendResp, triggerVerifySentOTP, isVerifying, isInitialSendLoading } =
    otpSendHookProps;
  const { order_id } = initialOTPSendResp?.data || {};
  const setOrderString = useOrderStringStore((s) => s.setOrderString);
  const { email } = rest;

  useEffect(() => {
    let toastID: number;
    if (isVerifying || isInitialSendLoading) {
      toast.dismiss();
      toastID = loadingToast({
        message: isInitialSendLoading ? 'Sending OTP...' : 'Verifying OTP...',
        duration: 5000,
      });

      return () => {
        toast.dismiss(toastID);
      };
    }
  }, [isVerifying, isInitialSendLoading]);

  // Main JSX
  return (
    <CheckoutOTPModal
      ref={ref}
      {...rest}
      onComplete={useCallback(
        async (otp: string) => {
          // Handle OTP completion

          if (email && order_id) {
            const resp = await triggerVerifySentOTP({ email, order_id, otp });
            setTimeout(() => {
              rest.onOpenChange?.(false);
              if (resp && resp?.data.otp_status === 'verified') {
                setOrderString(resp.data.order_id);
                proceedToPaymentTrigger('payment-section');
              }
            }, 500);
          }
        },
        [email, order_id, proceedToPaymentTrigger, rest, setOrderString, triggerVerifySentOTP],
      )}
    />
  );
});

CheckoutOTPMainWrapper.displayName = 'CheckoutOTPMainWrapper';
