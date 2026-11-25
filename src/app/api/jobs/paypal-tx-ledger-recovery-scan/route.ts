import { NextRequest, NextResponse } from 'next/server';
import { runPayPalRecoveryScanner } from '@/lib/paypal/txLedger/recoveryScanner';
import { runMerchizeFulfillmentLifecycleScanner } from '@/lib/merchizeFulfillmentOps/fulfillmentLifecycleScanner';
import { recoverMerchizeDeliveryNotices } from '@/lib/merchizeFulfillmentOps/notifyMerchizeLifecycle';
import { sendPendingCustomerNotifications } from '@/lib/paypal/txLedger/customerNotificationOutbox';
import { isRecoveryScannerEnabled } from '@/lib/paypal/txLedger/processingPolicy';
import {
  assertShopOpsMutationAllowed,
  type ShopOpsDataTarget,
} from '@/lib/prisma/shop/shopOpsDataTarget';
import { recordScheduledRecoveryRun } from '@/lib/paypal/txLedger/scheduledRecoveryRun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET;
  const headerSecret = req.headers.get('x-cron-secret');

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let target: ShopOpsDataTarget | null = null;
  try {
    target = assertShopOpsMutationAllowed().target;
    const [payment, fulfillment] = await Promise.allSettled([
      runPayPalRecoveryScanner(),
      runMerchizeFulfillmentLifecycleScanner(),
    ]);
    const paymentRecovery = payment.status === 'fulfilled' ? payment.value : { ok: false };
    const fulfillmentLifecycle = fulfillment.status === 'fulfilled' ? fulfillment.value : { ok: false };
    let customerNotifications = {
      ok: true, enabled: false, sent: 0, suppressed: 0, failed: 0, deliveryNoticesDeferred: 0,
    };
    if (isRecoveryScannerEnabled()) {
      const delivery = await recoverMerchizeDeliveryNotices().catch(() => null);
      const emails = await sendPendingCustomerNotifications().catch(() => null);
      const sent = emails?.filter((email) => email.ok).length ?? 0;
      const suppressed = emails?.filter((email) => 'suppressed' in email && email.suppressed).length ?? 0;
      const failed = (emails?.length ?? 0) - sent - suppressed;
      customerNotifications = {
        ok: delivery !== null && emails !== null && failed === 0,
        enabled: true,
        sent,
        suppressed,
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
    if (target) await recordScheduledRecoveryRun(target, result.ok ? 'success' : 'failure');
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch {
    if (target) await recordScheduledRecoveryRun(target, 'failure');
    console.error('[paypal.recovery_scanner.failed]');
    return NextResponse.json({ ok: false, error: 'The scheduled recovery run could not complete.' }, { status: 500 });
  }
}
