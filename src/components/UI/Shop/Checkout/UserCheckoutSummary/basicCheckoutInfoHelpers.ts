import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import type { BackendOrderIntentPayload } from '@/lib/hooks/shopHooks/checkout/backendOrderIntentMutationHooks';
import type { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';

export type RecoveryStartResponse = {
  ok: boolean;
  recoveryRequired?: boolean;
  expiresInMinutes?: number;
  expiresInSeconds?: number;
  resendAvailableInSeconds?: number;
  message?: string;
};

export type RecoveryPromptState = {
  email: string;
  expiresInMinutes: number;
  pendingCheckoutData: BasicCheckoutInfoFormSchema | null;
  recipientName: string;
  resendAvailableInSeconds: number;
};

export const DEFAULT_RECOVERY_PROMPT_STATE: RecoveryPromptState = {
  email: '',
  expiresInMinutes: 10,
  pendingCheckoutData: null,
  recipientName: '',
  resendAvailableInSeconds: 0,
};

export function getRecipientName(data: BasicCheckoutInfoFormSchema) {
  return `${data.firstname} ${data.lastname}`.trim();
}

export function getRecoveryExpiryMinutes(payload: RecoveryStartResponse) {
  return payload.expiresInMinutes ?? Math.max(1, Math.ceil((payload.expiresInSeconds ?? 600) / 60));
}

export function getCheckoutValuesFromStore(
  selectedCountryISO3?: string,
): BasicCheckoutInfoFormSchema {
  const { delivery_address, email, first_name, last_name } = useShopCheckoutStore.getState();

  return {
    country: selectedCountryISO3 ?? delivery_address?.shipping_country ?? '',
    firstname: first_name ?? '',
    lastname: last_name ?? '',
    email: email ?? '',
    addressLine1: delivery_address?.shipping_address_line_1 ?? '',
    addressLine2: delivery_address?.shipping_address_line_2 ?? '',
    adminArea1: delivery_address?.shipping_state ?? '',
    adminArea2: delivery_address?.shipping_city ?? '',
    postalCode: delivery_address?.zip_code ?? '',
  };
}

export function saveBasicCheckoutInfoToStore(data: BasicCheckoutInfoFormSchema) {
  useShopCheckoutStore.setState((state) => ({
    ...state,
    email: data.email,
    first_name: data.firstname,
    last_name: data.lastname,
    delivery_address: {
      ...state.delivery_address,
      shipping_country: data.country,
      shipping_address_line_1: data.addressLine1,
      shipping_address_line_2: data.addressLine2 ?? '',
      shipping_city: data.adminArea2,
      shipping_state: data.adminArea1,
      zip_code: data.postalCode,
    },
  }));
}

export function toDjangoOrderIntentPayload(
  data: BasicCheckoutInfoFormSchema,
): BackendOrderIntentPayload {
  return {
    email: data.email,
    first_name: data.firstname,
    last_name: data.lastname,
    address: data.addressLine1,
    address_2: data.addressLine2 ?? '',
    city: data.adminArea2,
    state: data.adminArea1,
    zip_code: data.postalCode,
    country: data.country,
  };
}

export async function startCheckoutRecovery(data: BasicCheckoutInfoFormSchema) {
  const response = await fetch('/next-api/shop/checkout/recovery/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.email, recipientName: getRecipientName(data) }),
  });
  const payload = (await response.json()) as RecoveryStartResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.message ?? 'Unable to check whether this email has a checkout recovery case.',
    );
  }

  return payload;
}
