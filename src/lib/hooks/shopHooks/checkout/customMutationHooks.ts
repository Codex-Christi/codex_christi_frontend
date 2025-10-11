import { useMutationHook } from '@/lib/utils/mutationFactory';
import { HmacSHA256 } from 'crypto-js';

const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

interface OrderIntentAPIResponse {
  success: boolean;
  message?: string;
  data: {
    id: string;
    email: string;
    otp_status: 'pending' | 'verified' | 'expired';
  };
}

interface VerifyEmailArg {
  email: string;
  headers?: HeadersInit; // optional extra headers
}
// Create the mutation hook
export const useSendFirstCheckoutEmailOTPMutation = () => {
  const { timestamp, signature } = generateSignature();

  return useMutationHook<OrderIntentAPIResponse, VerifyEmailArg>(
    `${baseURL}/orders/intent`,
    (arg) => ({
      body: { email: arg.email },
      fetcherOptions: {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Signature': signature,
          'X-API-Timestamp': timestamp,
          ...(arg.headers ?? {}),
        },
        method: 'POST',
      },
    }),
  )();
};

function generateSignature() {
  const API_SECRET_KEY = process.env.NEXT_PUBLIC_SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY; // Same as backend
  if (!API_SECRET_KEY) {
    throw new Error('API_SECRET_KEY is not defined');
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = HmacSHA256(timestamp, API_SECRET_KEY).toString();

  return {
    signature,
    timestamp,
  };
}
