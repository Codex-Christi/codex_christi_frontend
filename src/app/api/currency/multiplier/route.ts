import { NextResponse } from 'next/server';
import { getDollarMultiplier } from '@/actions/shop/general/currencyConvert';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get('code') || 'USA';

  try {
    const data = await getDollarMultiplier(code);

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
