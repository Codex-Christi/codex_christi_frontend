'use client';

import { useMutationHook } from '@/lib/utils/mutationFactory';
import { HmacSHA256 } from 'crypto-js';

const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

export interface BackendOrderIntentPayload {
  email: string;
  first_name: string;
  last_name: string;
  address: string;
  address_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone?: string;
}

export interface BackendOrderIntentAPIResponse {
  status: number;
  success: boolean;
  message?: string;
  data: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    address: string;
    address_2: string;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    country: string | null;
    phone: string | null;
    otp_status: 'pending' | 'verified' | 'expired';
    order_id: string | null;
    otp_time_remaining: number;
    has_pending_otp: boolean;
    otp_expires_at: string | null;
    date_created: string;
    date_updated: string;
  };
}

interface CreateBackendOrderIntentArg extends BackendOrderIntentPayload {
  headers?: HeadersInit;
}

interface VerifyBackendOrderIntentOTPArg {
  email: string;
  otp: string;
  order_id: string;
  headers?: HeadersInit;
}

interface ResendBackendOrderIntentOTPArg {
  email: string;
  headers?: HeadersInit;
}

// Creates or reuses the Django backend order intent used for checkout OTP verification.
export const useCreateBackendOrderIntentMutation = () => {
  return useMutationHook<BackendOrderIntentAPIResponse, CreateBackendOrderIntentArg>(
    `${baseURL}/orders/intent`,
    (arg) => {
      const { headers, ...body } = arg;

      return {
        body,
        key: arg.email,
        fetcherOptions: {
          headers: {
            ...generateSignatureHeadersOnClient(),
            ...(headers ?? {}),
          },
          method: 'POST',
        },
      };
    },
  )();
};

export const useVerifyBackendOrderIntentOTPMutation = () => {
  return useMutationHook<BackendOrderIntentAPIResponse, VerifyBackendOrderIntentOTPArg>(
    `${baseURL}/orders/intent/verify`,
    (arg) => ({
      body: { email: arg.email, otp: arg.otp, order_id: arg.order_id },
      key: arg.email,
      fetcherOptions: {
        headers: {
          ...generateSignatureHeadersOnClient(),
          ...(arg.headers ?? {}),
        },
        method: 'POST',
      },
    }),
  )();
};

export const useResendBackendOrderIntentOTPMutation = () => {
  return useMutationHook<BackendOrderIntentAPIResponse, ResendBackendOrderIntentOTPArg>(
    `${baseURL}/orders/intent/resend-otp`,
    (arg) => ({
      body: { email: arg.email },
      key: arg.email,
      fetcherOptions: {
        headers: {
          ...generateSignatureHeadersOnClient(),
          ...(arg.headers ?? {}),
        },
        method: 'POST',
      },
    }),
  )();
};

function generateSignatureHeadersOnClient() {
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
