'use client';
import { create } from 'zustand';

type PayPalIntentState = {
  orderToken?: string;
  setIntent: (payload: { orderToken: string }) => void;
  clearIntent: () => void;
};

export const usePayPalIntentStore = create<PayPalIntentState>((set) => ({
  orderToken: undefined,
  setIntent: ({ orderToken }) => set({ orderToken }),
  clearIntent: () => set({ orderToken: undefined }),
}));
