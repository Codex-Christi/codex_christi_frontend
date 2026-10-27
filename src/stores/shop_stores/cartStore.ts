import { create } from 'zustand';
import { CartController, initialCartView, type CartView } from '@/lib/cart/controller';
import { CartRepository } from '@/lib/cart/repository';
import type {
  CartCheckoutSnapshot,
  CartOwner,
  CartPurchaseLine,
  CartVariant,
} from '@/lib/cart/types';

export type { CartVariant, VariantDetail, VariantOption } from '@/lib/cart/types';

interface CartState extends CartView {
  addToCart: (line: CartVariant) => Promise<void>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  reduceFromCart: (variantId: string, quantity?: number) => Promise<void>;
  removeFromCart: (variantId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  resolveConflict: (variantId: string, choice: 'local' | 'remote') => Promise<void>;
  retrySync: () => Promise<void>;
  createCheckoutSnapshot: () => CartCheckoutSnapshot;
  recordCheckout: (orderId: string, snapshot: CartCheckoutSnapshot) => Promise<void>;
  consumePurchase: (orderId: string, lines: CartPurchaseLine[]) => Promise<void>;
}

let broadcast: (() => void) | undefined;
export const cartController = new CartController(
  new CartRepository(undefined, undefined, () => broadcast?.()),
  (view) => useCartStore.setState(view),
);

export const useCartStore = create<CartState>(() => ({
  ...initialCartView,
  addToCart: (line) => cartController.command({ type: 'add', line }),
  setQuantity: (variantId, quantity) =>
    cartController.command({ type: 'setQuantity', variantId, quantity }),
  reduceFromCart: (variantId, quantity = 1) => cartController.reduce(variantId, quantity),
  removeFromCart: (variantId) => cartController.command({ type: 'remove', variantId }),
  clearCart: () => cartController.command({ type: 'clear' }),
  resolveConflict: (variantId, choice) => cartController.resolveConflict(variantId, choice),
  retrySync: () => cartController.retry(),
  createCheckoutSnapshot: () => cartController.checkoutSnapshot(),
  recordCheckout: (orderId, snapshot) => cartController.recordCheckout(orderId, snapshot),
  consumePurchase: (orderId, lines) => cartController.consumePurchase(orderId, lines),
}));

export function connectCartLifecycle(
  readSession: () => { owner: CartOwner | null; authenticated: boolean },
  subscribe: (listener: () => void) => () => void,
) {
  const syncSession = () => {
    const session = readSession();
    void cartController.activate(session.owner, session.authenticated);
  };
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel('codex-cart');
    channel.onmessage = () => {
      void cartController.refresh();
    };
    broadcast = () => channel?.postMessage('changed');
  } catch {
    /* IndexedDB transactions still preserve writes when messaging is unavailable. */
  }
  const refresh = () => {
    if (document.visibilityState !== 'hidden') {
      void cartController.refresh();
      cartController.schedule(0);
    }
  };
  const unsubscribe = subscribe(syncSession);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  const interval = setInterval(refresh, 30_000);
  syncSession();
  return () => {
    unsubscribe();
    channel?.close();
    broadcast = undefined;
    clearInterval(interval);
    cartController.dispose();
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', refresh);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
