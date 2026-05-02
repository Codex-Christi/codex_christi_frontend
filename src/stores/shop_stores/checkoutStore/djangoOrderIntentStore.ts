'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encrypt, decrypt } from '../cartStore';
import { createEncryptedStorage } from '.';

interface DjangoOrderIntentState {
  djangoOrderIntentUuid: string;
  djangoOrderIntentOrderId: string;
  djangoOrderIntentPayload: unknown | null;
  djangoOrderIntentVerifyPayload: unknown | null;
  setDjangoOrderIntent: (intent: {
    djangoOrderIntentUuid?: string | null;
    djangoOrderIntentOrderId?: string | null;
    djangoOrderIntentPayload?: unknown | null;
    djangoOrderIntentVerifyPayload?: unknown | null;
  }) => void;
  clearDjangoOrderIntent: () => void;
}

const initialState = {
  djangoOrderIntentUuid: '',
  djangoOrderIntentOrderId: '',
  djangoOrderIntentPayload: null,
  djangoOrderIntentVerifyPayload: null,
};

export const useDjangoOrderIntentStore = create<DjangoOrderIntentState>()(
  persist(
    (set) => ({
      ...initialState,
      setDjangoOrderIntent: (intent) =>
        set((state) => ({
          djangoOrderIntentUuid:
            intent.djangoOrderIntentUuid ?? state.djangoOrderIntentUuid,
          djangoOrderIntentOrderId:
            intent.djangoOrderIntentOrderId ?? state.djangoOrderIntentOrderId,
          djangoOrderIntentPayload:
            intent.djangoOrderIntentPayload === undefined
              ? state.djangoOrderIntentPayload
              : intent.djangoOrderIntentPayload,
          djangoOrderIntentVerifyPayload:
            intent.djangoOrderIntentVerifyPayload === undefined
              ? state.djangoOrderIntentVerifyPayload
              : intent.djangoOrderIntentVerifyPayload,
        })),
      clearDjangoOrderIntent: () => set({ ...initialState }),
    }),
    {
      name: 'django-order-intent-store',
      storage: createEncryptedStorage<DjangoOrderIntentState>({ encrypt, decrypt }),
    },
  ),
);
