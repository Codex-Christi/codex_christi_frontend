import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';

type PageProps = {
  params: Promise<{ orderToken: string }>;
};

export async function GET(_req: Request, { params }: PageProps) {
  const { orderToken } = await params;

  const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    orderToken: row.orderToken,
    status: row.status,
    lastEventType: row.lastEventType,
    receiptLink: row.receiptLink,
    receiptFile: row.receiptFile,
    backendCustomId: row.backendCustomId,
    processingCompletedAt: row.processingCompletedAt,
    error: row.lastErrorMessage ? { code: row.lastErrorCode, message: row.lastErrorMessage } : null,
  });
}
