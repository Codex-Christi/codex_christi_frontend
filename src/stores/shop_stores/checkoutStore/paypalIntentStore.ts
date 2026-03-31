'use client';
import { create } from 'zustand';

type PayPalIntentState = {
  orderToken?: string;
  paypalOrderId?: string;
  setIntent: (payload: { orderToken: string; paypalOrderId: string }) => void;
  clearIntent: () => void;
};

export const usePayPalIntentStore = create<PayPalIntentState>((set) => ({
  orderToken: undefined,
  paypalOrderId: undefined,
  setIntent: ({ orderToken, paypalOrderId }) => set({ orderToken, paypalOrderId }),
  clearIntent: () => set({ orderToken: undefined, paypalOrderId: undefined }),
}));
