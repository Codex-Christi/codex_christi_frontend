// verifiedEmailsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEncryptedStorage } from '.';
import { decrypt, encrypt } from '../cartStore';

interface VerifiedEmailsState {
  verifiedEmailsList: Record<string, boolean>;
  addEmailToVerifiedList: (email: string) => void;
  getEmailStatus: (email: string) => boolean | undefined;
  clearStore: () => void;
}

export const useVerifiedEmailsStore = create<VerifiedEmailsState>()(
  persist(
    (set, get) => ({
      verifiedEmailsList: {},
      addEmailToVerifiedList: (email) =>
        set((s) => ({ verifiedEmailsList: { ...s.verifiedEmailsList, [email]: true } })),
      getEmailStatus: (email) => {
        return get().verifiedEmailsList[email];
      },
      clearStore: () => set({ verifiedEmailsList: {} }),
    }),
    {
      name: 'verifiedEmailsList-emails',
      storage: createEncryptedStorage<VerifiedEmailsState>({ encrypt, decrypt }),
    },
  ),
);
