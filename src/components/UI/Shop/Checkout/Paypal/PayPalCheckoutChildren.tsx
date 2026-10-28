import { type FC, useCallback, useContext, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, ShieldCheck } from 'lucide-react';
import MyPaypalButtons from './MyPaypalButtons';
import MyPayPalCardFields from './MyPaypalCardFields';
import { CheckoutPaymentReviewContext, type CheckoutOptions } from '../PaymentSection';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { usePayPalTXApproveCallback } from '@/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback';
import {
  beginCheckoutAttempt,
  captureCheckoutAttempt,
  completeCheckoutAttempt,
  isCurrentCheckoutAttempt,
  setCheckoutAttemptStage,
  type CheckoutAttempt,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { flushCheckoutStorage } from '@/stores/shop_stores/checkoutStore/storage';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { readCheckoutSetupFailure } from '../checkoutSetupFailure';
import {
  createCheckoutInput,
  checkoutInputIdentity,
  hasDifferentBoundCheckout,
} from '../checkoutReview';
import { boundedCheckoutRequest } from '@/lib/hooks/shopHooks/checkout/boundedCheckoutRequest';
import { resumeOriginalPayPalOrder } from '@/lib/hooks/shopHooks/checkout/originalCheckout';

function checkoutInput() {
  const cart = useCartStore.getState();
  const { djangoOrderIntentUuid } = useDjangoOrderIntentStore.getState();
  return createCheckoutInput(cart.variants, useShopCheckoutStore.getState(), djangoOrderIntentUuid);
}

const PayPalCheckoutChildren: FC<{ mode: CheckoutOptions }> = ({ mode }) => {
  const { review, onPaymentError, originalCheckout } = useContext(CheckoutPaymentReviewContext);
  const { isFinalizingPayment, mainPayPalApproveCallback } =
    usePayPalTXApproveCallback(onPaymentError);
  const providerAttempt = useRef<CheckoutAttempt | null>(null);
  const creating = useRef<Promise<string> | null>(null);

  const createOrder = useCallback((): Promise<string> => {
    if (creating.current) return creating.current;
    const operation = (async () => {
      if (!review) throw new Error('Review the current order details before paying.');
      if (originalCheckout) {
        const attempt = captureCheckoutAttempt(originalCheckout.orderToken);
        if (!attempt) throw new Error('Reopen your original purchase before continuing.');
        try {
          const providerId = await resumeOriginalPayPalOrder(originalCheckout, attempt);
          await flushCheckoutStorage('paypal-intent-store');
          if (!isCurrentCheckoutAttempt(attempt)) throw new Error('This checkout changed.');
          providerAttempt.current = attempt;
          return providerId;
        } catch (error) {
          if (isCurrentCheckoutAttempt(attempt))
            onPaymentError(
              error instanceof Error ? error.message : 'Check the original order status.',
            );
          throw new Error('Failed to create PayPal order');
        }
      }
      const input = checkoutInput();
      const inputKey = checkoutInputIdentity(input, review);
      const previousAttempt = captureCheckoutAttempt();
      if (hasDifferentBoundCheckout(previousAttempt, inputKey)) {
        onPaymentError(
          'Your earlier checkout has different details. Check its payment status above before starting a separate order.',
        );
        throw new Error('Failed to create PayPal order');
      }
      const cartSnapshot = useCartStore.getState().createCheckoutSnapshot();
      const attempt = beginCheckoutAttempt(inputKey);
      try {
        await flushCheckoutStorage('paypal-intent-store');
        if (!isCurrentCheckoutAttempt(attempt))
          throw new Error('This checkout has changed. Please review it again.');
        const { response, payload } = await boundedCheckoutRequest(async (signal) => {
          const response = await fetch('/next-api/paypal/tx-ledger/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...input, attemptId: attempt.attemptId, review }),
            signal,
          });
          const payload = (await response.json()) as {
            data?: { orderToken?: string; paypalOrderId?: string };
            code?: string;
            message?: string;
            error?: { code?: string; message?: string };
          };
          return { response, payload };
        });
        if (!isCurrentCheckoutAttempt(attempt))
          throw new Error('This checkout has changed. Please review it again.');
        if (!response.ok || !payload.data?.orderToken || !payload.data.paypalOrderId) {
          const failure = readCheckoutSetupFailure(payload);
          onPaymentError(failure.message, failure.code);
          throw new Error('Failed to create PayPal order');
        }
        if (checkoutInputIdentity(checkoutInput(), review) !== inputKey) {
          onPaymentError('Your cart or delivery details changed. Review them before paying.');
          throw new Error('Failed to create PayPal order');
        }
        await useCartStore.getState().recordCheckout(payload.data.orderToken, cartSnapshot);
        if (
          !completeCheckoutAttempt(attempt, {
            orderToken: payload.data.orderToken,
            paypalOrderId: payload.data.paypalOrderId,
            stage: mode === 'paypal_buttons' ? 'paypal_window_opened' : 'paypal_order_created',
            paymentSurface: mode === 'card' ? 'card' : 'paypal_buttons',
          })
        )
          throw new Error('This checkout has changed. Please review it again.');
        await flushCheckoutStorage('paypal-intent-store');
        if (!isCurrentCheckoutAttempt(attempt))
          throw new Error('This checkout has changed. Please review it again.');
        providerAttempt.current = captureCheckoutAttempt(payload.data.orderToken);
        return payload.data.paypalOrderId;
      } catch (error) {
        if (
          isCurrentCheckoutAttempt(attempt) &&
          !(error instanceof Error && error.message === 'Failed to create PayPal order')
        )
          onPaymentError(
            error instanceof Error
              ? error.message
              : 'We couldn’t prepare this payment. Please try again.',
          );
        throw new Error('Failed to create PayPal order');
      }
    })();
    creating.current = operation;
    void operation.then(
      () => {
        creating.current = null;
      },
      () => {
        creating.current = null;
      },
    );
    return operation;
  }, [mode, review, onPaymentError, originalCheckout]);

  const handlePayPalCancel = useCallback(() => {
    const attempt = providerAttempt.current;
    if (!attempt || !setCheckoutAttemptStage(attempt, 'paypal_cancelled')) return;
    onPaymentError(
      'The PayPal window was closed. Check the payment status above before trying again.',
    );
  }, [onPaymentError]);

  return (
    <div className='mx-auto w-full min-w-0'>
      {isFinalizingPayment && <PayPalFinalizingOverlay />}
      <MyPaypalButtons
        mode={mode}
        createOrder={createOrder}
        onApprove={mainPayPalApproveCallback}
        onCancel={handlePayPalCancel}
      />
      <MyPayPalCardFields
        mode={mode}
        createOrder={createOrder}
        onApprove={mainPayPalApproveCallback}
      />
    </div>
  );
};

function PayPalFinalizingOverlay() {
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className='fixed inset-0 z-[600] bg-black/65 backdrop-blur-sm' />
        <Dialog.Content
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className='fixed left-1/2 top-1/2 z-[601] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-[#171717] p-6 text-center text-white'
        >
          <Loader2 className='mx-auto h-8 w-8 animate-spin text-sky-200' aria-hidden='true' />
          <Dialog.Title className='mt-4 flex items-center justify-center gap-2 font-semibold'>
            <ShieldCheck size={18} aria-hidden='true' /> Confirming payment
          </Dialog.Title>
          <Dialog.Description className='mt-2 text-sm leading-6 text-white/70'>
            Keep this page open while we check with PayPal. If the connection takes too long, you
            can check this payment’s status.
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default PayPalCheckoutChildren;
