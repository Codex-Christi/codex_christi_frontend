'use server';

import { getProductDetailsFromSnapshot } from '@/lib/merchizeStorefront/snapshot';
import type { ProductVariantsInterface } from '@/lib/merchizeStorefront/productTypes';
import type { CartVariant } from '@/stores/shop_stores/cartStore';

type SnapshotVariant = ProductVariantsInterface['data'][number];

export async function hydrateCartDisplayFromMerchizeOfflineCatalog(
  cart: CartVariant[],
): Promise<CartVariant[]> {
  if (!Array.isArray(cart) || cart.length === 0) return [];

  return Promise.all(cart.map((cartItem) => hydrateCartItem(cartItem)));
}

async function hydrateCartItem(cartItem: CartVariant): Promise<CartVariant> {
  const lookupKeys = getProductLookupKeys(cartItem);

  for (const key of lookupKeys) {
    const snapshot = await getProductDetailsFromSnapshot(key);
    if (!snapshot) continue;

    const snapshotVariant = findMatchingSnapshotVariant(snapshot.productVariants, cartItem);
    if (!snapshotVariant) continue;

    const image = resolveMerchizeImage(
      snapshotVariant.image_uris?.[0] ?? cartItem.itemDetail.image,
    );

    return {
      ...cartItem,
      title: snapshot.productMetaData.title || cartItem.title,
      slug: snapshot.productMetaData.slug || cartItem.slug,
      itemDetail: {
        ...cartItem.itemDetail,
        ...snapshotVariant,
        image,
        sku_seller: cartItem.itemDetail.sku_seller ?? snapshotVariant.sku,
      },
    };
  }

  return cartItem;
}

function getProductLookupKeys(cartItem: CartVariant) {
  return Array.from(
    new Set(
      [
        cartItem.itemDetail.product,
        cartItem.slug,
        cartItem.itemDetail._id === cartItem.itemDetail.product ? cartItem.itemDetail._id : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function findMatchingSnapshotVariant(variants: SnapshotVariant[], cartItem: CartVariant) {
  const variantId = cartItem.variantId || cartItem.itemDetail._id;
  const sku = cartItem.itemDetail.sku;

  return variants.find((variant) => variant._id === variantId || (!!sku && variant.sku === sku));
}

function resolveMerchizeImage(image: string | null | undefined) {
  if (!image) return undefined;
  return image.startsWith('http') ? image : `https://d2dytk4tvgwhb4.cloudfront.net/${image}`;
}
