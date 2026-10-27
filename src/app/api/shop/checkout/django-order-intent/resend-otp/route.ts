import { handleDjangoOrderIntent } from '@/lib/shop/checkout/djangoOrderIntent/djangoOrderIntentServer';

export async function POST(request: Request) {
  return handleDjangoOrderIntent(request, '/orders/intent/resend-otp');
}
