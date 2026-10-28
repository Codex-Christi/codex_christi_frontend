import { NextResponse } from 'next/server';
import { accountOrders } from '@/lib/shop/orderHistory/server';
import { AccountHistoryAccessError } from '@/lib/shop/orderHistory/reader';

const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderToken: string }> },
) {
  try {
    const url = await accountOrders.receipt((await params).orderToken);
    return url
      ? NextResponse.redirect(url, { status: 307, headers: privateHeaders })
      : NextResponse.json(
          { message: 'Receipt not found.' },
          { status: 404, headers: privateHeaders },
        );
  } catch (error) {
    return NextResponse.json(
      { message: 'Receipt unavailable.' },
      {
        status: error instanceof AccountHistoryAccessError ? 401 : 503,
        headers: privateHeaders,
      },
    );
  }
}
