'use client';

import { useMutationHook } from '@/lib/utils/mutationFactory';
import { HmacSHA256 } from 'crypto-js';

const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

interface OrderIntentAPIResponse {
  success: boolean;
  message?: string;
  data: {
    order_id: string;
    email: string;
    otp_status: 'pending' | 'verified' | 'expired';
  };
}

interface SendInitialEmailOTPArg {
  email: string;
  headers?: HeadersInit; // optional extra headers
}

interface VerifyEmailOTPArg extends SendInitialEmailOTPArg {
  otp: string;
  order_id: string;
}

// Create the mutation hook
export const useSendFirstCheckoutEmailOTPMutation = () => {
  return useMutationHook<OrderIntentAPIResponse, SendInitialEmailOTPArg>(
    `${baseURL}/orders/intent`,
    (arg) => ({
      body: { email: arg.email },
      key: arg.email,
      fetcherOptions: {
        headers: {
          ...generateSignatureHeaders(),
          ...(arg.headers ?? {}),
        },
        method: 'POST',
      },
    }),
  )();
};

export const useVerifySentEmailOTPMutation = () => {
  return useMutationHook<OrderIntentAPIResponse, VerifyEmailOTPArg>(
    `${baseURL}/orders/intent/verify`,
    (arg) => ({
      body: { email: arg.email, otp: arg.otp, order_id: arg.order_id },
      key: arg.email,
      fetcherOptions: {
        headers: {
          ...generateSignatureHeaders(),
          ...(arg.headers ?? {}),
        },
        method: 'POST',
      },
    }),
  )();
};

function generateSignatureHeaders() {
  const API_SECRET_KEY = process.env.NEXT_PUBLIC_SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY; // Same as backend
  if (!API_SECRET_KEY) {
    throw new Error('API_SECRET_KEY is not defined');
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = HmacSHA256(timestamp, API_SECRET_KEY).toString();

  return {
    'Content-Type': 'application/json',
    'X-API-Signature': `${signature}`,
    'X-API-Timestamp': `${timestamp}`,
  };
}
