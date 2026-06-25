'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEncryptedStorage } from '.';
import { decrypt, encrypt } from '../cartStore';

export type ActivePayPalCheckoutStage =
  | 'paypal_order_created'
  | 'paypal_window_opened'
  | 'paypal_cancelled'
  | 'paypal_approved'
  | 'capture_checking'
  | 'confirmation_opened';

export type ActivePayPalCheckout = {
  orderToken: string;
  stage: ActivePayPalCheckoutStage;
  createdAt: string;
  updatedAt: string;
};

type PayPalIntentState = {
  orderToken?: string;
  activeCheckout: ActivePayPalCheckout | null;
  setIntent: (payload: {
    orderToken: string;
    stage?: ActivePayPalCheckoutStage;
  }) => void;
  setActiveCheckoutStage: (
    stage: ActivePayPalCheckoutStage,
    payload?: { orderToken?: string },
  ) => void;
  clearActiveCheckout: () => void;
  clearIntent: () => void;
};
type PayPalIntentPersistedState = Pick<PayPalIntentState, 'orderToken' | 'activeCheckout'>;

function createActiveCheckout({
  orderToken,
  stage = 'paypal_order_created',
}: {
  orderToken: string;
  stage?: ActivePayPalCheckoutStage;
}): ActivePayPalCheckout {
  const now = new Date().toISOString();

  return {
    orderToken,
    stage,
    createdAt: now,
    updatedAt: now,
  };
}

export const usePayPalIntentStore = create<PayPalIntentState>()(
  persist(
    (set) => ({
      orderToken: undefined,
      activeCheckout: null,
      setIntent: ({ orderToken, stage }) =>
        set({
          orderToken,
          activeCheckout: createActiveCheckout({ orderToken, stage }),
        }),
      setActiveCheckoutStage: (stage, payload) =>
        set((state) => {
          const activeCheckout =
            state.activeCheckout ??
            (payload?.orderToken
              ? createActiveCheckout({
                  orderToken: payload.orderToken,
                  stage,
                })
              : null);

          if (!activeCheckout) return state;

          return {
            orderToken: payload?.orderToken ?? state.orderToken ?? activeCheckout.orderToken,
            activeCheckout: {
              ...activeCheckout,
              orderToken: payload?.orderToken ?? activeCheckout.orderToken,
              stage,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      clearActiveCheckout: () => set({ activeCheckout: null }),
      clearIntent: () => set({ orderToken: undefined }),
    }),
    {
      name: 'paypal-intent-store',
      storage: createEncryptedStorage<PayPalIntentPersistedState>({ encrypt, decrypt }),
      partialize: (state): PayPalIntentPersistedState => ({
        orderToken: state.orderToken,
        activeCheckout: state.activeCheckout,
      }),
    },
  ),
);
