import { NextResponse } from 'next/server';
import { requireAdminAction, isAdminActionAuthError } from '@/lib/admin/require-admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-auth-ledger';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { signReceiptDownload, canSupportReadReceipt } from '@/lib/shop/orderHistory/receiptStorage';
import { receiptObjectKey } from '@/lib/shop/orderHistory/receiptReference';

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderToken: string }> },
) {
  try {
    const admin = await requireAdminAction('shop.view');
    if (!canSupportReadReceipt(admin))
      return new Response('Access denied.', { status: 403, headers });
    const { orderToken } = await params;
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(orderToken))
      return new Response('Receipt not found.', { status: 404, headers });
    const row = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: { orderToken: true, receiptLink: true, receiptFile: true },
    });
    if (!row || !receiptObjectKey(row))
      return new Response('Receipt not found.', { status: 404, headers });
    const url = await signReceiptDownload(row);
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.receipt.download',
      targetType: 'orderToken',
      targetId: orderToken,
      outcome: 'success',
    });
    return NextResponse.redirect(url, { status: 307, headers });
  } catch (error) {
    return new Response('Receipt unavailable.', {
      status: isAdminActionAuthError(error) ? 403 : 503,
      headers,
    });
  }
}
