import { NextResponse } from 'next/server';
import { postToDjangoOrderIntent } from '@/lib/shop/checkout/djangoOrderIntent/djangoOrderIntentServer';

type DjangoOrderIntentResendOtpBody = {
  email?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DjangoOrderIntentResendOtpBody;

    return postToDjangoOrderIntent('/orders/intent/resend-otp', body);
  } catch (error) {
    console.error('[django-order-intent.resend-otp]', error);

    return NextResponse.json(
      { message: 'Unable to resend Django order intent OTP.' },
      { status: 500 },
    );
  }
}
