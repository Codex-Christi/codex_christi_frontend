import type { ProductVariantOptions } from '@/lib/merchizeStorefront/productTypes';

export type VariantOption = {
  is_preselected: boolean;
  position: number;
  hide_storefront: boolean;
  slug: string;
  value: string;
  name: string;
  attribute: {
    _id: string;
    name: 'Product' | 'Size' | 'Color';
    value_type: 'slide' | 'size' | 'color';
  };
};

export type VariantDetail = {
  _id: string;
  sides?: string[];
  image_uris: string[];
  retail_price: number;
  is_default: boolean;
  sku?: string;
  sku_seller?: string;
  /** Fulfillment must verify this value again; browser metadata is never authoritative. */
  supplierSku?: string;
  title: string;
  weight?: number;
  options: VariantOption[] | ProductVariantOptions;
  product?: string;
  base_cost?: number;
  image?: string;
};

export type CartVariant = {
  variantId: string;
  quantity: number;
  title: string;
  slug: string;
  itemDetail: VariantDetail;
};

export type CartOwner = 'guest' | `user:${string}`;
export type CartWriteKind = 'add' | 'update' | 'remove';

export type CartEdit = {
  id: string;
  line: CartVariant;
  quantity: number;
  baseQuantity: number | null;
  /** Before the first server read, this quantity is a local contribution to merge once. */
  merge?: boolean;
  conflict?: { remoteQuantity: number };
  error?: string;
};

export type CartFlight = {
  editId: string;
  variantId: string;
  quantity: number;
  baseQuantity: number;
  kind: CartWriteKind;
  phase: 'sending' | 'uncertain';
  /** The mutation returned success, even if its confirmation read was interrupted. */
  acknowledged?: boolean;
  error?: string;
};

export type CartPurchaseLine = { variantId: string; quantity: number; lineage?: string };
export type CartPurchase = {
  orderId: string;
  lines: Pick<CartPurchaseLine, 'variantId' | 'quantity'>[];
};
export type CartCheckoutSnapshot = {
  owner: CartOwner;
  cartId: string;
  lines: CartPurchaseLine[];
};

export type CartDocument = {
  version: 1;
  owner: CartOwner;
  cartId: string;
  revision: number;
  baseline: CartVariant[];
  fetched: boolean;
  edits: Record<string, CartEdit>;
  flights: Record<string, CartFlight>;
  lineage: Record<string, string>;
  consumedOrderIds: string[];
  importedGuestIds: string[];
  checkoutSnapshots: Record<string, CartCheckoutSnapshot>;
};

export type CartCommand =
  | { type: 'add'; line: CartVariant }
  | { type: 'setQuantity'; variantId: string; quantity: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' };
