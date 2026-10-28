import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import type { Prisma } from '@/lib/prisma/shop/merchize/generated/merchizeCatalog/client';
import type {
  BasicProductInterface,
  ProductResult,
  ProductVariantsInterface,
} from '@/lib/merchizeStorefront/productTypes';
import { resolveProductGalleryImages } from '@/lib/merchizeStorefront/imageUrls';
import { getCategoryPagePath } from '@/lib/utils/shop/categoryPagePath';
import { getStorefrontPublication } from './publication';

type BasicProductData = BasicProductInterface['data'];
type ProductVariantsData = ProductVariantsInterface['data'];
type BasicProductPayload = Record<string, unknown> & {
  _id: string;
  title: string;
  retail_price: string | number;
};

type CategoryMetaSnapshotInput = {
  categorySlug: string;
  merchizeCategoryId?: string | null;
  name?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  rawCategoryJson?: unknown;
  force?: boolean;
};

type CategoryPageSnapshotInput = {
  categorySlug: string;
  merchizeCategoryId?: string | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  products: unknown[];
  force?: boolean;
};

export type SnapshotCategoryProductsResponse = {
  next: string | null;
  previous: string | null;
  current_page: number;
  products: BasicProductData[];
  totalPages: number;
  count: number;
};

export type SnapshotCategoryMetadataResponse = {
  cover: { url: string } | null;
  description: string;
  name: string;
  categoryID: string | null;
};

export function normalizeStorefrontCategorySlug(input: string) {
  return input.trim().toLowerCase();
}

export class InvalidStorefrontProductPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStorefrontProductPayloadError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isInvalidStorefrontProductPayloadError(
  error: unknown,
): error is InvalidStorefrontProductPayloadError {
  return (
    error instanceof InvalidStorefrontProductPayloadError ||
    (!!error &&
      typeof error === 'object' &&
      (error as { name?: unknown }).name === 'InvalidStorefrontProductPayloadError')
  );
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getInvalidBasicProductPayloadFields(value: unknown) {
  if (!value || typeof value !== 'object') return ['data'];

  const candidate = value as Record<string, unknown>;
  const invalidFields: string[] = [];

  if (!isNonEmptyString(candidate._id)) invalidFields.push('data._id');
  if (!isNonEmptyString(candidate.title)) invalidFields.push('data.title');
  if (typeof candidate.retail_price !== 'string' && typeof candidate.retail_price !== 'number') {
    invalidFields.push('data.retail_price');
  }

  return invalidFields;
}

export function isBasicStorefrontProductData(value: unknown): value is BasicProductPayload {
  return getInvalidBasicProductPayloadFields(value).length === 0;
}

export function assertBasicStorefrontProductData(
  value: unknown,
  context = 'Storefront product',
): BasicProductData {
  const invalidFields = getInvalidBasicProductPayloadFields(value);
  if (invalidFields.length) {
    throw new InvalidStorefrontProductPayloadError(
      `${context} payload is missing required fields: ${invalidFields.join(', ')}.`,
    );
  }

  const product = value as BasicProductPayload;

  return {
    ...product,
    _id: product._id,
    title: product.title,
    description: typeof product.description === 'string' ? product.description : '',
    image: typeof product.image === 'string' ? product.image : '',
    retail_price: String(product.retail_price),
    slug: typeof product.slug === 'string' && product.slug ? product.slug : product._id,
  } satisfies BasicProductData;
}

function storefrontSnapshotTtlMs() {
  const raw = process.env.MERCHIZE_STOREFRONT_SNAPSHOT_TTL_DAYS ?? '1';
  const days = Number(raw);
  if (!Number.isFinite(days) || days < 0) return 24 * 60 * 60 * 1000;
  return days * 24 * 60 * 60 * 1000;
}

function isFresh(timestamp: Date | null | undefined, now = new Date()) {
  const ttl = storefrontSnapshotTtlMs();
  if (ttl === 0) return false;
  return !!timestamp && now.getTime() - timestamp.getTime() < ttl;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseRetailPrice(value: BasicProductData['retail_price'] | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBasicProductData(snapshot: {
  merchizeProductId: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  retailPrice: number | null;
  variantsJson?: Prisma.JsonValue | null;
  rawProductJson?: Prisma.JsonValue | null;
}): BasicProductData {
  const rawProduct =
    snapshot.rawProductJson &&
    typeof snapshot.rawProductJson === 'object' &&
    !Array.isArray(snapshot.rawProductJson)
      ? snapshot.rawProductJson
      : {};

  return {
    ...rawProduct,
    _id: snapshot.merchizeProductId,
    title: snapshot.title ?? 'Product',
    description: snapshot.description ?? '',
    image:
      resolveProductGalleryImages({
        metadata: { ...rawProduct, image: snapshot.image },
        variants: isProductVariantsData(snapshot.variantsJson) ? snapshot.variantsJson : null,
      })[0] ?? '',
    retail_price: String(snapshot.retailPrice ?? 0),
    slug: snapshot.slug ?? snapshot.merchizeProductId,
  };
}

function isProductVariantsData(value: unknown): value is ProductVariantsData {
  return (
    Array.isArray(value) &&
    value.every(
      (variant) =>
        variant &&
        typeof variant === 'object' &&
        typeof (variant as { _id?: unknown })._id === 'string' &&
        Array.isArray((variant as { options?: unknown }).options),
    )
  );
}

function productSnapshotWhere(productIDorSlug: string) {
  return {
    OR: [{ merchizeProductId: productIDorSlug }, { slug: productIDorSlug }],
  };
}

export async function upsertStorefrontProductSnapshot(
  product: unknown,
  opts: {
    force?: boolean;
    refreshPublication?: boolean;
    observedAt?: Date;
    signal?: AbortSignal;
  } = {},
) {
  opts.signal?.throwIfAborted();
  const validProduct = assertBasicStorefrontProductData(
    product,
    'Storefront product snapshot upsert',
  );
  const now = opts.observedAt ?? new Date();
  const retailPrice = parseRetailPrice(validProduct.retail_price);
  // Keep the publication check and write atomic against concurrent listing/verification reads.
  await merchizeCatalogPrisma.$transaction(async (db) => {
    const existing = await db.storefrontProductSnapshot.findUnique({
      where: { merchizeProductId: validProduct._id },
      select: { lastProductFetchAt: true, rawProductJson: true },
    });
    opts.signal?.throwIfAborted();
    const publication = getStorefrontPublication(validProduct);
    const previousPublication = getStorefrontPublication(existing?.rawProductJson);
    // A slow older positive check cannot resurrect a newer confirmed removal.
    if (
      publication === 'published' &&
      previousPublication === 'unpublished' &&
      opts.observedAt &&
      existing?.lastProductFetchAt &&
      existing.lastProductFetchAt > opts.observedAt
    )
      return;
    const publicationChanged = publication !== 'unknown' && publication !== previousPublication;
    if (
      !opts.force &&
      isFresh(existing?.lastProductFetchAt, now) &&
      !(publicationChanged && opts.refreshPublication)
    )
      return;
    if (previousPublication === 'unpublished' && publication === 'unknown') return;
    const image = resolveProductGalleryImages({ metadata: validProduct })[0] ?? null;

    const data = {
      slug: validProduct.slug ?? null,
      title: validProduct.title ?? null,
      description: validProduct.description ?? null,
      image,
      retailPrice,
      rawProductJson: toJsonValue(validProduct),
      lastSeenAt: now,
      lastProductFetchAt: now,
    };
    await db.storefrontProductSnapshot.upsert({
      where: { merchizeProductId: validProduct._id },
      create: { merchizeProductId: validProduct._id, ...data },
      update: data,
    });
  });
}

export async function upsertStorefrontProductVariantsSnapshot(
  productIDorSlug: string,
  variants: ProductVariantsData,
  opts: { force?: boolean } = {},
) {
  if (!variants.length) return;

  const now = new Date();
  const parentProductId =
    variants.find((variant) => typeof variant.product === 'string' && variant.product)?.product ??
    productIDorSlug;
  const defaultVariant = variants.find((variant) => variant.is_default) ?? variants[0];
  const existing = await merchizeCatalogPrisma.storefrontProductSnapshot.findUnique({
    where: { merchizeProductId: parentProductId },
    select: { lastVariantsFetchAt: true },
  });

  if (!opts.force && isFresh(existing?.lastVariantsFetchAt, now)) return;
  const image = resolveProductGalleryImages({ variants })[0];

  await merchizeCatalogPrisma.storefrontProductSnapshot.upsert({
    where: { merchizeProductId: parentProductId },
    create: {
      merchizeProductId: parentProductId,
      slug: parentProductId === productIDorSlug ? null : productIDorSlug,
      title: defaultVariant.title ?? null,
      description: '',
      image: image ?? null,
      retailPrice: parseRetailPrice(defaultVariant.retail_price),
      variantsJson: toJsonValue(variants),
      variantCount: variants.length,
      lastSeenAt: now,
      lastVariantsFetchAt: now,
    },
    update: {
      image,
      variantsJson: toJsonValue(variants),
      variantCount: variants.length,
      lastSeenAt: now,
      lastVariantsFetchAt: now,
    },
  });
}

export async function upsertStorefrontCategorySnapshot(input: CategoryMetaSnapshotInput) {
  const now = new Date();
  const categorySlug = normalizeStorefrontCategorySlug(input.categorySlug);
  const existing = await merchizeCatalogPrisma.storefrontCategorySnapshot.findUnique({
    where: { categorySlug },
    select: { lastMetadataFetchAt: true },
  });

  if (!input.force && isFresh(existing?.lastMetadataFetchAt, now)) return existing;

  return merchizeCatalogPrisma.storefrontCategorySnapshot.upsert({
    where: { categorySlug },
    create: {
      categorySlug,
      merchizeCategoryId: input.merchizeCategoryId ?? null,
      name: input.name ?? displayCategoryName(categorySlug),
      description: input.description ?? null,
      coverUrl: input.coverUrl ?? null,
      rawCategoryJson: toJsonValue(input.rawCategoryJson),
      lastSuccessfulFetchAt: now,
      lastMetadataFetchAt: now,
    },
    update: {
      merchizeCategoryId: input.merchizeCategoryId ?? undefined,
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      coverUrl: input.coverUrl ?? undefined,
      rawCategoryJson: toJsonValue(input.rawCategoryJson),
      lastSuccessfulFetchAt: now,
      lastMetadataFetchAt: now,
    },
  });
}

export async function upsertStorefrontCategoryPageSnapshot(input: CategoryPageSnapshotInput) {
  const now = new Date();
  const categorySlug = normalizeStorefrontCategorySlug(input.categorySlug);
  const existingCategory = await merchizeCatalogPrisma.storefrontCategorySnapshot.findUnique({
    where: { categorySlug },
    select: { lastProductsFetchAt: true },
  });

  if (!input.force && isFresh(existingCategory?.lastProductsFetchAt, now)) {
    const savedPage = await getCategoryProductsSnapshotState({
      category: categorySlug,
      page: input.page,
      page_size: input.pageSize,
    });
    if (savedPage?.isFresh) return;
  }

  const category = await merchizeCatalogPrisma.storefrontCategorySnapshot.upsert({
    where: { categorySlug },
    create: {
      categorySlug,
      merchizeCategoryId: input.merchizeCategoryId ?? null,
      name: displayCategoryName(categorySlug),
      totalProducts: input.total,
      totalPages: input.totalPages,
      lastSyncedPage: input.page,
      lastSuccessfulFetchAt: now,
      lastProductsFetchAt: now,
    },
    update: {
      merchizeCategoryId: input.merchizeCategoryId ?? undefined,
      totalProducts: input.total,
      totalPages: input.totalPages,
      lastSyncedPage: input.page,
      lastSuccessfulFetchAt: now,
      lastProductsFetchAt: now,
    },
  });

  const savedProductIds: string[] = [];
  for (const [index, rawProduct] of input.products.entries()) {
    let product: BasicProductData;
    try {
      product = assertBasicStorefrontProductData(
        rawProduct,
        `Storefront category product ${categorySlug} page ${input.page} index ${index}`,
      );
    } catch (err) {
      console.warn('[storefrontSnapshot] category product snapshot skipped:', err);
      continue;
    }

    await upsertStorefrontProductSnapshot(product, { force: input.force });

    const productRecord = await merchizeCatalogPrisma.storefrontProductSnapshot.findUnique({
      where: { merchizeProductId: product._id },
      select: { id: true },
    });
    if (!productRecord) continue;
    savedProductIds.push(productRecord.id);

    await merchizeCatalogPrisma.storefrontCategoryProduct.upsert({
      where: {
        categoryId_productId: {
          categoryId: category.id,
          productId: productRecord.id,
        },
      },
      create: {
        categoryId: category.id,
        productId: productRecord.id,
        position: (input.page - 1) * input.pageSize + index,
        lastSeenAt: now,
      },
      update: {
        position: (input.page - 1) * input.pageSize + index,
        lastSeenAt: now,
      },
    });
  }
  if (savedProductIds.length === input.products.length) {
    const start = (input.page - 1) * input.pageSize;
    await merchizeCatalogPrisma.storefrontCategoryProduct.deleteMany({
      where: {
        categoryId: category.id,
        OR: [
          { position: { gte: input.total } },
          {
            position: { gte: start, lt: start + input.pageSize },
            productId: { notIn: savedProductIds },
          },
        ],
      },
    });
  }
}

export async function getBasicProductFromSnapshot(productIDorSlug: string) {
  const snapshot = await merchizeCatalogPrisma.storefrontProductSnapshot.findFirst({
    where: productSnapshotWhere(productIDorSlug),
  });

  return snapshot ? toBasicProductData(snapshot) : null;
}

export async function getBasicProductSnapshotState(productIDorSlug: string) {
  const snapshot = await merchizeCatalogPrisma.storefrontProductSnapshot.findFirst({
    where: productSnapshotWhere(productIDorSlug),
  });

  if (!snapshot) return null;

  return {
    product: toBasicProductData(snapshot),
    isFresh: isFresh(snapshot.lastProductFetchAt),
    lastFetchedAt: snapshot.lastProductFetchAt,
  };
}

export async function getProductVariantsFromSnapshot(productIDorSlug: string) {
  const snapshot = await merchizeCatalogPrisma.storefrontProductSnapshot.findFirst({
    where: productSnapshotWhere(productIDorSlug),
    select: { variantsJson: true },
  });

  if (!isProductVariantsData(snapshot?.variantsJson)) return null;
  return snapshot.variantsJson;
}

export async function getProductVariantsSnapshotState(productIDorSlug: string) {
  const snapshot = await merchizeCatalogPrisma.storefrontProductSnapshot.findFirst({
    where: productSnapshotWhere(productIDorSlug),
    select: { variantsJson: true, lastVariantsFetchAt: true },
  });

  if (!isProductVariantsData(snapshot?.variantsJson)) return null;

  return {
    variants: snapshot.variantsJson,
    isFresh: isFresh(snapshot.lastVariantsFetchAt),
    lastFetchedAt: snapshot.lastVariantsFetchAt,
  };
}

export async function getProductDetailsFromSnapshot(
  productIDorSlug: string,
): Promise<ProductResult | null> {
  const snapshot = await merchizeCatalogPrisma.storefrontProductSnapshot.findFirst({
    where: productSnapshotWhere(productIDorSlug),
  });

  if (!snapshot || !isProductVariantsData(snapshot.variantsJson)) return null;

  return {
    productMetaData: toBasicProductData(snapshot),
    productVariants: snapshot.variantsJson,
  };
}

export async function getCategoryMetadataFromSnapshot(categoryName: string) {
  const snapshotState = await getCategoryMetadataSnapshotState(categoryName);
  return snapshotState?.category ?? null;
}

export async function getCategoryMetadataSnapshotState(categoryName: string) {
  const categorySlug = normalizeStorefrontCategorySlug(categoryName);
  const snapshot = await merchizeCatalogPrisma.storefrontCategorySnapshot.findUnique({
    where: { categorySlug },
  });

  if (!snapshot) return null;

  return {
    category: {
      cover: snapshot.coverUrl ? { url: snapshot.coverUrl } : null,
      description:
        snapshot.description ?? `Buy ${snapshot.name ?? displayCategoryName(categorySlug)} now.`,
      name: snapshot.name ?? displayCategoryName(categorySlug),
      categoryID: snapshot.merchizeCategoryId ?? null,
    } satisfies SnapshotCategoryMetadataResponse,
    isFresh: isFresh(snapshot.lastMetadataFetchAt),
    lastFetchedAt: snapshot.lastMetadataFetchAt,
  };
}

export async function getCategoryIdFromSnapshot(categoryName: string) {
  const categorySlug = normalizeStorefrontCategorySlug(categoryName);
  const snapshot = await merchizeCatalogPrisma.storefrontCategorySnapshot.findUnique({
    where: { categorySlug },
    select: { merchizeCategoryId: true },
  });

  return snapshot?.merchizeCategoryId ?? null;
}

export async function getCategoryProductsFromSnapshot({
  category,
  page,
  page_size,
}: {
  category: string;
  page: number;
  page_size: number;
}): Promise<SnapshotCategoryProductsResponse | null> {
  const snapshotState = await getCategoryProductsSnapshotState({ category, page, page_size });
  return snapshotState?.products ?? null;
}

export async function getCategoryProductsSnapshotState({
  category,
  page,
  page_size,
}: {
  category: string;
  page: number;
  page_size: number;
}): Promise<{
  products: SnapshotCategoryProductsResponse;
  isFresh: boolean;
  lastFetchedAt: Date | null;
} | null> {
  const categorySlug = normalizeStorefrontCategorySlug(category);
  const snapshot = await merchizeCatalogPrisma.storefrontCategorySnapshot.findUnique({
    where: { categorySlug },
    select: { id: true, totalProducts: true, lastProductsFetchAt: true },
  });

  if (!snapshot?.lastProductsFetchAt) return null;

  const count =
    snapshot.totalProducts ??
    (await merchizeCatalogPrisma.storefrontCategoryProduct.count({
      where: { categoryId: snapshot.id },
    }));
  const totalPages = Math.max(1, Math.ceil(count / page_size));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  if (safePage !== page) return null;

  const rows = await merchizeCatalogPrisma.storefrontCategoryProduct.findMany({
    where: {
      categoryId: snapshot.id,
      position: { gte: (page - 1) * page_size, lt: page * page_size },
    },
    include: { product: true },
    orderBy: [{ position: 'asc' }, { lastSeenAt: 'desc' }],
    take: page_size + 1,
  });
  // Category-level TTL does not prove that this particular page was saved in full.
  const expectedCount = Math.min(page_size, Math.max(0, count - (page - 1) * page_size));
  if (
    rows.length !== expectedCount ||
    rows.some((row, index) => row.position !== (page - 1) * page_size + index)
  )
    return null;
  const pageFetchedAt = rows.length
    ? new Date(Math.min(...rows.map((row) => row.lastSeenAt.getTime())))
    : snapshot.lastProductsFetchAt;

  return {
    products: {
      next: safePage < totalPages ? getCategoryPagePath(categorySlug, safePage + 1) : null,
      previous: safePage > 1 ? getCategoryPagePath(categorySlug, safePage - 1) : null,
      current_page: safePage,
      products: rows.map((row) => toBasicProductData(row.product)),
      totalPages,
      count,
    },
    isFresh: isFresh(pageFetchedAt),
    lastFetchedAt: pageFetchedAt,
  };
}

function displayCategoryName(categorySlug: string) {
  return categorySlug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
