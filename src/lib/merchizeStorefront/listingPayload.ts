import { z } from 'zod';
import { assertBasicStorefrontProductData } from './snapshot';
import { shouldUseStorefrontSnapshot } from './providerErrors';

export const STOREFRONT_LISTING_TIMEOUT_MS = 15_000;

export class InvalidStorefrontListingPayloadError extends Error {
  constructor() {
    super('Merchize returned an invalid storefront listing response.');
    this.name = 'InvalidStorefrontListingPayloadError';
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new InvalidStorefrontListingPayloadError();
  return result.data;
}

const identity = z.string().trim().min(1).max(256);
const response = z.object({ success: z.literal(true).optional() });
const collections = response.extend({
  data: z.object({ collections: z.array(z.object({ _id: identity })) }),
});
const metadata = response.extend({
  data: z.object({
    name: identity,
    description: z.string().nullish(),
    cover: z.object({ url: z.string() }).nullish(),
  }),
});
const listing = response.extend({
  data: z.object({
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    products: z.array(
      z.looseObject({
        _id: identity,
        title: z.string().trim().min(1),
        retail_price: z
          .union([z.string().trim().min(1), z.number()])
          .refine((price) => Number.isFinite(Number(price)) && Number(price) >= 0),
      }),
    ),
  }),
});

export function parseStorefrontCollections(value: unknown) {
  return parse(collections, value).data.collections;
}

export function parseStorefrontCategoryMetadata(value: unknown) {
  return parse(metadata, value).data;
}

export function parseStorefrontListing(value: unknown, page: number, limit: number) {
  const data = parse(listing, value).data;
  if (
    data.page !== page ||
    data.products.length > limit ||
    data.total < data.products.length ||
    (data.total > 0 && data.pages === 0) ||
    new Set(data.products.map((product) => product._id)).size !== data.products.length
  )
    throw new InvalidStorefrontListingPayloadError();

  return {
    ...data,
    products: data.products.map((product) => assertBasicStorefrontProductData(product)),
  };
}

export function canUseSavedListing(error: unknown) {
  return (
    shouldUseStorefrontSnapshot(error) ||
    error instanceof InvalidStorefrontListingPayloadError ||
    error instanceof SyntaxError
  );
}
