import type { PayPalTxPaymentStatusResponse } from '@/lib/paypal/txLedger/mapLedgerToProcessingState';
import { boundedCheckoutRequest } from './boundedCheckoutRequest';

export function readCheckoutStatus(
  orderToken: string,
  {
    request = fetch,
    signal: cancellation,
    timeoutMs,
  }: {
    request?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
) {
  return boundedCheckoutRequest(
    async (signal) => {
      const response = await request(
        `/next-api/paypal/tx-ledger/payments/${encodeURIComponent(orderToken)}/status`,
        { cache: 'no-store', signal },
      );
      const data = response.ok ? ((await response.json()) as PayPalTxPaymentStatusResponse) : null;
      if (data && data.orderToken !== orderToken) throw new Error('Payment status mismatch.');
      return { status: response.status, data };
    },
    timeoutMs,
    cancellation,
  );
}
