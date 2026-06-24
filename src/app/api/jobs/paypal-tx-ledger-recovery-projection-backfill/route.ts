import { NextRequest, NextResponse } from 'next/server';
import { backfillPaidOrderRecoveryProjections } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET;
  const headerSecret = req.headers.get('x-cron-secret');

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      batchSize?: number;
      cursorOrderToken?: string;
      dryRun?: boolean;
      orderTokens?: string[];
    };
    const result = await backfillPaidOrderRecoveryProjections({
      batchSize: body.batchSize,
      cursorOrderToken: body.cursorOrderToken,
      dryRun: body.dryRun,
      orderTokens: body.orderTokens,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('[paypal.recovery_projection_backfill.failed]', { error: message });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
