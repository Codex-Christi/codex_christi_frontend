'use server';

import { getDollarMultiplier } from '@/actions/shop/general/currencyConvert';
import { resolveCanonicalOrderSnapshotFromMerchize } from '@/lib/paypal/orderSnapshot/merchizeResolver';
import { extractCanonicalOrderSelectionsFromCart } from '@/lib/paypal/orderSnapshot/resolver';
import {
  canonicalReviewItemsHash,
  canonicalReviewLines,
  canonicalReviewPreviewTotals,
} from '@/lib/shop/checkout/checkoutReviewLines';
import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import {
  dropShippingSupplier,
  getCountrySupport,
  ShippingCountryObj,
} from '@/lib/datasetSearchers/shippingSupportMerchize';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { cache } from 'react';

export const getOrderFinalDetails = cache(
  async (
    cart: CartVariant[],
    country_iso3: ShippingCountryObj['country_iso3'],
    supplier: dropShippingSupplier,
  ) => {
    const countryIso3 = normalizeCountryToIso3(country_iso3);
    if (!countryIso3) throw new Error('A valid destination is required.');
    const snapshot = await resolveCanonicalOrderSnapshotFromMerchize({
      selections: extractCanonicalOrderSelectionsFromCart(cart),
      destination: { countryIso3 },
    });
    const [countrySupport, conversion] = await Promise.all([
      getCountrySupport(countryIso3, supplier),
      getDollarMultiplier(countryIso3),
    ]);
    return {
      countrySupport,
      finalPricesWithShippingFee: canonicalReviewPreviewTotals(
        snapshot,
        conversion.currency === snapshot.currency ? conversion.multiplier : 1,
      ),
      reviewLines: canonicalReviewLines(snapshot),
      reviewItemsHash: canonicalReviewItemsHash(snapshot),
    };
  },
);
