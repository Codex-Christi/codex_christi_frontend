'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  LoaderCircle,
  RefreshCw,
  Square,
} from 'lucide-react';
import type { StorefrontDirectoryRow } from './productDirectoryData';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import {
  PRODUCT_DIRECTORY_PAGE_SIZE,
  PRODUCT_DIRECTORY_ROUTE,
  productDirectoryHref,
  type readProductDirectoryFilters,
} from './filters';
import { requestDeliveryChecks, type DeliveryStatus } from './deliveryStatus';

type CheckState = 'idle' | 'queued' | 'checking' | 'ready' | 'failed' | 'paused';

export default function StorefrontProductList({
  rows,
  filters,
  canCheck,
}: {
  rows: StorefrontDirectoryRow[];
  filters: ReturnType<typeof readProductDirectoryFilters>;
  canCheck: boolean;
}) {
  const [automaticIds] = useState(() =>
    rows.filter((row) => row.requiresCheck).map((row) => row.productId),
  );
  const [states, setStates] = useState<Record<string, CheckState>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.productId,
        row.requiresCheck ? (canCheck ? 'queued' : 'idle') : 'ready',
      ]),
    ),
  );
  const [updates, setUpdates] = useState<Record<string, DeliveryStatus>>({});
  const [active, setActive] = useState(canCheck && automaticIds.length > 0);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const country = filters.country;
  const run = useCallback(
    (productIds: string[], force = false) => {
      if (!productIds.length) return;
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      const requested = new Set(productIds);
      return requestDeliveryChecks(
        `${PRODUCT_DIRECTORY_ROUTE}/check`,
        productIds,
        country,
        force,
        request.signal,
        (event) => {
          if (
            request.signal.aborted ||
            event.type === 'complete' ||
            event.type === 'error' ||
            !requested.has(event.productId)
          )
            return;
          if (event.type === 'result')
            setUpdates((previous) => ({ ...previous, [event.productId]: event.result }));
          setStates((previous) => ({
            ...previous,
            [event.productId]:
              event.type === 'checking'
                ? 'checking'
                : event.result.requiresCheck
                  ? 'failed'
                  : 'ready',
          }));
        },
      )
        .catch((failure) => {
          if (!request.signal.aborted)
            setError(
              failure instanceof Error
                ? failure.message
                : 'Delivery checks could not complete. Please retry.',
            );
        })
        .finally(() => {
          if (controller.current === request && !request.signal.aborted) {
            setActive(false);
            setStates((previous) =>
              Object.fromEntries(
                Object.entries(previous).map(([id, state]) => [
                  id,
                  requested.has(id) && (state === 'queued' || state === 'checking')
                    ? 'failed'
                    : state,
                ]),
              ),
            );
          }
        });
    },
    [country],
  );
  useEffect(() => {
    if (canCheck) void run(automaticIds);
    return () => controller.current?.abort();
  }, [automaticIds, canCheck, run]);
  const start = (productIds: string[], force = false) => {
    if (!productIds.length) return;
    setActive(true);
    setError(null);
    setStates((previous) => ({
      ...previous,
      ...Object.fromEntries(productIds.map((id) => [id, 'queued' as const])),
    }));
    void run(productIds, force);
  };
  const stop = () => {
    controller.current?.abort();
    setActive(false);
    setStates((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([id, state]) => [
          id,
          state === 'queued' || state === 'checking' ? 'paused' : state,
        ]),
      ),
    );
  };
  const results = rows.map((row) => ({ ...row, ...updates[row.productId] }));
  const filtered = filters.attentionOnly ? results.filter((row) => row.needsReview) : results;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCT_DIRECTORY_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const visible = filtered.slice(
    (page - 1) * PRODUCT_DIRECTORY_PAGE_SIZE,
    page * PRODUCT_DIRECTORY_PAGE_SIZE,
  );
  const retryIds = Object.keys(states).filter((id) => ['failed', 'paused'].includes(states[id]));
  const checked = Object.values(states).filter(
    (state) => state === 'ready' || state === 'failed',
  ).length;
  const button =
    'inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50';
  return (
    <>
      <div className='flex flex-wrap items-center justify-between gap-3 py-4'>
        <div role='status' className='min-w-0 text-sm text-slate-300'>
          {filtered.length} {filtered.length === 1 ? 'product' : 'products'} · {checked} of{' '}
          {rows.length} checked
          {active && (
            <span className='ml-2 inline-flex items-center gap-1'>
              <LoaderCircle size={13} className='animate-spin' />
              Checking
            </span>
          )}
          {!active && retryIds.length > 0 && (
            <span className='ml-2 text-amber-100'>
              {retryIds.length} {retryIds.length === 1 ? 'needs' : 'need'} another check
            </span>
          )}
        </div>
        {canCheck && (
          <div className='flex flex-wrap gap-2'>
            {active ? (
              <button className={button} onClick={stop}>
                <Square size={14} />
                Stop Checks
              </button>
            ) : (
              <>
                {retryIds.length > 0 && (
                  <button className={button} onClick={() => start(retryIds)}>
                    <RefreshCw size={14} />
                    Retry Remaining
                  </button>
                )}
                <button
                  className={button}
                  disabled={!filtered.length}
                  onClick={() =>
                    start(
                      filtered.map((row) => row.productId),
                      true,
                    )
                  }
                >
                  <RefreshCw size={14} />
                  Refresh All
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {active && (
        <progress
          aria-label='Delivery checks completed'
          className='mb-3 h-1 w-full accent-white'
          value={checked}
          max={Math.max(1, rows.length)}
        />
      )}
      {error && (
        <p role='alert' className='mb-3 text-sm text-amber-100'>
          {error}
        </p>
      )}
      <ul className='divide-y divide-white/10 border-y border-white/10'>
        {visible.map((row) => {
          const busy =
            active && (states[row.productId] === 'queued' || states[row.productId] === 'checking');
          return (
            <li key={row.productId} className='grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='flex min-w-0 gap-3'>
                <ProductThumbnail image={row.image} title={row.title} />
                <div className='min-w-0'>
                  <CustomShopLink
                    href={`/shop/product/${row.productId}`}
                    ariaLabel={`View ${row.title}`}
                    className='font-medium hover:underline'
                  >
                    {row.title}
                  </CustomShopLink>
                  {row.optionCount > 0 && (
                    <p className='mt-1 text-xs text-amber-100'>
                      {row.optionCount} supplier option {row.optionCount === 1 ? 'issue' : 'issues'}
                    </p>
                  )}
                  {busy ? (
                    <div
                      role='status'
                      aria-label={`Checking delivery for ${row.title}`}
                      className='mt-2 grid min-h-16 content-start gap-2 motion-safe:animate-pulse'
                    >
                      <span className='h-4 w-48 max-w-full rounded bg-white/10' />
                      <span className='h-3 w-36 max-w-full rounded bg-white/5' />
                    </div>
                  ) : (
                    <>
                      <p className='mt-1 text-sm text-slate-200'>
                        {states[row.productId] === 'paused'
                          ? 'Check paused'
                          : states[row.productId] === 'failed' && !row.requiresCheck
                            ? 'Delivery check could not be completed'
                            : row.status}
                      </p>
                      {row.unsupportedCount > 0 && (
                        <p className='mt-1 text-xs text-slate-300'>
                          {row.unsupportedCount} {row.unsupportedCount === 1 ? 'option' : 'options'}
                          {' cannot be delivered here'}
                        </p>
                      )}
                      {row.unverifiedCount > 0 && (
                        <p className='mt-1 text-xs text-slate-300'>
                          {row.unverifiedCount} {row.unverifiedCount === 1 ? 'option' : 'options'}
                          {' could not be checked'}
                        </p>
                      )}
                      <p className='mt-1 text-xs text-slate-400'>
                        {row.checkedAt
                          ? `${row.source === 'catalog' ? 'Catalog evidence' : 'Last live check'}: ${new Date(row.checkedAt).toLocaleString()}`
                          : 'No delivery check recorded for this country'}
                      </p>
                      {row.validUntil && (
                        <p className='mt-1 text-xs text-slate-400'>
                          Valid until: {new Date(row.validUntil).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className='flex flex-wrap items-start gap-2'>
                {canCheck && (
                  <button
                    className={button}
                    disabled={active}
                    onClick={() => start([row.productId], true)}
                    aria-label={`Check live delivery for ${row.title}`}
                  >
                    {states[row.productId] === 'checking' ? (
                      <LoaderCircle size={15} className='animate-spin' />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    Check Live
                  </button>
                )}
                {row.optionCount > 0 && (
                  <Link
                    className={button}
                    href={`/admin/shop/storefront-data-health/variant-publication-issues?product=${encodeURIComponent(row.productId)}`}
                  >
                    Review Options
                    <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
        {!visible.length && (
          <li className='py-8 text-sm text-slate-400'>
            No saved storefront products match these filters.
          </li>
        )}
      </ul>
      {totalPages > 1 && (
        <nav
          aria-label='Storefront product pages'
          className='flex items-center justify-between gap-3 py-4 text-sm'
        >
          {page > 1 ? (
            <Link
              prefetch={false}
              className='inline-flex min-h-10 items-center gap-1'
              href={productDirectoryHref(filters, page - 1)}
            >
              <ChevronLeft size={16} />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className='text-slate-400'>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              prefetch={false}
              className='inline-flex min-h-10 items-center gap-1'
              href={productDirectoryHref(filters, page + 1)}
            >
              Next
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function ProductThumbnail({ image, title }: { image: string; title: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <div className='grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-white/5'>
      {image && failedImage !== image ? (
        <Image
          src={image}
          alt={title}
          width={80}
          height={80}
          sizes='80px'
          className='h-full w-full object-contain'
          onError={() => setFailedImage(image)}
        />
      ) : (
        <ImageOff size={22} aria-label='Product image unavailable' className='text-slate-500' />
      )}
    </div>
  );
}
