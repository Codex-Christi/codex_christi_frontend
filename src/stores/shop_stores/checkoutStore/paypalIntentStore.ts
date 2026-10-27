'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StorageValue } from 'zustand/middleware';
import { createCheckoutObfuscatedStorage } from './storage';

export type ActivePayPalCheckoutStage =
  | 'paypal_order_created'
  | 'paypal_window_opened'
  | 'paypal_cancelled'
  | 'paypal_approved'
  | 'capture_checking'
  | 'confirmation_opened';
export type ActivePayPalCheckoutPaymentSurface = 'paypal_buttons' | 'card';
export type CheckoutAttempt = {
  attemptId: string;
  inputKey: string;
  orderToken?: string;
  paypalOrderId?: string;
};
export type ActivePayPalCheckout = {
  orderToken: string;
  stage: ActivePayPalCheckoutStage;
  paymentSurface?: ActivePayPalCheckoutPaymentSurface | null;
  createdAt: string;
  updatedAt: string;
};
type Intent = {
  orderToken: string;
  paypalOrderId?: string;
  stage?: ActivePayPalCheckoutStage;
  paymentSurface?: ActivePayPalCheckoutPaymentSurface | null;
};
type PayPalIntentState = {
  orderToken?: string;
  checkoutAttempt: CheckoutAttempt | null;
  activeCheckout: ActivePayPalCheckout | null;
  setIntent: (payload: Intent) => void;
  setActiveCheckoutStage: (
    stage: ActivePayPalCheckoutStage,
    payload?: { orderToken?: string; paymentSurface?: ActivePayPalCheckoutPaymentSurface | null },
  ) => void;
  clearActiveCheckout: (orderToken?: string) => void;
  clearIntent: (orderToken?: string) => void;
};
type PersistedState = Pick<PayPalIntentState, 'orderToken' | 'checkoutAttempt' | 'activeCheckout'>;
const id = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.set(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))); // Retry identity; server proof authorizes payment.
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const active = (payload: Intent): ActivePayPalCheckout => ({
  orderToken: payload.orderToken,
  stage: payload.stage ?? 'paypal_order_created',
  paymentSurface: payload.paymentSurface ?? null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
const stages = new Set([
  'paypal_order_created',
  'paypal_window_opened',
  'paypal_cancelled',
  'paypal_approved',
  'capture_checking',
  'confirmation_opened',
]);
function sanitizeIntent(value: StorageValue<PersistedState>): StorageValue<PersistedState> {
  const state = value.state;
  const orderToken =
    typeof state.orderToken === 'string' && state.orderToken.length <= 500
      ? state.orderToken
      : undefined;
  const previous = state.activeCheckout;
  const activeCheckout =
    previous &&
    typeof previous.orderToken === 'string' &&
    stages.has(previous.stage) &&
    Number.isFinite(Date.parse(previous.updatedAt))
      ? {
          orderToken: previous.orderToken,
          stage: previous.stage,
          paymentSurface:
            previous.paymentSurface === 'card' ? ('card' as const) : ('paypal_buttons' as const),
          createdAt: previous.createdAt,
          updatedAt: previous.updatedAt,
        }
      : null;
  const saved = state.checkoutAttempt;
  const checkoutAttempt =
    saved &&
    typeof saved.attemptId === 'string' &&
    typeof saved.inputKey === 'string' &&
    saved.orderToken === orderToken
      ? {
          attemptId: saved.attemptId,
          inputKey: saved.inputKey,
          ...(orderToken ? { orderToken } : {}),
          ...(typeof saved.paypalOrderId === 'string'
            ? { paypalOrderId: saved.paypalOrderId }
            : {}),
        }
      : orderToken
        ? { attemptId: `legacy:${orderToken}`, inputKey: '', orderToken }
        : null;
  return { ...value, state: { orderToken, activeCheckout, checkoutAttempt } };
}
export const usePayPalIntentStore = create<PayPalIntentState>()(
  persist(
    (set) => ({
      orderToken: undefined,
      checkoutAttempt: null,
      activeCheckout: null,
      setIntent: (payload) =>
        set((state) => ({
          orderToken: payload.orderToken,
          checkoutAttempt: {
            ...(state.checkoutAttempt ?? { attemptId: id(), inputKey: '' }),
            orderToken: payload.orderToken,
            paypalOrderId: payload.paypalOrderId,
          },
          activeCheckout: active(payload),
        })),
      setActiveCheckoutStage: (stage, payload) =>
        set((state) => {
          if (
            !state.activeCheckout ||
            (payload?.orderToken && state.activeCheckout.orderToken !== payload.orderToken)
          )
            return state;
          return {
            activeCheckout: {
              ...state.activeCheckout,
              stage,
              paymentSurface: payload?.paymentSurface ?? state.activeCheckout.paymentSurface,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      clearActiveCheckout: (orderToken) =>
        set((state) =>
          !orderToken || state.activeCheckout?.orderToken === orderToken
            ? { activeCheckout: null }
            : state,
        ),
      clearIntent: (orderToken) =>
        set((state) =>
          !orderToken || state.orderToken === orderToken
            ? { orderToken: undefined, checkoutAttempt: null }
            : state,
        ),
    }),
    {
      name: 'paypal-intent-store',
      storage: createCheckoutObfuscatedStorage<PersistedState>(
        'paypal-intent-store',
        sanitizeIntent,
      ),
      partialize: ({ orderToken, checkoutAttempt, activeCheckout }) => ({
        orderToken,
        checkoutAttempt,
        activeCheckout,
      }),
      skipHydration: typeof window === 'undefined',
    },
  ),
);

export function beginCheckoutAttempt(inputKey: string): CheckoutAttempt {
  const current = usePayPalIntentStore.getState().checkoutAttempt;
  if (current?.inputKey === inputKey) return current;
  if (current?.orderToken)
    throw new Error('Check your earlier payment before starting a separate order.');
  const attempt = { attemptId: id(), inputKey };
  usePayPalIntentStore.setState({
    checkoutAttempt: attempt,
    orderToken: undefined,
    activeCheckout: null,
  });
  return attempt;
}
export function captureCheckoutAttempt(orderToken?: string): CheckoutAttempt | null {
  const attempt = usePayPalIntentStore.getState().checkoutAttempt;
  return attempt && (!orderToken || attempt.orderToken === orderToken) ? { ...attempt } : null;
}
export const isCurrentCheckoutAttempt = (attempt: CheckoutAttempt) =>
  usePayPalIntentStore.getState().checkoutAttempt?.attemptId === attempt.attemptId;
export function completeCheckoutAttempt(attempt: CheckoutAttempt, payload: Intent): boolean {
  if (!isCurrentCheckoutAttempt(attempt)) return false;
  const current = usePayPalIntentStore.getState().checkoutAttempt;
  if (
    current?.orderToken &&
    (current.orderToken !== payload.orderToken || current.paypalOrderId !== payload.paypalOrderId)
  )
    return false;
  usePayPalIntentStore.getState().setIntent(payload);
  return true;
}
export function setCheckoutAttemptStage(
  attempt: CheckoutAttempt,
  stage: ActivePayPalCheckoutStage,
): boolean {
  if (!isCurrentCheckoutAttempt(attempt) || !attempt.orderToken) return false;
  const currentStage = usePayPalIntentStore.getState().activeCheckout?.stage;
  if (
    currentStage &&
    ['paypal_approved', 'capture_checking', 'confirmation_opened'].includes(currentStage) &&
    ['paypal_order_created', 'paypal_window_opened', 'paypal_cancelled'].includes(stage)
  )
    return false;
  usePayPalIntentStore.getState().setActiveCheckoutStage(stage, { orderToken: attempt.orderToken });
  return true;
}
export function clearCheckoutAttempt(attempt: CheckoutAttempt): boolean {
  if (!isCurrentCheckoutAttempt(attempt)) return false;
  usePayPalIntentStore.setState({
    checkoutAttempt: null,
    orderToken: undefined,
    activeCheckout: null,
  });
  return true;
}
