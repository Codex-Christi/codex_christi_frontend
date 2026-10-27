import 'server-only';

import { getDollarMultiplier } from '@/actions/shop/general/currencyConvert';
import { PAYPAL_CURRENCY_CODES } from '@/datasets/shop_general/paypal_currency_specifics';
import { loadExtrasBySku } from '@/lib/datasetSearchers/merchize/shipping.data';
import {
  CanonicalOrderResolutionError,
  resolveCanonicalOrderSnapshot,
  type CanonicalOrderResolverDependencies,
} from './resolver';
import { calculateStrictShippingQuoteUsd } from './strictShipping';
import type { CanonicalOrderResolutionInput } from './types';
import { isMerchizeStorefrontProductAvailable } from './merchizeAvailability';
import {
  createStorefrontVerificationContext,
  resolveProviderStorefrontProductCompatibility,
} from '@/lib/merchizeStorefront/currentProductLineCompatibility';
import { mapCompatibleMerchizeVariants } from './mapCompatibleMerchizeVariants';

type Context = ReturnType<typeof createStorefrontVerificationContext>;

function createOrderDependencies(
  input: CanonicalOrderResolutionInput,
  context: Context,
): CanonicalOrderResolverDependencies {
  return {
    async resolveProduct(lookup) {
      const result = await resolveProviderStorefrontProductCompatibility(lookup, {
        persist: true,
        dependencies: context.dependencies,
        loadProduct: context.loadProduct,
        selectedVariantIds: input.selections
          .filter((s) => s.productId === lookup)
          .map((s) => s.variantId),
      });
      const product = result.productMetaData;
      const isAvailable = isMerchizeStorefrontProductAvailable(product);
      return {
        productId: product._id,
        title: product.title,
        isAvailable,
        variants: isAvailable
          ? mapCompatibleMerchizeVariants({
              variants: result.productVariants,
              livePrices: new Map(result.productVariants.map((v) => [v._id, v.retail_price])),
              compatibilityResults: result.compatibility.results,
            })
          : [],
      };
    },
    async resolveCatalogVariants(skus) {
      const result = await context.resolveCatalogVariants(skus);
      if (!result.generationAvailable || result.variants.length !== new Set(skus).size) {
        throw new CanonicalOrderResolutionError(
          'MISSING_CATALOG_VARIANT',
          'Current supplier data could not be verified.',
          503,
        );
      }
      return result.variants;
    },
    async resolveCurrency(countryIso3) {
      const conversion = await getDollarMultiplier(countryIso3);
      const currency = conversion.currency?.toUpperCase() ?? 'USD';
      return PAYPAL_CURRENCY_CODES.includes(currency as (typeof PAYPAL_CURRENCY_CODES)[number])
        ? { currency, multiplier: conversion.multiplier }
        : { currency: 'USD', multiplier: 1 };
    },
    resolveShipping: async ({ lines, catalogVariants, countryIso3 }) =>
      calculateStrictShippingQuoteUsd({
        lines,
        catalogRows: catalogVariants.map((v) => v.catalogRow),
        countryIso3,
        extrasBySku: await loadExtrasBySku(),
      }),
  };
}

export async function resolveCanonicalOrderSnapshotFromMerchize(
  input: CanonicalOrderResolutionInput,
  context = createStorefrontVerificationContext(),
) {
  return resolveCanonicalOrderSnapshot(input, createOrderDependencies(input, context));
}
