import { NextResponse } from 'next/server';
import { accountOrders } from '@/lib/shop/orderHistory/server';
import { AccountHistoryAccessError } from '@/lib/shop/orderHistory/reader';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import { refreshCustomerTracking } from '@/lib/merchizeFulfillmentOps/refreshCustomerTracking';

const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderToken: string }> },
) {
  if (!isSameOriginMutation(request))
    return NextResponse.json(
      { message: 'Reload this page before trying again.' },
      { status: 403, headers },
    );
  try {
    const { orderToken } = await params;
    if (!(await accountOrders.owned(orderToken)))
      return NextResponse.json({ message: 'Order not found.' }, { status: 404, headers });
    const result = await refreshCustomerTracking(orderToken);
    return NextResponse.json(result, {
      headers: { ...headers, 'Retry-After': String(result.retryAfter) },
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Tracking is temporarily unavailable. Your saved order remains available.' },
      { status: error instanceof AccountHistoryAccessError ? 401 : 503, headers },
    );
  }
}
