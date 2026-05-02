import { after, NextResponse } from 'next/server';
import { runPostProcessing } from '@/lib/paypal/txLedger/runPostProcessing';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';

type PageProps = {
  params: Promise<{ orderToken: string }>;
};

const RESUMABLE_POST_PROCESSING_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
]);

export async function GET(_req: Request, { params }: PageProps) {
  const { orderToken } = await params;

  const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const now = new Date();
  const lockIsActive =
    row.postProcessingLockExpiresAt && row.postProcessingLockExpiresAt.getTime() > now.getTime();
  const shouldResumePostProcessing =
    row.capturePayload &&
    !row.lastErrorMessage &&
    !row.processingCompletedAt &&
    !lockIsActive &&
    RESUMABLE_POST_PROCESSING_STATUSES.has(row.status);

  if (shouldResumePostProcessing) {
    after(async () => {
      try {
        await runPostProcessing(row.orderToken);
      } catch (error) {
        console.error('[paypal.status.post_processing_resume_failed]', {
          orderToken: row.orderToken,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  const effectiveStatus = row.lastErrorMessage ? PAYPAL_LEDGER_STATUS.ERROR : row.status;

  return NextResponse.json({
    orderToken: row.orderToken,
    status: effectiveStatus,
    lastEventType: row.lastEventType,
    receiptLink: row.receiptLink,
    receiptFile: row.receiptFile,
    djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
    processingCompletedAt: row.processingCompletedAt,
    error: row.lastErrorMessage ? { code: row.lastErrorCode, message: row.lastErrorMessage } : null,
  });
}
