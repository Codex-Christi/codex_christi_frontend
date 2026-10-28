import {
  obfuscateBrowserText,
  revealBrowserText,
  revealLegacyCryptoJsBrowserText,
} from '@/lib/crypto/browserObfuscatedStorage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_CART_KEY || 'fallback-secret';
export type CheckoutStorageIssue = {
  purpose: string;
  message: string;
  severity: 'warning' | 'error';
};
export const EMPTY_CHECKOUT_STORAGE_ISSUES: readonly CheckoutStorageIssue[] = [];
let issues = EMPTY_CHECKOUT_STORAGE_ISSUES;
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<void>>();
const retries = new Map<string, () => Promise<void>>();
export const getCheckoutStorageIssues = () => issues;
export const subscribeCheckoutStorageIssues = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function report(purpose: string, issue?: Omit<CheckoutStorageIssue, 'purpose'>, saved = false) {
  if (!saved && issues.some((item) => item.purpose === purpose && item.severity === 'error'))
    return;
  if (issues.find((item) => item.purpose === purpose)?.message === issue?.message) return;
  issues = [
    ...issues.filter((item) => item.purpose !== purpose),
    ...(issue ? [{ purpose, ...issue }] : []),
  ];
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* Notifications cannot undo saved state. */
    }
  });
}
export async function flushCheckoutStorage(purpose?: string) {
  for (;;) {
    const writes = purpose ? [[purpose, pending.get(purpose)] as const] : [...pending.entries()];
    await Promise.all(writes.map(([, write]) => write));
    if (
      writes.every(([key, write]) => pending.get(key) === write) &&
      (purpose || writes.length === pending.size)
    )
      break;
  }
  const failure = issues.find(
    (item) => (!purpose || item.purpose === purpose) && item.severity === 'error',
  );
  if (failure) throw new Error(failure.message);
}

export async function retryCheckoutStorage(purpose?: string) {
  await Promise.all(purpose ? [pending.get(purpose)] : [...pending.values()]);
  const failed = issues.filter(
    (issue) => issue.severity === 'error' && (!purpose || issue.purpose === purpose),
  );
  await Promise.all(failed.map((issue) => retries.get(issue.purpose)?.()));
  await flushCheckoutStorage(purpose);
}

type StorageOptions = {
  getStorage?: () => Storage;
  cryptoAvailable?: () => boolean;
};

/** Old email-wide flags and recovery summaries no longer authorize checkout. */
export function clearLegacyCheckoutCaches(options?: StorageOptions) {
  return Promise.all(
    ['paid-checkout-recovery-store', 'verifiedEmailsList-emails'].map((name) =>
      createCheckoutObfuscatedStorage(name, undefined, options).removeItem(name),
    ),
  );
}

/** A separate current record preserves old encrypted data when a browser cannot decrypt it. */
export function createCheckoutObfuscatedStorage<S>(
  purpose: string,
  sanitize?: (value: StorageValue<S>) => StorageValue<S> | null,
  {
    getStorage = () => window.localStorage,
    cryptoAvailable = () => Boolean(globalThis.crypto?.subtle),
  }: StorageOptions = {},
): PersistStorage<S, Promise<void>> {
  let generation = 0;
  let queue = Promise.resolve();
  let latestOperation: (() => Promise<void> | void) | undefined;
  const enqueue = (operation: () => Promise<void> | void, remember = true) => {
    if (remember) latestOperation = operation;
    generation += 1;
    queue = queue
      .then(operation)
      .then(() => report(purpose, undefined, true))
      .catch(() => {
        report(purpose, {
          severity: 'error',
          message:
            'Checkout changes could not be saved on this device. Keep this page open and try again before paying.',
        });
      });
    pending.set(purpose, queue);
    return queue;
  };
  retries.set(purpose, () => (latestOperation ? enqueue(latestOperation, false) : queue));
  const validate = (decoded: unknown): StorageValue<S> => {
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('state' in decoded) ||
      !decoded.state ||
      typeof decoded.state !== 'object' ||
      Array.isArray(decoded.state)
    )
      throw new Error('Invalid saved checkout');
    const result = sanitize ? sanitize(decoded as StorageValue<S>) : (decoded as StorageValue<S>);
    if (!result) throw new Error('Invalid saved checkout');
    return result;
  };
  return {
    getItem: async (name) => {
      const started = generation;
      await queue;
      if (started !== generation) return null;
      try {
        const storage = getStorage();
        const stored = storage.getItem(`${name}:v2`) ?? storage.getItem(name);
        if (!stored) return null;
        if (!stored.startsWith('{') && !cryptoAvailable())
          throw new Error('Decryption unavailable');
        const json = stored.startsWith('{')
          ? stored
          : stored.startsWith('ob1.')
            ? await revealBrowserText(stored, PUBLIC_KEY, purpose)
            : await revealLegacyCryptoJsBrowserText(stored, PUBLIC_KEY);
        const decoded = validate(JSON.parse(json));
        if (started !== generation) return null;
        report(purpose);
        return decoded;
      } catch {
        if (started !== generation) return null;
        report(purpose, {
          severity: 'warning',
          message:
            'A previously saved checkout could not be opened. Its original copy is safe; review your details before continuing.',
        });
        return null;
      }
    },
    setItem: (name, value) => {
      const saved = JSON.stringify(value);
      return enqueue(async () => {
        const storage = getStorage();
        const key = `${name}:v2`;
        const encrypted = cryptoAvailable();
        const previous = storage.getItem(key);
        if (
          previous &&
          ((!encrypted && !previous.startsWith('{')) ||
            issues.some((item) => item.purpose === purpose && item.severity === 'warning')) &&
          !storage.getItem(`${name}:recovery`)
        )
          storage.setItem(`${name}:recovery`, previous);
        storage.setItem(
          key,
          encrypted ? await obfuscateBrowserText(saved, PUBLIC_KEY, purpose) : saved,
        );
      });
    },
    removeItem: (name) =>
      enqueue(() => {
        const storage = getStorage();
        for (const key of [name, `${name}:v2`, `${name}:recovery`]) storage.removeItem(key);
      }),
  };
}
