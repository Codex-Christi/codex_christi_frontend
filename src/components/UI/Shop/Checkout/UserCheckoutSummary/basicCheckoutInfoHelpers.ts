import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import type { PaidCheckoutRecoverySummary } from '@/stores/shop_stores/checkoutStore/paidCheckoutRecoveryStore';
import type { DjangoOrderIntentPayload } from '@/lib/hooks/shopHooks/checkout/djangoOrderIntentMutationHooks';
import type { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';

const DJANGO_ORDER_INTENT_LOCAL_REUSE_WINDOW_MS = 15 * 60 * 1000;

export type PaidCheckoutRecoveryStartResponse = {
  ok: boolean;
  recoveryRequired?: boolean;
  expiresInMinutes?: number;
  expiresInSeconds?: number;
  resendAvailableInSeconds?: number;
  message?: string;
};

export type PaidCheckoutRecoveryPromptState = {
  email: string;
  expiresInMinutes: number;
  pendingCheckoutData: BasicCheckoutInfoFormSchema | null;
  recipientName: string;
  resendAvailableInSeconds: number;
  verifiedCheckouts: PaidCheckoutRecoverySummary[];
};

export const DEFAULT_PAID_CHECKOUT_RECOVERY_PROMPT_STATE: PaidCheckoutRecoveryPromptState = {
  email: '',
  expiresInMinutes: 10,
  pendingCheckoutData: null,
  recipientName: '',
  resendAvailableInSeconds: 0,
  verifiedCheckouts: [],
};

type DjangoOrderIntentPayloadData = {
  id?: unknown;
  email?: unknown;
  otp_status?: unknown;
  order_id?: unknown;
  date_created?: unknown;
  date_updated?: unknown;
};

function getDjangoOrderIntentPayloadData(payload: unknown): DjangoOrderIntentPayloadData | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = (payload as { data?: unknown }).data;
  return data && typeof data === 'object' ? (data as DjangoOrderIntentPayloadData) : null;
}

function getTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isRecentDjangoOrderIntentVerification(
  verifiedAt: string | null,
  payloadData: DjangoOrderIntentPayloadData,
) {
  const verifiedTimestamp =
    getTimestamp(verifiedAt) ??
    getTimestamp(payloadData.date_updated) ??
    getTimestamp(payloadData.date_created);
  const ageMs = verifiedTimestamp === null ? null : Date.now() - verifiedTimestamp;

  return (
    ageMs !== null &&
    ageMs >= -60_000 &&
    ageMs <= DJANGO_ORDER_INTENT_LOCAL_REUSE_WINDOW_MS
  );
}

export function getRecentVerifiedDjangoOrderIntentForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const {
    djangoOrderIntentUuid,
    djangoOrderIntentOrderId,
    djangoOrderIntentVerifyPayload,
    djangoOrderIntentVerifiedAt,
  } = useDjangoOrderIntentStore.getState();
  const payloadData = getDjangoOrderIntentPayloadData(djangoOrderIntentVerifyPayload);

  if (!payloadData) return null;

  const payloadEmail = typeof payloadData.email === 'string' ? payloadData.email.toLowerCase() : '';
  const payloadOrderId = typeof payloadData.order_id === 'string' ? payloadData.order_id : '';
  const payloadIntentUuid = typeof payloadData.id === 'string' ? payloadData.id : '';

  if (payloadData.otp_status !== 'verified') return null;
  if (!payloadEmail || payloadEmail !== normalizedEmail) return null;
  if (!djangoOrderIntentOrderId && !payloadOrderId) return null;
  if (!isRecentDjangoOrderIntentVerification(djangoOrderIntentVerifiedAt, payloadData)) {
    return null;
  }

  return {
    djangoOrderIntentUuid: djangoOrderIntentUuid || payloadIntentUuid,
    djangoOrderIntentOrderId: djangoOrderIntentOrderId || payloadOrderId,
  };
}

export function getRecipientName(data: BasicCheckoutInfoFormSchema) {
  return `${data.firstname} ${data.lastname}`.trim();
}

export function getPaidCheckoutRecoveryExpiryMinutes(
  payload: PaidCheckoutRecoveryStartResponse,
) {
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
): DjangoOrderIntentPayload {
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

export async function startPaidCheckoutRecovery(data: BasicCheckoutInfoFormSchema) {
  const response = await fetch('/next-api/shop/checkout/recovery/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.email, recipientName: getRecipientName(data) }),
  });
  const payload = (await response.json()) as PaidCheckoutRecoveryStartResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.message ?? 'Unable to check whether this email has a checkout recovery case.',
    );
  }

  return payload;
}
