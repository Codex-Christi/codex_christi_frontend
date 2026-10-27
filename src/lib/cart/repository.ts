import { deepEqual } from 'fast-equals';
import {
  revealBrowserText,
  revealLegacyCryptoJsBrowserText,
} from '@/lib/crypto/browserObfuscatedStorage';
import {
  createCartDocument,
  editCart,
  mergeGuestCart,
  normalizeCartDocument,
  normalizeCartLines,
  projectCart,
} from './model';
import type { CartCheckoutSnapshot, CartDocument, CartOwner } from './types';

type Records = Record<string, unknown>;
type TransactionResult<T> = { value: T; writes?: Records };
export interface CartStorageDriver {
  run<T>(keys: string[], change: (records: Records) => TransactionResult<T>): Promise<T>;
}

export function cartId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

/** Mutations run inside a single IndexedDB transaction, including across browser tabs. */
export class IndexedCartDriver implements CartStorageDriver {
  private connection: Promise<IDBDatabase> | undefined;

  private open() {
    if (!this.connection) {
      this.connection = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined')
          return reject(new Error('Device storage is unavailable.'));
        const request = indexedDB.open('codex-christi-cart', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('records');
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error('Close older shop tabs to update cart storage.'));
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            this.connection = undefined;
          };
          database.onclose = () => {
            this.connection = undefined;
          };
          resolve(database);
        };
      }).catch((error) => {
        this.connection = undefined;
        throw error;
      });
    }
    return this.connection;
  }

  async run<T>(keys: string[], change: (records: Records) => TransactionResult<T>): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      const records: Records = {};
      let value: T;
      let remaining = keys.length;
      let failure: unknown;
      const apply = () => {
        try {
          const result = change(records);
          value = result.value;
          for (const [key, record] of Object.entries(result.writes ?? {})) store.put(record, key);
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = transaction.onerror = () =>
        reject(failure ?? transaction.error ?? new Error('Cart storage failed.'));
      if (!remaining) apply();
      for (const key of keys) {
        const request = store.get(key);
        request.onsuccess = () => {
          records[key] = request.result;
          if (!--remaining) apply();
        };
      }
    });
  }
}

const keyFor = (owner: CartOwner) => `cart:${owner}`;
const MIGRATION_KEY = 'migration:cart-storage:v1';

export class CartRepository {
  private migration: Promise<void> | undefined;
  constructor(
    private driver: CartStorageDriver = new IndexedCartDriver(),
    private legacyStorage: () => Storage | undefined = () =>
      typeof window === 'undefined' ? undefined : window.localStorage,
    private notify: () => void = () => {},
  ) {}

  private announce() {
    try {
      this.notify();
    } catch {
      /* Storage already committed; messaging is best-effort. */
    }
  }

  private document(records: Records, owner: CartOwner) {
    const stored = records[keyFor(owner)];
    if (stored === undefined) return createCartDocument(owner, cartId());
    const document = normalizeCartDocument(stored, owner);
    if (!document)
      throw new Error('Your saved cart needs recovery. Its original copy has been preserved.');
    return document;
  }

  private async migrateLegacy() {
    if (!this.migration) {
      this.migration = (async () => {
        const migrated = await this.driver.run([MIGRATION_KEY], (records) => ({
          value: records[MIGRATION_KEY] === true,
        }));
        if (migrated) return;
        const storage = this.legacyStorage();
        const original = storage?.getItem('cart-storage');
        let lines: ReturnType<typeof normalizeCartLines> = [];
        if (original) {
          try {
            const publicKey = process.env.NEXT_PUBLIC_CART_KEY || 'fallback-secret';
            const json = original.startsWith('{')
              ? original
              : original.startsWith('ob1.')
                ? await revealBrowserText(original, publicKey, 'cart-storage')
                : await revealLegacyCryptoJsBrowserText(original, publicKey);
            const decoded: unknown = JSON.parse(json);
            const state =
              decoded && typeof decoded === 'object' && 'state' in decoded ? decoded.state : null;
            const variants =
              state && typeof state === 'object' && 'variants' in state ? state.variants : null;
            if (!Array.isArray(variants)) throw new Error('Invalid saved cart');
            lines = normalizeCartLines(variants);
            if (variants.length && !lines.length) throw new Error('Invalid saved items');
          } catch {
            throw new Error(
              'Your previously saved cart couldn’t be opened in this browser. Its original copy is safe.',
            );
          }
        }
        await this.driver.run([MIGRATION_KEY, keyFor('guest')], (records) => {
          if (records[MIGRATION_KEY] === true) return { value: undefined };
          let guest = this.document(records, 'guest');
          for (const line of lines) guest = editCart(guest, { type: 'add', line }, cartId());
          guest = { ...guest, revision: guest.revision + 1 };
          return { value: undefined, writes: { [MIGRATION_KEY]: true, [keyFor('guest')]: guest } };
        });
        // Keep the legacy record as a recovery copy. The transaction marker prevents re-import.
      })().catch((error) => {
        this.migration = undefined;
        throw error;
      });
    }
    await this.migration;
  }

  async read(owner: CartOwner) {
    await this.migrateLegacy();
    return this.driver.run([keyFor(owner)], (records) => {
      const document = this.document(records, owner);
      return {
        value: document,
        ...(records[keyFor(owner)] === undefined ? { writes: { [keyFor(owner)]: document } } : {}),
      };
    });
  }

  async update(owner: CartOwner, change: (document: CartDocument) => CartDocument) {
    await this.migrateLegacy();
    let changed = false;
    const result = await this.driver.run([keyFor(owner)], (records) => {
      const previous = this.document(records, owner);
      const next = change(previous);
      if (next.owner !== owner || next.cartId !== previous.cartId)
        throw new Error('Cart ownership changed.');
      if (next === previous || deepEqual(next, previous))
        return {
          value: previous,
          ...(records[keyFor(owner)] === undefined
            ? { writes: { [keyFor(owner)]: previous } }
            : {}),
        };
      const document = { ...next, revision: previous.revision + 1 };
      changed = true;
      return { value: document, writes: { [keyFor(owner)]: document } };
    });
    if (changed) this.announce();
    return result;
  }

  async adoptGuest(owner: CartOwner) {
    if (owner === 'guest') return this.read(owner);
    await this.migrateLegacy();
    let changed = false;
    const result = await this.driver.run([keyFor(owner), keyFor('guest')], (records) => {
      const account = this.document(records, owner);
      const guest = this.document(records, 'guest');
      if (!projectCart(guest).length)
        return {
          value: account,
          ...(records[keyFor(owner)] === undefined ? { writes: { [keyFor(owner)]: account } } : {}),
        };
      const merged = { ...mergeGuestCart(account, guest, cartId), revision: account.revision + 1 };
      changed = true;
      return {
        value: merged,
        writes: {
          [keyFor(owner)]: merged,
          [keyFor('guest')]: createCartDocument('guest', cartId()),
        },
      };
    });
    if (changed) this.announce();
    return result;
  }

  async recordCheckout(orderId: string, snapshot: CartCheckoutSnapshot) {
    await this.migrateLegacy();
    const key = keyFor(snapshot.owner);
    await this.driver.run([key], (records) => {
      const document = this.document(records, snapshot.owner);
      if (document.cartId !== snapshot.cartId)
        throw new Error('The cart changed. Please review it before checkout.');
      const checkoutSnapshots = Object.fromEntries(
        Object.entries({ ...document.checkoutSnapshots, [orderId]: snapshot }).slice(-200),
      );
      return {
        value: undefined,
        writes: {
          [key]: { ...document, checkoutSnapshots, revision: document.revision + 1 },
          [`purchase-owner:${orderId}`]: snapshot.owner,
        },
      };
    });
    this.announce();
  }

  async purchaseOwner(orderId: string): Promise<CartOwner | null> {
    return this.driver.run([`purchase-owner:${orderId}`], (records) => {
      const owner = records[`purchase-owner:${orderId}`];
      return {
        value:
          owner === 'guest' || (typeof owner === 'string' && owner.startsWith('user:'))
            ? (owner as CartOwner)
            : null,
      };
    });
  }

  /** A short renewable IndexedDB lease also works on HTTP LAN previews without Web Locks. */
  async withLease(owner: CartOwner, task: (ownsLease: () => Promise<boolean>) => Promise<void>) {
    const key = `lease:${owner}`;
    const token = cartId();
    const renew = (acquire = false) =>
      this.driver.run([key], (records) => {
        const lease = records[key] as { token?: string; expires?: number } | undefined;
        const owned = lease?.token === token;
        if (!owned && (!acquire || (lease?.expires ?? 0) > Date.now())) return { value: false };
        return { value: true, writes: { [key]: { token, expires: Date.now() + 45_000 } } };
      });
    if (!(await renew(true))) return false;
    const heartbeat = setInterval(() => {
      void renew().catch(() => {});
    }, 10_000);
    try {
      await task(() => renew());
    } finally {
      clearInterval(heartbeat);
      await this.driver
        .run([key], (records) => ({
          value: undefined,
          ...(records[key] && (records[key] as { token?: string }).token === token
            ? { writes: { [key]: { token, expires: 0 } } }
            : {}),
        }))
        .catch(() => {});
    }
    return true;
  }
}
