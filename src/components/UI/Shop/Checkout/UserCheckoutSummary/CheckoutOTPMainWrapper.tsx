import { useVerifyEmailWithOTP } from '@/lib/hooks/shopHooks/checkout/useVerifyEmailWithOTP';
import {
  CheckoutOTPModal,
  CheckoutOTPModalProps,
  CheckoutOTPModalHandles,
} from './CheckoutOTPModal';
import { forwardRef } from 'react';

type CheckoutOTPMainWrapperProps = Omit<CheckoutOTPModalProps, 'onComplete'> & {
  proceedToPaymentTrigger: (itemValue: 'basic-checkout-info' | 'payment-section') => void;
  otpSendHookProps: ReturnType<typeof useVerifyEmailWithOTP>;
};

export const CheckoutOTPMainWrapper = forwardRef<
  CheckoutOTPModalHandles,
  CheckoutOTPMainWrapperProps
>((props, ref) => {
  const { otpSendHookProps, ...rest } = props;
  const { initialOTPSendResp } = otpSendHookProps;

  return (
    <CheckoutOTPModal
      ref={ref}
      {...rest}
      onComplete={(otp) => {
        console.log('OTP entered:', otp);
        console.log(initialOTPSendResp);
      }}
    />
  );
});

CheckoutOTPMainWrapper.displayName = 'CheckoutOTPMainWrapper';
