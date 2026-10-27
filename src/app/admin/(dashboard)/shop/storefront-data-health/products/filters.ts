export const PRODUCT_DIRECTORY_ROUTE = '/admin/shop/storefront-data-health/products';
export const PRODUCT_DIRECTORY_PAGE_SIZE = 12;

export function readProductDirectoryFilters(
  params: Record<string, string | string[] | undefined>,
  defaultCountry?: string | null,
) {
  const value = (key: string) => (typeof params[key] === 'string' ? params[key] : '');
  const page = Number(value('page'));
  return {
    query: value('q').trim().slice(0, 100),
    country:
      normalizeCountryToIso3(value('country')) ?? normalizeCountryToIso3(defaultCountry) ?? 'USA',
    attentionOnly: value('attention') === '1',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function productDirectoryHref(
  filters: ReturnType<typeof readProductDirectoryFilters>,
  page = 1,
) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  params.set('country', filters.country);
  if (filters.attentionOnly) params.set('attention', '1');
  if (page > 1) params.set('page', String(page));
  return `${PRODUCT_DIRECTORY_ROUTE}${params.size ? `?${params}` : ''}`;
}
import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
