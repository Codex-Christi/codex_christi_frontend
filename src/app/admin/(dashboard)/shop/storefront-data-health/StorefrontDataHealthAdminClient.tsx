'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  Store,
  Truck,
} from 'lucide-react';
import type {
  StorefrontProductCheck,
  SyncState,
} from '@/lib/prisma/shop/merchize/generated/merchizeCatalog/client';
import type { VariantPublicationIssueSummary } from './variantPublicationIssuesData';
import { adminGlassPanelClass } from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import { describeStorefrontIssue } from './issuePresentation';
import {
  checkStorefrontAction,
  generateShopSeoManifestAction,
  getStorefrontSnapshotStats,
  refreshPriceShippingCatalogAction,
  refreshStorefrontSnapshotsAction,
  runStorefrontMetadataDiagnosticsAction,
  searchPriceShippingCatalogBySku,
} from './actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/primitives/alert-dialog';

type Props = {
  initialSyncState: SyncState | null;
  initialStorefrontSnapshotStats: Awaited<ReturnType<typeof getStorefrontSnapshotStats>>;
  initialVariantPublicationIssueSummary: VariantPublicationIssueSummary;
  productChecks: Omit<StorefrontProductCheck, 'supplierOptionsJson'>[];
  managedProductCount: number;
};
const buttonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50';
const date = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleString() : 'Not checked';

export default function StorefrontDataHealthAdminClient({
  initialSyncState: sync,
  initialStorefrontSnapshotStats: stats,
  initialVariantPublicationIssueSummary: issues,
  productChecks,
  managedProductCount,
}: Props) {
  const router = useRouter();
  const [job, setJob] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [sku, setSku] = useState('');
  const [records, setRecords] = useState<Awaited<
    ReturnType<typeof searchPriceShippingCatalogBySku>
  > | null>(null);
  const [diagnostics, setDiagnostics] = useState<Awaited<
    ReturnType<typeof runStorefrontMetadataDiagnosticsAction>
  > | null>(null);
  const searchNeedsUpdate =
    !stats.seoManifest.generatedAt ||
    stats.seoManifest.isStale ||
    stats.seoManifest.missingPublishedProductIds.length > 0 ||
    stats.seoManifest.missingCategorySlugs.length > 0;
  const temporaryChecks = productChecks.filter(
    (check) => !check.completed || check.unverifiedCount > 0,
  );
  const unpublishedProducts = productChecks
    .filter(
      (check) =>
        check.completed &&
        !check.productAvailable &&
        !issues.products.some((p) => p.productId === check.merchizeProductId),
    )
    .map((check) => ({
      productId: check.merchizeProductId,
      title: check.title,
      optionCount: 0,
      reasons: ['STOREFRONT_PRODUCT_EXPLICITLY_UNAVAILABLE'],
      lastObservedAt: check.checkedAt,
    }));
  const affectedProducts = [...issues.products, ...unpublishedProducts];
  const products = affectedProducts.filter((product) =>
    `${product.title} ${product.productId}`.toLowerCase().includes(filter.toLowerCase()),
  );

  async function run(label: string, action: () => Promise<{ ok: boolean; text: string }>) {
    if (job) return;
    setJob(label);
    setNotice(null);
    try {
      setNotice(await action());
      router.refresh();
    } catch {
      setNotice({ ok: false, text: 'The action could not complete. Please try again.' });
    } finally {
      setJob(null);
    }
  }
  const check = (productId?: string) =>
    run(productId ? 'Checking product' : 'Checking storefront', async () => {
      const result = await checkStorefrontAction(productId);
      if (result.metadata) setDiagnostics(result.metadata);
      return {
        ok: result.ok,
        text: result.availability.ok
          ? `Checked ${result.availability.productCount} ${result.availability.productCount === 1 ? 'product' : 'products'}: ${result.availability.unavailableCount} options flagged, ${result.availability.unverifiedCount} could not be verified, ${result.availability.scanErrors.length} product checks failed.`
          : 'The product check could not complete. Saved issues have not been cleared.',
      };
    });

  return (
    <div className='mx-auto max-w-7xl space-y-8 px-4 py-6 text-white sm:px-6'>
      <details
        open
        id='storefront-maintenance'
        className={`${adminGlassPanelClass} scroll-mt-24 p-4`}
      >
        <summary className='cursor-pointer text-base font-semibold'>Maintenance</summary>
        <div className='mt-4 flex flex-wrap gap-3'>
          <Link className={buttonClass} href='/admin/shop/storefront-data-health/products'>
            <Truck size={16} />
            Delivery Checker
          </Link>
          <MaintenanceAction
            title='Update Storefront Pages'
            description='Fetch current product and category page details, rebuild search previews, and revalidate shop pages. This does not run a separate availability scan.'
            icon={<Store size={16} />}
            disabled={!!job}
            confirm={() =>
              void run('Updating storefront pages', async () => {
                const result = await refreshStorefrontSnapshotsAction();
                return {
                  ok: result.ok,
                  text: result.ok
                    ? 'Storefront pages and search previews updated.'
                    : 'Some page updates failed. Existing fallback data has been retained.',
                };
              })
            }
          />
          <button
            className={buttonClass}
            disabled={!!job}
            onClick={() =>
              void run('Rebuilding search previews', async () => {
                const result = await generateShopSeoManifestAction();
                return {
                  ok: result.ok,
                  text: result.ok
                    ? 'Search previews rebuilt from saved page details.'
                    : 'Search previews could not be rebuilt completely.',
                };
              })
            }
          >
            <FileText size={16} />
            Rebuild Search Previews
          </button>
          <MaintenanceAction
            title='Sync Entire Supplier Catalog'
            description='Download every supplier catalog page, including products not sold in this shop. Routine product verification renews its own supplier data without this operation.'
            icon={<Database size={16} />}
            disabled={!!job}
            confirm={() =>
              void run('Syncing the full supplier catalog', async () => {
                const result = await refreshPriceShippingCatalogAction();
                return {
                  ok: result.ok && result.completedFullTraversal,
                  text:
                    result.ok && result.completedFullTraversal
                      ? 'The full supplier catalog sync completed.'
                      : 'The supplier catalog sync did not complete. Product verification still uses its own scoped evidence.',
                };
              })
            }
          />
        </div>
        <details className='mt-4'>
          <summary className='cursor-pointer text-sm'>Storage & Sync Details</summary>
          <dl className='mt-5 grid gap-4 text-xs text-slate-400 sm:grid-cols-3'>
            <div>
              <dt>Last complete supplier sync</dt>
              <dd>{date(sync?.lastCompletedAt)}</dd>
            </div>
            <div>
              <dt>Supplier catalog products</dt>
              <dd>{sync?.lastTotal ?? 'Unknown'} (not shop inventory)</dd>
            </div>
            <div>
              <dt>Saved page data</dt>
              <dd>
                {stats.productCount} products · {stats.categoryCount} categories
              </dd>
            </div>
            <div>
              <dt>Page-cache duration</dt>
              <dd>{stats.ttlDays} days</dd>
            </div>
            <div>
              <dt>Retained preview backups</dt>
              <dd>{stats.seoManifest.retainedGenerationCount}</dd>
            </div>
          </dl>
        </details>
        <details className='mt-5'>
          <summary className='cursor-pointer text-sm'>Supplier Record Lookup</summary>
          <form
            className='mt-3 flex flex-wrap gap-2'
            onSubmit={(event) => {
              event.preventDefault();
              void run('Looking up supplier records', async () => {
                const result = await searchPriceShippingCatalogBySku(sku);
                setRecords(result);
                return {
                  ok: result.ok,
                  text: result.ok
                    ? `${result.variants.length} saved supplier records found.`
                    : result.message,
                };
              });
            }}
          >
            <input
              aria-label='Supplier SKU'
              placeholder='Supplier SKU'
              className='min-h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm'
              value={sku}
              onChange={(event) => setSku(event.target.value)}
            />
            <button className={buttonClass} disabled={!!job || !sku.trim()}>
              <Search size={15} />
              Search
            </button>
          </form>
          {records?.ok && (
            <ul className='mt-3 divide-y divide-white/10'>
              {records.variants.map((variant) => (
                <li key={variant.id} className='py-2 text-sm'>
                  {variant.product?.title ?? 'Supplier product'}
                  <span className='ml-2 font-mono text-xs text-slate-400'>{variant.sku}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </details>
      <section className={`${adminGlassPanelClass} p-4`}>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h2 className='text-xl font-semibold'>
              {issues.storageError
                ? 'Product checks unavailable'
                : affectedProducts.length
                  ? `${affectedProducts.length} products need review`
                  : 'No recorded product issues'}
            </h2>
            <p className='mt-1 text-sm text-slate-400'>
              {issues.products.reduce((sum, product) => sum + product.optionCount, 0)} saved option
              flags · {productChecks.filter((check) => check.completed).length} of{' '}
              {managedProductCount} products checked
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <button
              className={`${buttonClass} bg-white text-black hover:bg-white/90`}
              disabled={!!job}
              onClick={() => void check()}
            >
              <RefreshCw size={16} />
              Check Storefront
            </button>
          </div>
        </div>
        <dl className='mt-5 grid gap-4 text-sm sm:grid-cols-3'>
          <div>
            <dt className='text-slate-400'>Latest product check</dt>
            <dd className='mt-1'>{date(productChecks[0]?.checkedAt)}</dd>
          </div>
          <div>
            <dt className='text-slate-400'>Temporary verification failures</dt>
            <dd className='mt-1'>{temporaryChecks.length} products at their last check</dd>
          </div>
          <div>
            <dt className='text-slate-400'>Search preview data</dt>
            <dd className='mt-1'>
              {searchNeedsUpdate ? 'Needs updating' : 'Matches saved page data'}
            </dd>
          </div>
        </dl>
      </section>

      {job && (
        <p role='status' className='flex items-center gap-2 text-sm text-cyan-200'>
          <LoaderCircle size={16} className='animate-spin' />
          {job}
        </p>
      )}
      {notice && (
        <p
          role={notice.ok ? 'status' : 'alert'}
          className={`rounded-md border p-3 text-sm ${notice.ok ? 'border-emerald-400/30 text-emerald-100' : 'border-amber-300/30 text-amber-100'}`}
        >
          {notice.text}
        </p>
      )}
      {issues.storageError && (
        <p role='alert' className='text-sm text-amber-200'>
          Saved product issues could not be loaded. Check the local catalog database before relying
          on these counts.
        </p>
      )}

      <section aria-labelledby='product-attention-title' className={`${adminGlassPanelClass} p-4`}>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2 id='product-attention-title' className='text-base font-semibold'>
            Products Needing Attention
          </h2>
          <Link className={buttonClass} href='/admin/shop/storefront-data-health/products'>
            <Search size={15} />
            Delivery Checker
          </Link>
          <label className='flex min-h-10 items-center gap-2 rounded-md border border-white/15 px-3'>
            <Search size={15} />
            <input
              aria-label='Find an affected product'
              placeholder='Find a product'
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className='min-w-0 bg-transparent py-2 text-sm outline-none'
            />
          </label>
        </div>
        <ul
          aria-label='Products needing attention'
          tabIndex={0}
          className='mt-4 max-h-[32rem] overflow-y-auto overscroll-contain divide-y divide-white/10 border-y border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300'
        >
          {products.map((product) => {
            const checked = productChecks.find(
              (check) => check.merchizeProductId === product.productId,
            );
            return (
              <li
                key={product.productId}
                className='grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]'
              >
                <div className='min-w-0'>
                  <h3 className='font-medium'>{product.title}</h3>
                  <p className='mt-1 text-sm text-amber-100'>
                    {product.optionCount} {product.optionCount === 1 ? 'option' : 'options'} flagged
                    · {product.reasons.map(describeStorefrontIssue).join('; ')}
                  </p>
                  <p className='mt-1 text-xs text-slate-400'>
                    Last check: {date(checked?.checkedAt)}
                    {checked?.completed
                      ? ` · ${checked.availableCount} options verified available`
                      : ` · last issue observation: ${date(product.lastObservedAt)}`}
                  </p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <button
                    disabled={!!job}
                    className={buttonClass}
                    onClick={() => void check(product.productId)}
                    title={`Recheck ${product.title}`}
                  >
                    <RefreshCw size={14} />
                    Recheck
                  </button>
                  <Link
                    className={buttonClass}
                    href={`/admin/shop/storefront-data-health/variant-publication-issues?product=${encodeURIComponent(product.productId)}`}
                  >
                    Review Options
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </li>
            );
          })}
          {!products.length && (
            <li className='py-5 text-sm text-slate-400'>
              {filter
                ? 'No matching products.'
                : 'No saved option issues for the known storefront products. This does not replace a current availability check.'}
            </li>
          )}
        </ul>
        {temporaryChecks.length > 0 && (
          <div className='mt-4 space-y-2'>
            <h3 className='text-sm font-medium text-amber-200'>Could Not Be Checked</h3>
            {temporaryChecks.map((product) => (
              <div
                key={product.merchizeProductId}
                className='flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 text-sm'
              >
                <span>
                  {product.title} · {date(product.checkedAt)}
                </span>
                <button
                  className={buttonClass}
                  disabled={!!job}
                  onClick={() => void check(product.merchizeProductId)}
                >
                  <RefreshCw size={14} />
                  Retry Check
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`${adminGlassPanelClass} p-4`} aria-labelledby='search-preview-title'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h2 id='search-preview-title' className='text-base font-semibold'>
              Search Previews
            </h2>
            <p className='mt-1 text-sm text-slate-400'>
              {stats.seoManifest.productCount} products · {stats.seoManifest.categoryCount}{' '}
              categories · updated {date(stats.seoManifest.generatedAt)}
            </p>
            <p className='mt-1 text-sm'>
              {searchNeedsUpdate
                ? 'Some preview data is missing or differs from saved page details.'
                : 'Preview data matches the saved page details.'}
            </p>
          </div>
          <button
            className={buttonClass}
            disabled={!!job}
            onClick={() =>
              void run('Checking search previews', async () => {
                const result = await runStorefrontMetadataDiagnosticsAction();
                setDiagnostics(result);
                return {
                  ok: result.ok,
                  text: result.ok
                    ? 'Local search-preview checks passed. This does not confirm Google indexing.'
                    : 'Some local search-preview checks need review.',
                };
              })
            }
          >
            <CheckCircle2 size={16} />
            Check Previews
          </button>
        </div>
        {diagnostics && (
          <details className='mt-3 text-sm'>
            <summary className='cursor-pointer text-slate-300'>
              Search check details · {date(diagnostics.generatedAt)}
            </summary>
            <ul className='mt-2 space-y-2'>
              {diagnostics.checks.map((result) => (
                <li key={result.label} className={result.ok ? 'text-slate-400' : 'text-amber-200'}>
                  {result.label}: {result.detail}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function MaintenanceAction({
  title,
  description,
  icon,
  disabled,
  confirm,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  disabled: boolean;
  confirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className={buttonClass} disabled={disabled}>
          {icon}
          {title}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent
        className={`${adminGlassPanelClass} w-[min(94vw,560px)] bg-slate-950/95 p-5 text-white shadow-2xl shadow-black/70 sm:p-6`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}?</AlertDialogTitle>
          <AlertDialogDescription className='text-slate-300'>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className='border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white'>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction className='bg-white text-black hover:bg-white/90' onClick={confirm}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
