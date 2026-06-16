import { NextResponse } from 'next/server';
import { postToDjangoOrderIntent } from '@/lib/shop/checkout/djangoOrderIntent/djangoOrderIntentServer';

type DjangoOrderIntentCreateBody = {
  email?: string;
  first_name?: string;
  last_name?: string;
  address?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DjangoOrderIntentCreateBody;

    return postToDjangoOrderIntent('/orders/intent', body);
  } catch (error) {
    console.error('[django-order-intent.create]', error);

    return NextResponse.json(
      { message: 'Unable to create Django order intent.' },
      { status: 500 },
    );
  }
}
