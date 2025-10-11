import {
  CheckoutOTPModal,
  CheckoutOTPModalProps,
  CheckoutOTPModalHandles,
} from './CheckoutOTPModal';
import { RefObject } from 'react';

type CheckoutOTPMainWrapperProps = Omit<CheckoutOTPModalProps, 'onComplete'> & {
  ref: RefObject<CheckoutOTPModalHandles>;
  proceedToPaymentTrigger: (itemValue: 'basic-checkout-info' | 'payment-section') => void;
};

export const CheckoutOTPMainWrapper: React.FC<CheckoutOTPMainWrapperProps> = (props) => {
  // Main JSX
  return (
    <>
      <CheckoutOTPModal
        {...props}
        onComplete={(otp) => {
          console.log('OTP entered:', otp);
        }}
      />
    </>
  );
};
