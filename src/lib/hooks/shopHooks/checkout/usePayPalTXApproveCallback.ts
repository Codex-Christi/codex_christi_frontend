import { useCallback } from 'react';
import { OnApproveData } from '@paypal/paypal-js';
import { OrderAuthorizeResponse, OrdersCapture } from '@paypal/paypal-server-sdk';
import errorToast from '@/lib/error-toast';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { useShopRouter } from '@/lib/hooks/useShopRouter';

type RouteErrorPayload = {
  error?: {
    message?: string;
    code?: string;
    stage?: string;
    requestId?: string;
  };
};

async function readRouteErrorMessage(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as RouteErrorPayload;

    if (!payload.error) return fallback;

    const { code, stage, requestId, message } = payload.error;
    return `[${stage ?? 'unknown_stage'}] ${code ?? 'UNKNOWN_ERROR'} (${requestId ?? 'no_request_id'}): ${message ?? fallback}`;
  } catch {
    return fallback;
  }
}

export const usePayPalTXApproveCallback = () => {
  const { push } = useShopRouter();
  const orderToken = usePayPalIntentStore((state) => state.orderToken);

  const mainPayPalApproveCallback = useCallback(
    async (data: OnApproveData) => {
      try {
        if (!orderToken) throw new Error('Missing PayPal order token');
        if (!data.orderID) throw new Error('Missing PayPal order ID');

        const authRes = await fetch('/next-api/paypal/orders/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderToken, orderID: data.orderID }),
        });

        if (!authRes.ok) {
          throw new Error(
            await readRouteErrorMessage(authRes, `Authorization failed: ${authRes.statusText}`),
          );
        }

        const authData = (await authRes.json()) as OrderAuthorizeResponse;
        const authorizationId = authData?.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id;

        if (!authorizationId) throw new Error('Missing authorization ID');

        const capRes = await fetch('/next-api/paypal/orders/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderToken, authorizationId }),
        });

        if (!capRes.ok) {
          throw new Error(
            await readRouteErrorMessage(capRes, `Capture failed: ${capRes.statusText}`),
          );
        }

        const capturedOrder = (await capRes.json()) as OrdersCapture;

        if (capturedOrder.status !== 'COMPLETED') {
          throw new Error(`Payment not completed: ${capturedOrder.status}`);
        }

        // After capture, the browser moves directly into ledger-backed status viewing.
        push(`/shop/checkout/confirmation/${encodeURIComponent(orderToken)}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        console.error('PayPal approval error:', err);
        errorToast({ message });
      }
    },
    [orderToken, push],
  );

  return {
    mainPayPalApproveCallback,
  };
};
