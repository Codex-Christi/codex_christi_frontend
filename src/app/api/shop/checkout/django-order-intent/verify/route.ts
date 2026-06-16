import { NextResponse } from 'next/server';
import { postToDjangoOrderIntent } from '@/lib/shop/checkout/djangoOrderIntent/djangoOrderIntentServer';

type DjangoOrderIntentVerifyBody = {
  email?: string;
  otp?: string;
  order_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DjangoOrderIntentVerifyBody;

    return postToDjangoOrderIntent('/orders/intent/verify', body);
  } catch (error) {
    console.error('[django-order-intent.verify]', error);

    return NextResponse.json(
      { message: 'Unable to verify Django order intent OTP.' },
      { status: 500 },
    );
  }
}
