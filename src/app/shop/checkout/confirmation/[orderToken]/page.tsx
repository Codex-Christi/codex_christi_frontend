'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import CheckoutConfirmationView from '@/components/UI/Shop/Checkout/CheckoutConfirmationView';
import CheckoutAccessRecovery from '@/components/UI/Shop/Checkout/CheckoutAccessRecovery';
import CheckoutStorageNotice from '@/components/UI/Shop/Checkout/CheckoutStorageNotice';
import { useAuthStore } from '@/stores/authStore';
import { claimCurrentCheckout } from '@/lib/hooks/shopHooks/checkout/claimCurrentCheckout';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { clearLegacyCheckoutCaches } from '@/stores/shop_stores/checkoutStore/storage';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import {
  captureCheckoutAttempt,
  clearCheckoutAttempt,
  isCurrentCheckoutAttempt,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import {
  mapLedgerToProcessingState,
  type PayPalTxPaymentStatusResponse,
} from '@/lib/paypal/txLedger/mapLedgerToProcessingState';

type PageProps = {
  params: Promise<{ orderToken: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default function CheckoutConfirmationPage({ params, searchParams }: PageProps) {
  const { orderToken } = use(params);
  const viewingEarlierOrder = use(searchParams).view === 'details';
  const authenticatedOwner = useAuthStore((state) =>
    state.isAuthenticated ? state.accountOwnerId : null,
  );
  const [payloadOwner, setPayloadOwner] = useState<string | null | undefined>(undefined);
  const [payload, setPayload] = useState<PayPalTxPaymentStatusResponse | null>(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const consumed = useRef(new Set<string>());
  const consumePurchase = useCartStore((state) => state.consumePurchase);
  const data =
    payload?.orderToken === orderToken && payloadOwner === authenticatedOwner ? payload : null;
  const state = data ? mapLedgerToProcessingState(data) : null;
  const paid = Boolean(data?.cartPurchase || data?.paidAmountLabel);
  const refunded = data?.status === 'refunded';
  const refresh = () => setRetry((version) => version + 1);

  const consumeConfirmedPurchase = useCallback(
    async (purchase: NonNullable<PayPalTxPaymentStatusResponse['cartPurchase']>) => {
      if (purchase.orderId !== orderToken || consumed.current.has(purchase.orderId)) return;
      const attempt = captureCheckoutAttempt(orderToken);
      await consumePurchase(purchase.orderId, purchase.lines);
      consumed.current.add(purchase.orderId);
      // Returning to an older order must not erase the details of a newer checkout.
      if (attempt && isCurrentCheckoutAttempt(attempt)) {
        void clearLegacyCheckoutCaches();
        useDjangoOrderIntentStore.getState().clearDjangoOrderIntent();
        useShopCheckoutStore.getState().resetCheckoutToStoreDefaults();
        clearCheckoutAttempt(attempt);
      }
    },
    [consumePurchase, orderToken],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const poll = async () => {
      setRefreshing(true);
      try {
        if (authenticatedOwner && !viewingEarlierOrder) await claimCurrentCheckout();
        if (cancelled) return;
        const response = await fetch(
          `/next-api/paypal/tx-ledger/payments/${encodeURIComponent(orderToken)}/status`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (cancelled) return;
        if (response.status === 403) {
          setPayload(null);
          setAccessRequired(true);
          setLookupError(null);
          return;
        }
        if (response.status === 404) {
          setLookupError(
            'We couldn’t find this order. Check the confirmation link or verify access using the checkout email.',
          );
          setPayload(null);
          setAccessRequired(true);
          return;
        }
        if (!response.ok) throw new Error('Status unavailable');
        const next = (await response.json()) as PayPalTxPaymentStatusResponse;
        if (cancelled) return;
        if (next.orderToken !== orderToken) throw new Error('Order mismatch');
        setPayloadOwner(authenticatedOwner);
        setPayload(next);
        setAccessRequired(false);
        setLookupError(null);
        if (next.cartPurchase && !viewingEarlierOrder) {
          try {
            await consumeConfirmedPurchase(next.cartPurchase);
            if (!cancelled) setCartError(null);
          } catch (error) {
            console.warn('[checkout] Cart update pending', error);
            if (!cancelled)
              setCartError(
                'Your payment is confirmed, but this device’s cart could not be updated. Keep this page open and try again.',
              );
          }
        }
        const mapped = mapLedgerToProcessingState(next);
        if (
          mapped.flowStatus === 'completed' ||
          mapped.flowStatus === 'error' ||
          next.status === 'refunded'
        )
          return;
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.warn('[checkout] Status unavailable', error);
        setLookupError(
          'We couldn’t refresh the order status. Please try again before starting another payment.',
        );
      } finally {
        if (!cancelled) setRefreshing(false);
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 5000);
    };
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [orderToken, retry, consumeConfirmedPurchase, authenticatedOwner, viewingEarlierOrder]);

  const downloadReceipt = () => {
    if (!state?.receiptLink || !state.receiptFileName) return;
    // Native attachment downloads follow the authorized redirect without CORS or PDF buffering.
    const link = document.createElement('a');
    link.href = state.receiptLink;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <CheckoutConfirmationView
      orderToken={orderToken}
      state={state}
      paid={paid}
      hasData={Boolean(data)}
      accessRequired={accessRequired}
      refunded={refunded}
      lookupError={lookupError}
      cartError={viewingEarlierOrder ? null : cartError}
      refreshing={refreshing}
      copied={copied}
      storageNotice={<CheckoutStorageNotice />}
      recovery={<CheckoutAccessRecovery orderToken={orderToken} onVerified={refresh} />}
      onRefresh={refresh}
      onDownload={() => void downloadReceipt()}
      onCopy={() => {
        void navigator.clipboard.writeText(state?.supportReference ?? orderToken).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    />
  );
}
