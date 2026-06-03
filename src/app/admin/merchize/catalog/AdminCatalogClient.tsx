// src/app/admin/merchize/catalog/AdminCatalogClient.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import type {
  SyncState,
  Variant,
  Product,
  ShippingBand,
} from '../../../../lib/prisma/shop/merchize/generated/merchizeCatalog/client';
import {
  refreshPriceShippingCatalogAction,
  refreshStorefrontSnapshotAction,
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

export default function AdminCatalogClient({
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

  const handleStorefrontSnapshotRefreshConfirmed = () => {
    startTransition(async () => {
      setRefreshProgress(10);
      setStatus({ type: 'loading', message: 'Refreshing storefront snapshot…' });
      const loadID = showLoadingToast({ message: 'Refreshing storefront snapshot…' });

      try {
        const res = await refreshStorefrontSnapshotAction();
        toast.dismiss(loadID);
        setStorefrontSnapshotStats(res.stats);
        setRefreshProgress(100);

        const failureText = res.failures.length
          ? ` Failures: ${res.failures.map((failure) => failure.category).join(', ')}.`
          : '';
        const msg = `Storefront snapshot refreshed. Pages: ${res.pagesFetched}, products seen: ${res.productsSeen}.${failureText}`;

        setStatus({
          type: res.ok ? 'success' : 'error',
          message: msg,
        });

        if (res.ok) {
          showSuccessToast({ header: 'Storefront snapshot refreshed', message: msg });
        } else {
          showErrorToast({ header: 'Storefront snapshot partially failed', message: msg });
        }
      } catch (e: unknown) {
        toast.dismiss(loadID);
        setRefreshProgress(0);
        const message = e instanceof Error ? e.message : 'Storefront snapshot refresh failed.';
        setStatus({ type: 'error', message });
        showErrorToast({ header: 'Snapshot refresh error', message });
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

  return (
    <div className='min-h-screen flex items-center justify-center bg-indigo-950/30 backdrop-blur-[2px] text-slate-50 px-4'>
      <div className='bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-xl w-full max-w-3xl space-y-6'>
        <header className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
          <div>
            <h1 className='text-xl font-semibold'>Merchize Offline Catalog Admin</h1>
            <p className='text-xs text-slate-400'>
              Local price/shipping data and storefront fallback snapshots stored in SQLite.
            </p>
          </div>

          <div className='flex flex-col sm:flex-row gap-2'>
            <RefreshConfirmationDialog
              disabled={working}
              buttonText='Refresh prices'
              title='Refresh price and shipping catalog?'
              description='This pulls all pages from the Merchize product-line catalog API and updates local price, SKU, and shipping data.'
              confirmText='Refresh prices'
              onConfirm={handlePriceShippingRefreshConfirmed}
            />
            <RefreshConfirmationDialog
              disabled={working}
              buttonText='Refresh storefront'
              title='Refresh storefront snapshot?'
              description='This pulls the shop category/product pages used for degraded storefront rendering and updates only the local storefront snapshot subset.'
              confirmText='Refresh storefront'
              onConfirm={handleStorefrontSnapshotRefreshConfirmed}
            />
          </div>
        </header>

        {/* Progress bar for loading state */}
        {status.type === 'loading' && (
          <div
            className='h-1 w-full rounded-full bg-slate-800 overflow-hidden'
            role='progressbar'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={refreshProgress}
            aria-label={status.message}
          >
            <div
              className='h-full bg-emerald-500 transition-all duration-300 ease-out'
              style={{ width: `${refreshProgress}%` }}
            />
          </div>
        )}

        <section className='grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs'>
          <div className='rounded-lg border border-slate-800 bg-slate-900/60 p-3'>
            <div className='text-slate-400'>Last run time</div>
            <div className='mt-1 text-sm font-medium'>{lastRun}</div>
          </div>
          <div className='rounded-lg border border-slate-800 bg-slate-900/60 p-3'>
            <div className='text-slate-400'>Last successful sync</div>
            <div className='mt-1 text-sm font-medium'>{lastSuccess}</div>
          </div>
          <div className='rounded-lg border border-slate-800 bg-slate-900/60 p-3'>
            <div className='text-slate-400'>Last total products</div>
            <div className='mt-1 text-sm font-medium'>{syncState?.lastTotal ?? 'Unknown'}</div>
          </div>
        </section>

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

        <section className='grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs'>
          <div className='rounded-lg border border-slate-800 bg-slate-900/60 p-3'>
            <div className='text-slate-400'>Storefront products</div>
            <div className='mt-1 text-sm font-medium'>
              {storefrontSnapshotStats.productCount}
            </div>
          </div>
          <div className='rounded-lg border border-slate-800 bg-slate-900/60 p-3'>
            <div className='text-slate-400'>Snapshot categories</div>
            <div className='mt-1 text-sm font-medium'>
              {storefrontSnapshotStats.categoryCount}
            </div>
          </div>
          <div className='rounded-lg border border-slate-800 bg-slate-900/60 p-3'>
            <div className='text-slate-400'>Snapshot TTL</div>
            <div className='mt-1 text-sm font-medium'>
              {storefrontSnapshotStats.ttlDays} day
              {storefrontSnapshotStats.ttlDays === '1' ? '' : 's'}
            </div>
          </div>
        </section>

        <section className='space-y-3'>
          <div className='flex flex-col sm:flex-row gap-2 items-stretch sm:items-center'>
            <label htmlFor='merchize-sku-search' className='sr-only'>
              Search price and shipping catalog by SKU
            </label>
            <input
              id='merchize-sku-search'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder='Search by full or partial SKU…'
              className='flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500'
            />
            <button
              type='button'
              onClick={handleSearch}
              disabled={working || !searchTerm.trim()}
              aria-label='Search price and shipping catalog by SKU'
              className='inline-flex items-center justify-center rounded-md bg-slate-800 text-slate-100 font-medium px-4 py-2 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition'
            >
              Search
            </button>
          </div>

          <div className='rounded-lg border border-slate-800 bg-slate-950/60 p-3 max-h-72 overflow-auto'>
            <div className='flex items-center justify-between mb-2 text-xs text-slate-400'>
              <span>
                {searchResults
                  ? `Search results (${list.length})`
                  : `Sample variants (${list.length})`}
              </span>
            </div>
            <div className='space-y-2'>
              {list.map((v) => (
                <div
                  key={v.id}
                  className='rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'
                >
                  <div className='space-y-0.5'>
                    <div className='font-mono text-[11px] text-emerald-300'>{v.sku}</div>
                    <div className='text-slate-200'>{v.product?.title ?? 'No title'}</div>
                    <div className='text-slate-500'>
                      {v.product?.skuPrefix ?? v.product?.merchizeId}
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-1'>
                    {v.shippingBands.slice(0, 4).map((b) => (
                      <span
                        key={b.id}
                        className='inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200'
                      >
                        {b.toZone}: {b.firstItem ?? '–'}/{b.addlItem ?? '–'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {list.length === 0 && <div className='text-xs text-slate-500'>No data yet.</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function RefreshConfirmationDialog({
  disabled,
  buttonText,
  title,
  description,
  confirmText,
  onConfirm,
}: {
  disabled: boolean;
  buttonText: string;
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
          disabled={disabled}
          className='inline-flex items-center justify-center rounded-md bg-emerald-500 text-slate-950 font-medium px-4 py-2 text-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition'
        >
          {disabled ? (
            <span className='inline-flex items-center gap-2'>
              <span
                className='h-3 w-3 rounded-full border-2 border-emerald-900 border-t-transparent animate-spin'
                aria-hidden='true'
              />
              Working...
            </span>
          ) : (
            buttonText
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
            className='bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
