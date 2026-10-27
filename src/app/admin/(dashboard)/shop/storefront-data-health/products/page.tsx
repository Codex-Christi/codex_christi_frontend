import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getStorefrontProductDirectory } from './productDirectoryData';
import { PRODUCT_DIRECTORY_ROUTE, productDirectoryHref } from './filters';
import StorefrontProductList from './StorefrontProductList';
import ProductDirectoryFilters from './ProductDirectoryFilters';
import { adminGlassPanelClass } from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';
import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import { isAdminScopeAllowed } from '@/lib/admin/admin-config';

export const metadata: Metadata = { title: 'Delivery Checker | Codex Christi Admin' };
export const dynamic = 'force-dynamic';

export default async function StorefrontProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminPage({ scope: 'shop.view', returnPath: PRODUCT_DIRECTORY_ROUTE });
  const canCheck = isAdminScopeAllowed(admin.scopes, 'shop.catalog.refresh', admin.role);
  const params = await searchParams;
  const selectedCountry =
    typeof params.country === 'string' ? normalizeCountryToIso3(params.country) : null;
  const profileCountry = selectedCountry ? null : (await getUser())?.country;
  const data = await getStorefrontProductDirectory(params, profileCountry).catch((error) => {
    console.error('[storefrontProducts] local directory read failed', error);
    return null;
  });
  return (
    <div className='mx-auto max-w-7xl space-y-5 px-4 py-6 text-white sm:px-6'>
      <Link
        href='/admin/shop/storefront-data-health'
        className='inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white'
      >
        <ArrowLeft size={15} />
        Storefront Health
      </Link>
      {!data ? (
        <p role='alert'>
          Saved storefront products could not be loaded. Check the local catalog database and try
          again.
        </p>
      ) : (
        <>
          <ProductDirectoryFilters
            key={productDirectoryHref(data.filters, data.filters.page)}
            filters={data.filters}
          />
          <div className={`${adminGlassPanelClass} px-4`}>
            <StorefrontProductList
              key={`${canCheck}:${data.filters.country}:${data.filters.query}:${data.rows.map((row) => row.productId).join(',')}`}
              rows={data.rows}
              filters={data.filters}
              canCheck={canCheck}
            />
          </div>
        </>
      )}
    </div>
  );
}
