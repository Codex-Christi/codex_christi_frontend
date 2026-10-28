import { useDjangoOrderIntentEmailVerification } from '@/lib/hooks/shopHooks/checkout/useDjangoOrderIntentEmailVerification';
import {
  DjangoOrderIntentOtpModal,
  DjangoOrderIntentOtpModalProps,
  DjangoOrderIntentOtpModalHandles,
} from './DjangoOrderIntentOtpModal';
import { forwardRef, useCallback, useEffect, useRef } from 'react';
import loadingToast from '@/lib/loading-toast';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';

type DjangoOrderIntentOtpControllerProps = Omit<DjangoOrderIntentOtpModalProps, 'onComplete'> & {
  proceedToPaymentTrigger: (
    itemValue: 'basic-checkout-info' | 'payment-section',
  ) => void | Promise<void>;
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
  const { order_id } = djangoOrderIntentResp?.data || {};
  const { email } = rest;
  const operation = useRef(0);
  useEffect(() => {
    operation.current += 1;
    return () => {
      operation.current += 1;
    };
  }, [rest.isOpen]);

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
      key={`${email ?? ''}:${order_id ?? ''}:${Boolean(rest.isOpen)}`}
      ref={ref}
      {...rest}
      onOpenChange={(open) => {
        if (!open) operation.current += 1;
        rest.onOpenChange?.(open);
      }}
      isResendingOTP={isResending}
      isVerifyingOTP={isVerifying}
      onResendOTP={email ? () => resendDjangoOrderIntentOTP(email) : undefined}
      onComplete={useCallback(
        async (otp: string) => {
          if (rest.isOpen && email && order_id) {
            const request = ++operation.current;
            const resp = await triggerVerifyDjangoOrderIntentOTP({ email, order_id, otp });
            if (operation.current !== request) return;

            if (resp && resp?.data.otp_status === 'verified') {
              if (!resp.data.order_id) {
                return;
              }

              try {
                await proceedToPaymentTrigger('payment-section');
              } catch {
                errorToast({
                  header: 'Email verified',
                  message: 'Please try continuing checkout again to finish reviewing the order.',
                });
              }
              if (operation.current === request) rest.onOpenChange?.(false);
            }
          }
        },
        [email, order_id, proceedToPaymentTrigger, rest, triggerVerifyDjangoOrderIntentOTP],
      )}
    />
  );
});

DjangoOrderIntentOtpController.displayName = 'DjangoOrderIntentOtpController';
