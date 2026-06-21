'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { ArrowRight, Database, RefreshCw, Search, Store } from 'lucide-react';
import AdminGlassPanel from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import type {
  SyncState,
  Variant,
  Product,
  ShippingBand,
} from '@/lib/prisma/shop/merchize/generated/merchizeCatalog/client';
import {
  refreshPriceShippingCatalogAction,
  refreshStorefrontSnapshotsAction,
  searchPriceShippingCatalogBySku,
} from './actions';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/UI/primitives/alert-dialog';
import showErrorToast from '@/lib/error-toast';
import showSuccessToast from '@/lib/success-toast';
import showLoadingToast from '@/lib/loading-toast';
import { toast } from 'sonner';

type VariantWithRelations = Variant & {
  product: Product | null;
  shippingBands: ShippingBand[];
};

type Props = {
  initialSyncState: SyncState | null;
  initialSamples: VariantWithRelations[];
  initialStorefrontSnapshotStats: StorefrontSnapshotStats;
};

type StorefrontSnapshotStats = {
  productCount: number;
  categoryCount: number;
  variantSnapshotCount: number;
  lastProductSnapshotAt: Date | null;
  lastCategorySnapshotAt: Date | null;
  ttlDays: string;
};

type StatusState =
  | { type: 'idle' }
  | { type: 'loading'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export default function MerchizeCatalogSnapshotsAdminClient({
  initialSyncState,
  initialSamples,
  initialStorefrontSnapshotStats,
}: Props) {
  const [syncState, setSyncState] = useState<SyncState | null>(initialSyncState);
  const [storefrontSnapshotStats, setStorefrontSnapshotStats] = useState<StorefrontSnapshotStats>(
    initialStorefrontSnapshotStats,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<VariantWithRelations[] | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: 'idle' });
  const [isPending, startTransition] = useTransition();
  const [refreshProgress, setRefreshProgress] = useState(0);

  const working = isPending || status.type === 'loading';
  const list = searchResults ?? initialSamples;

  // Simple animated progress bar while "loading".
  useEffect(() => {
    if (status.type !== 'loading') return;

    const id = setInterval(() => {
      setRefreshProgress((pct) => Math.min(95, pct + 5));
    }, 400);

    return () => clearInterval(id);
  }, [status.type]);

  const handlePriceShippingRefreshConfirmed = () => {
    startTransition(async () => {
      setRefreshProgress(10);
      setStatus({ type: 'loading', message: 'Refreshing price and shipping catalog…' });
      const loadID1 = showLoadingToast({ message: 'Refreshing price and shipping catalog…' });

      try {
        const res = await refreshPriceShippingCatalogAction();
        toast.dismiss(loadID1);
        if (res.ok) {
          setSyncState(res.syncState ?? null);
          setRefreshProgress(100);
          const msg = `Refreshed. Variants: ${res.ingestedVariants}, products: ${res.totalProducts}`;
          setStatus({
            type: 'success',
            message: msg,
          });
          showSuccessToast({ header: 'Price and shipping catalog refreshed', message: msg });
        } else {
          setRefreshProgress(0);
          const msg = res.error ?? 'Refresh failed.';
          setStatus({
            type: 'error',
            message: msg,
          });
          showErrorToast?.({ header: 'Search failed', message: msg });
        }
      } catch (e: unknown) {
        setRefreshProgress(0);
        const message = e instanceof Error ? e.message : 'Refresh failed.';
        setStatus({ type: 'error', message });
        showErrorToast?.({ header: 'Refresh error', message });
      }
    });
  };

  const handleStorefrontSnapshotsRefreshConfirmed = () => {
    startTransition(async () => {
      setRefreshProgress(10);
      setStatus({ type: 'loading', message: 'Refreshing storefront snapshots…' });
      const loadID = showLoadingToast({ message: 'Refreshing storefront snapshots…' });

      try {
        const res = await refreshStorefrontSnapshotsAction();
        toast.dismiss(loadID);
        setStorefrontSnapshotStats(res.stats);
        setRefreshProgress(100);

        const failureText = res.failures.length
          ? ` Failures: ${res.failures.map((failure) => failure.category).join(', ')}.`
          : '';
        const productFailureText = res.productSnapshotFailures.length
          ? ` Product snapshot failures: ${res.productSnapshotFailures
              .map((failure) => failure.productId)
              .join(', ')}.`
          : '';
        const revalidationText = res.revalidatedPaths.length
          ? ` Revalidated public paths: ${res.revalidatedPaths.length}.`
          : '';
        const msg = `Storefront snapshots refreshed. Pages: ${res.pagesFetched}, products seen: ${res.productsSeen}, published products attempted: ${res.publishedProductsAttempted}.${revalidationText}${failureText}${productFailureText}`;

        setStatus({
          type: res.ok ? 'success' : 'error',
          message: msg,
        });

        if (res.ok) {
          showSuccessToast({ header: 'Storefront snapshots refreshed', message: msg });
        } else {
          showErrorToast({ header: 'Storefront snapshots partially failed', message: msg });
        }
      } catch (e: unknown) {
        toast.dismiss(loadID);
        setRefreshProgress(0);
        const message = e instanceof Error ? e.message : 'Storefront snapshot refresh failed.';
        setStatus({ type: 'error', message });
        showErrorToast({ header: 'Storefront snapshot refresh error', message });
      }
    });
  };

  const handleSearch = () => {
    startTransition(async () => {
      setRefreshProgress(10);
      setStatus({ type: 'loading', message: 'Searching…' });
      const loadID2 = showLoadingToast({ message: 'Searching catalog…' });

      try {
        const res = await searchPriceShippingCatalogBySku(searchTerm);
        toast.dismiss(loadID2);
        if (res.ok) {
          setSearchResults(res.variants as VariantWithRelations[]);
          setRefreshProgress(100);
          const msg = `Found ${res.variants.length} result(s).`;
          setStatus({
            type: 'success',
            message: msg,
          });
          showSuccessToast?.({ header: 'Search complete', message: msg });
        } else {
          setRefreshProgress(0);
          const msg = res.message ?? 'Search failed.';
          setStatus({
            type: 'error',
            message: msg,
          });
          showErrorToast?.({ header: 'Search failed', message: msg });
        }
      } catch (e: unknown) {
        setRefreshProgress(0);
        const message = e instanceof Error ? e.message : 'Search failed.';
        setStatus({ type: 'error', message });
        showErrorToast({ header: 'Search error', message });
      }
    });
  };

  const lastRun = syncState?.lastRunAt ? new Date(syncState.lastRunAt).toLocaleString() : 'Never';

  const lastSuccess = syncState?.lastSuccessAt
    ? new Date(syncState.lastSuccessAt).toLocaleString()
    : 'Never';
  const snapshotTtlLabel = `${storefrontSnapshotStats.ttlDays} day${
    storefrontSnapshotStats.ttlDays === '1' ? '' : 's'
  }`;
  const lastProductSnapshot = formatAdminDate(storefrontSnapshotStats.lastProductSnapshotAt);
  const lastCategorySnapshot = formatAdminDate(storefrontSnapshotStats.lastCategorySnapshotAt);

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
    setStatus({ type: 'idle' });
    setRefreshProgress(0);
  };

  return (
    <div className='space-y-5 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <section className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]'>
        <AdminGlassPanel className='p-4 sm:p-5'>
          <p className='inline-flex rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100'>
            Merchize data plane
          </p>
          <h2 className='mt-4 text-xl font-semibold text-white'>Catalog and fallback health</h2>
          <p className='mt-2 max-w-3xl text-sm leading-6 text-slate-400'>
            Refresh the local price/shipping catalog used for SKU lookups, and refresh the
            storefront snapshots used when Merchize product, category, or variant requests are
            unavailable.
          </p>

          <div className='mt-5 grid gap-3 text-xs sm:grid-cols-3'>
            <MiniStatus
              label='Catalog sync'
              value={lastSuccess === 'Never' ? 'Pending' : 'Ready'}
            />
            <MiniStatus label='Storefront TTL' value={snapshotTtlLabel} />
            <MiniStatus label='SQLite source' value='merchize_catalog' />
          </div>
        </AdminGlassPanel>

        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1'>
          <RefreshConfirmationDialog
            disabled={working}
            icon={<Database size={16} />}
            buttonText='Refresh price & shipping'
            helperText='SKU, variants, tiers, and shipping bands'
            title='Refresh price and shipping catalog?'
            description='This pulls all pages from the Merchize product-line catalog API and updates local price, SKU, variant, tier, and shipping data.'
            confirmText='Refresh price and shipping'
            onConfirm={handlePriceShippingRefreshConfirmed}
          />
          <RefreshConfirmationDialog
            disabled={working}
            icon={<Store size={16} />}
            buttonText='Refresh storefront snapshots'
            helperText='Category/product fallback and ISR paths'
            title='Refresh storefront snapshots?'
            description='This refreshes the category and product data used by public storefront pages when Merchize is unavailable, then revalidates the affected shop, category, and product pages.'
            confirmText='Refresh snapshots'
            onConfirm={handleStorefrontSnapshotsRefreshConfirmed}
          />
        </div>
      </section>

      {status.type === 'loading' && (
        <div
          className='h-1 w-full overflow-hidden rounded-full bg-slate-800'
          role='progressbar'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={refreshProgress}
          aria-label={status.message}
        >
          <div
            className='h-full bg-cyan-300 transition-all duration-300 ease-out'
            style={{ width: `${refreshProgress}%` }}
          />
        </div>
      )}

      {status.type !== 'idle' && (
        <div
          role='status'
          aria-live='polite'
          className={`rounded-lg border px-3 py-2 text-xs transition ${
            status.type === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
              : status.type === 'error'
                ? 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                : 'border-slate-700 bg-slate-800 text-slate-200'
          }`}
        >
          {status.message}
        </div>
      )}

      <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        <StatTile label='Last catalog run' value={lastRun} />
        <StatTile label='Last successful sync' value={lastSuccess} />
        <StatTile label='Catalog total products' value={syncState?.lastTotal ?? 'Unknown'} />
        <StatTile label='Storefront products' value={storefrontSnapshotStats.productCount} />
        <StatTile label='Snapshot categories' value={storefrontSnapshotStats.categoryCount} />
        <StatTile label='Snapshot variants' value={storefrontSnapshotStats.variantSnapshotCount} />
        <StatTile label='Product snapshot' value={lastProductSnapshot} />
        <StatTile label='Category snapshot' value={lastCategorySnapshot} />
        <StatTile label='Snapshot TTL' value={snapshotTtlLabel} />
      </section>

      <AdminGlassPanel className='overflow-hidden'>
        <div className='border-b border-white/10 px-4 py-3 sm:px-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h2 className='text-base font-semibold text-white'>SKU lookup</h2>
              <p className='mt-1 text-xs text-slate-500'>
                Search the local price and shipping catalog without touching the public shop UI.
              </p>
            </div>
            {searchResults ? (
              <button
                type='button'
                onClick={handleClearSearch}
                className='rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
              >
                Clear search
              </button>
            ) : null}
          </div>

          <div className='mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center'>
            <label htmlFor='merchize-sku-search' className='sr-only'>
              Search price and shipping catalog by SKU
            </label>
            <input
              id='merchize-sku-search'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder='Search by full or partial SKU...'
              className='flex-1 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20'
            />
            <button
              type='button'
              onClick={handleSearch}
              disabled={working || !searchTerm.trim()}
              aria-label='Search price and shipping catalog by SKU'
              className='inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/24 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-50'
            >
              <Search size={14} aria-hidden='true' />
              Search
            </button>
          </div>
        </div>

        <div className='max-h-[28rem] overflow-auto p-3 sm:p-4'>
          <div className='mb-3 flex items-center justify-between text-xs text-slate-400'>
            <span>
              {searchResults
                ? `Search results (${list.length})`
                : `Latest sample variants (${list.length})`}
            </span>
          </div>
          <div className='space-y-2'>
            {list.map((v) => (
              <div
                key={v.id}
                className='rounded-lg border border-white/10 bg-slate-950/28 px-3 py-3 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
              >
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0 space-y-1'>
                    <div className='font-mono text-[11px] text-emerald-300'>{v.sku}</div>
                    <div className='truncate text-sm font-medium text-slate-100'>
                      {v.product?.title ?? 'No title'}
                    </div>
                    <div className='text-slate-500'>
                      {v.product?.skuPrefix ?? v.product?.merchizeId}
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-1.5'>
                    {v.shippingBands.slice(0, 4).map((b) => (
                      <span
                        key={b.id}
                        className='inline-flex items-center rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-0.5 text-[10px] text-cyan-100'
                      >
                        {b.toZone}: {b.firstItem ?? '-'} / {b.addlItem ?? '-'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {list.length === 0 && <div className='text-xs text-slate-500'>No data yet.</div>}
          </div>
        </div>
      </AdminGlassPanel>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.035] p-3'>
      <p className='text-slate-500'>{label}</p>
      <p className='mt-1 truncate font-medium text-slate-100'>{value}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <AdminGlassPanel className='p-4'>
      <p className='text-xs text-slate-500'>{label}</p>
      <p className='mt-2 truncate text-sm font-semibold text-slate-100'>{value}</p>
    </AdminGlassPanel>
  );
}

function formatAdminDate(value: Date | string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function RefreshConfirmationDialog({
  disabled,
  icon,
  buttonText,
  helperText,
  title,
  description,
  confirmText,
  onConfirm,
}: {
  disabled: boolean;
  icon: ReactNode;
  buttonText: string;
  helperText: string;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type='button'
          aria-label={buttonText}
          disabled={disabled}
          className='group relative flex min-h-[4.5rem] w-full items-center gap-3 overflow-hidden rounded-xl border border-blue-300/20 bg-blue-400/[0.075] px-4 py-3 text-left text-slate-100 shadow-[0_18px_46px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-cyan-200/42 hover:bg-blue-400/[0.12] hover:shadow-[0_20px_54px_rgba(14,165,233,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60 supports-[backdrop-filter]:backdrop-blur-xl'
        >
          <span className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/55 to-transparent opacity-80' />
          <span className='pointer-events-none absolute -right-10 -top-16 h-28 w-28 rounded-full bg-cyan-300/10 blur-2xl transition group-hover:bg-cyan-200/16' />
          {disabled ? (
            <span className='relative inline-flex items-center gap-3'>
              <RefreshCw className='h-4 w-4 animate-spin text-cyan-100' aria-hidden='true' />
              <span className='font-medium'>Working...</span>
            </span>
          ) : (
            <>
              <span className='relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-blue-200/28 bg-blue-200/10 text-cyan-100 shadow-[0_0_24px_rgba(59,130,246,0.14)]'>
                {icon}
              </span>
              <span className='relative min-w-0 flex-1'>
                <span className='block text-sm font-semibold'>{buttonText}</span>
                <span className='block text-[11px] text-slate-400'>{helperText}</span>
              </span>
              <span className='relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-200/18 bg-cyan-200/8 text-cyan-100 transition group-hover:translate-x-0.5 group-hover:border-cyan-200/35'>
                <ArrowRight size={15} />
              </span>
            </>
          )}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className='bg-slate-950/80 border border-slate-800 backdrop-blur-xl'>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            <br />
            <br />
            Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className='bg-slate-900 border border-slate-700 hover:bg-slate-800'>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className='border border-cyan-300/24 bg-cyan-300/12 text-cyan-50 hover:bg-cyan-300/18'
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
