'use client';

import { useMutationHook } from '@/lib/utils/mutationFactory';

export interface DjangoOrderIntentPayload {
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

export interface DjangoOrderIntentAPIResponse {
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

interface CreateDjangoOrderIntentArg extends DjangoOrderIntentPayload {
  headers?: HeadersInit;
}

interface VerifyDjangoOrderIntentOTPArg {
  email: string;
  otp: string;
  order_id: string;
  headers?: HeadersInit;
}

interface ResendDjangoOrderIntentOTPArg {
  email: string;
  headers?: HeadersInit;
}

// Creates or reuses the Django backend order intent used for checkout OTP verification.
export const useCreateDjangoOrderIntentMutation = () => {
  return useMutationHook<DjangoOrderIntentAPIResponse, CreateDjangoOrderIntentArg>(
    '/next-api/shop/checkout/django-order-intent',
    (arg) => {
      const { headers, ...body } = arg;

      return {
        body,
        key: arg.email,
        fetcherOptions: {
          headers: {
            ...(headers ?? {}),
          },
          method: 'POST',
        },
      };
    },
  )();
};

export const useVerifyDjangoOrderIntentOTPMutation = () => {
  return useMutationHook<DjangoOrderIntentAPIResponse, VerifyDjangoOrderIntentOTPArg>(
    '/next-api/shop/checkout/django-order-intent/verify',
    (arg) => ({
      body: { email: arg.email, otp: arg.otp, order_id: arg.order_id },
      key: arg.email,
      fetcherOptions: {
        headers: {
          ...(arg.headers ?? {}),
        },
        method: 'POST',
      },
    }),
  )();
};

export const useResendDjangoOrderIntentOTPMutation = () => {
  return useMutationHook<DjangoOrderIntentAPIResponse, ResendDjangoOrderIntentOTPArg>(
    '/next-api/shop/checkout/django-order-intent/resend-otp',
    (arg) => ({
      body: { email: arg.email },
      key: arg.email,
      fetcherOptions: {
        headers: {
          ...(arg.headers ?? {}),
        },
        method: 'POST',
      },
    }),
  )();
};
