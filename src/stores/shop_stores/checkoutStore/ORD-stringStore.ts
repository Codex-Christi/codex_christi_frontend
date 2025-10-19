'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encrypt, decrypt } from '../cartStore';
import { createEncryptedStorage } from '.';

interface OrderStringState {
  orderString: string;
  setOrderString: (newString: string) => void;
}

export const useOrderStringStore = create<OrderStringState>()(
  persist(
    (set) => ({
      orderString: '',
      setOrderString: (newString) => set({ orderString: newString }),
    }),
    {
      name: 'order-string-store',
      storage: createEncryptedStorage<OrderStringState>({ encrypt, decrypt }),
    },
  ),
);
