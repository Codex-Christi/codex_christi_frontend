import { NextRequest, NextResponse } from 'next/server';
import { runPayPalRecoveryScanner } from '@/lib/paypal/txLedger/recoveryScanner';
import { runMerchizeFulfillmentLifecycleScanner } from '@/lib/merchizeFulfillmentOps/fulfillmentLifecycleScanner';
import { recoverMerchizeDeliveryNotices } from '@/lib/merchizeFulfillmentOps/notifyMerchizeLifecycle';
import { sendPendingCustomerNotifications } from '@/lib/paypal/txLedger/customerNotificationOutbox';
import { isRecoveryScannerEnabled } from '@/lib/paypal/txLedger/processingPolicy';
import { assertShopOpsMutationAllowed } from '@/lib/prisma/shop/shopOpsDataTarget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET;
  const headerSecret = req.headers.get('x-cron-secret');

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [payment, fulfillment] = await Promise.allSettled([
      runPayPalRecoveryScanner(),
      runMerchizeFulfillmentLifecycleScanner(),
    ]);
    const paymentRecovery = payment.status === 'fulfilled' ? payment.value : { ok: false };
    const fulfillmentLifecycle = fulfillment.status === 'fulfilled' ? fulfillment.value : { ok: false };
    let customerNotifications = { ok: true, enabled: false, sent: 0, failed: 0, deliveryNoticesDeferred: 0 };
    if (isRecoveryScannerEnabled()) {
      assertShopOpsMutationAllowed();
      const delivery = await recoverMerchizeDeliveryNotices().catch(() => null);
      const emails = await sendPendingCustomerNotifications().catch(() => null);
      const sent = emails?.filter((email) => email.ok).length ?? 0;
      const failed = (emails?.length ?? 0) - sent;
      customerNotifications = {
        ok: delivery !== null && emails !== null && failed === 0,
        enabled: true,
        sent,
        failed,
        deliveryNoticesDeferred: delivery?.deferred ?? 0,
      };
    }
    const result = {
      ok: paymentRecovery.ok && fulfillmentLifecycle.ok && customerNotifications.ok,
      paymentRecovery,
      fulfillmentLifecycle,
      customerNotifications,
    };
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch {
    console.error('[paypal.recovery_scanner.failed]');
    return NextResponse.json({ ok: false, error: 'The scheduled recovery run could not complete.' }, { status: 500 });
  }
}
