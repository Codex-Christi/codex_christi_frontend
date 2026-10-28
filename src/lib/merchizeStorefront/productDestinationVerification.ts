import 'server-only';
import { countries } from 'country-data-list';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { loadExtrasBySku } from '@/lib/datasetSearchers/merchize/shipping.data';
import { PUBLISHED_SHOP_PRODUCT_IDS } from '@/lib/utils/shopHomePageProductsData';
import {
  createStorefrontVerificationContext,
  resolveProviderStorefrontProductCompatibility,
} from './currentProductLineCompatibility';
import {
  evaluateDestinationOptions,
  type ProductUnavailabilityReason,
} from './destinationAvailability';

export async function verifyProductForDestination(
  productId: string,
  countryIso3: string,
  options: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
    context?: ReturnType<typeof createStorefrontVerificationContext>;
  } = {},
) {
  options.signal?.throwIfAborted();
  const country = countries.all.find(
    (country) => country.alpha3 === countryIso3 && country.alpha3.length === 3,
  );
  if (!country) throw new Error('Choose a valid delivery country.');
  const context = options.context ?? createStorefrontVerificationContext(options);
  try {
    context.signal?.throwIfAborted();
    const result = await resolveProviderStorefrontProductCompatibility(productId, {
      dependencies: context.dependencies,
      loadProduct: context.loadProduct,
      persist: true,
      signal: context.signal,
    });
    const candidates = result.compatibility.results.filter(
      (result) => result.status === 'available' && result.supplierSku,
    );
    const catalog = await context.resolveCatalogVariants(
      candidates.map((result) => result.supplierSku!),
    );
    const shipping = evaluateDestinationOptions({
      options: candidates.map((result) => ({
        variantId: result.storefrontVariantId,
        sku: result.supplierSku!,
      })),
      catalogRows: catalog.variants.map((variant) => variant.catalogRow),
      unverifiedSkus: catalog.unverifiedSkus,
      countryIso3,
      extrasBySku: candidates.length ? await loadExtrasBySku() : undefined,
    });
    const available = new Set(shipping.availableVariantIds);
    const unverifiedCount =
      shipping.unverifiedVariantIds.length +
      result.compatibility.results.filter((result) => result.status === 'unverified').length;
    const reason: ProductUnavailabilityReason = available.size
      ? null
      : unverifiedCount
        ? 'verification_unavailable'
        : shipping.unsupportedVariantIds.length
          ? 'shipping_unavailable'
          : 'product_unavailable';
    const check = {
      checkedAt: new Date(),
      availableCount: available.size,
      unsupportedCount: shipping.unsupportedVariantIds.length,
      unverifiedCount,
      reason,
      completed: true,
    };
    context.signal?.throwIfAborted();
    await db.storefrontProductDestinationCheck
      .upsert({
        where: {
          merchizeProductId_countryIso3: {
            merchizeProductId: result.productMetaData._id,
            countryIso3,
          },
        },
        create: { merchizeProductId: result.productMetaData._id, countryIso3, ...check },
        update: check,
      })
      .catch(() => console.warn('[storefrontDestinationCheck] summary write failed'));
    return {
      variants: result.compatibility.sellableVariants.filter((variant) =>
        available.has(variant._id),
      ),
      countryName: country.name,
      countryIso3,
      check,
      reason,
    };
  } catch (error) {
    if (context.signal?.aborted) throw error;
    const data = {
      checkedAt: new Date(),
      availableCount: 0,
      unsupportedCount: 0,
      unverifiedCount: 0,
      reason: 'verification_unavailable',
      completed: false,
    };
    const knownProduct =
      PUBLISHED_SHOP_PRODUCT_IDS.includes(productId) ||
      Boolean(
        await db.storefrontProductSnapshot
          .findUnique({ where: { merchizeProductId: productId }, select: { id: true } })
          .catch(() => null),
      );
    context.signal?.throwIfAborted();
    if (knownProduct)
      await db.storefrontProductDestinationCheck
        .upsert({
          where: { merchizeProductId_countryIso3: { merchizeProductId: productId, countryIso3 } },
          create: { merchizeProductId: productId, countryIso3, ...data },
          update: data,
        })
        .catch(() =>
          console.warn('[storefrontDestinationCheck] failed check could not be recorded'),
        );
    throw error;
  }
}
