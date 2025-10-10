import { useMutationHook } from '@/lib/utils/mutationFactory';

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
export const useSendFirstCheckoutEmailOTPMutation = () =>
  useMutationHook<OrderIntentAPIResponse, VerifyEmailArg>(`${baseURL}/orders/intent`, (arg) => ({
    body: { email: arg.email },
    fetcherOptions: {
      headers: {
        'Content-Type': 'application/json',
        ...(arg.headers ?? {}),
      },
      method: 'POST',
    },
  }))();
