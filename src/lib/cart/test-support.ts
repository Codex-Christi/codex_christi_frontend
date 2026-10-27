import { CartRepository, type CartStorageDriver } from './repository';
import type { CartVariant } from './types';

type Records = Record<string, unknown>;

export class MemoryCartDriver implements CartStorageDriver {
  readonly records = new Map<string, unknown>();
  fail = false;
  beforeRun?: (keys: string[]) => Promise<void>;
  private queue = Promise.resolve();

  run<T>(keys: string[], change: (records: Records) => { value: T; writes?: Records }): Promise<T> {
    const operation = this.queue.then(async () => {
      if (this.fail) throw new Error('Device storage is full.');
      await this.beforeRun?.(keys);
      const records = Object.fromEntries(
        keys.map((key) => [key, structuredClone(this.records.get(key))]),
      );
      const result = change(records);
      for (const [key, value] of Object.entries(result.writes ?? {}))
        this.records.set(key, structuredClone(value));
      return structuredClone(result.value);
    });
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}

export class MemoryLegacyStorage extends Map<string, string> implements Storage {
  get length() {
    return this.size;
  }
  getItem(key: string) {
    return this.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.set(key, value);
  }
  removeItem(key: string) {
    this.delete(key);
  }
  key(index: number) {
    return [...this.keys()][index] ?? null;
  }
}

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

export function cartLine(variantId = 'shirt-m', quantity = 1): CartVariant {
  return {
    variantId,
    quantity,
    title: 'Shirt',
    slug: 'shirt',
    itemDetail: {
      _id: variantId,
      title: 'Medium',
      product: 'shirt',
      sku: variantId,
      retail_price: 25,
      is_default: false,
      image_uris: [],
      options: [],
    },
  };
}

export function memoryRepository(
  driver = new MemoryCartDriver(),
  legacy = new MemoryLegacyStorage(),
) {
  return new CartRepository(driver, () => legacy);
}
