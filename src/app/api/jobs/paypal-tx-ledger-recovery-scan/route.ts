import { NextRequest, NextResponse } from 'next/server';
import { runPayPalRecoveryScanner } from '@/lib/paypal/txLedger/recoveryScanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET;
  const headerSecret = req.headers.get('x-cron-secret');

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPayPalRecoveryScanner();
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('[paypal.recovery_scanner.failed]', { error: message });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
