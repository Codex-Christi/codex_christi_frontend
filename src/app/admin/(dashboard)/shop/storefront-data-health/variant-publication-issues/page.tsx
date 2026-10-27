import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin/require-admin';
import VariantPublicationIssuesPanel from '../VariantPublicationIssuesPanel';
import { getVariantPublicationIssueQueue } from '../variantPublicationIssuesData';

const ROUTE = '/admin/shop/storefront-data-health/variant-publication-issues';

type VariantPublicationIssuesAdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: 'Product Options Needing Attention | Codex Christi Admin',
  description: 'Detailed Merchize variant publication compatibility incidents and repair evidence.',
};

export const dynamic = 'force-dynamic';

export default async function VariantPublicationIssuesAdminPage({
  searchParams,
}: VariantPublicationIssuesAdminPageProps) {
  const params = (await searchParams) ?? {};
  const requestedPage = getPositiveIntegerParam(params.page) ?? 1;
  await requireAdminPage({
    scope: 'shop.view',
    returnPath: ROUTE,
  });

  const productId = typeof params.product === 'string' ? params.product : undefined;
  const queue = await getVariantPublicationIssueQueue(requestedPage, productId);

  return (
    <div className='px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <section className='mx-auto max-w-[1600px] space-y-4' aria-labelledby='page-title'>
        <Link
          href='/admin/shop/storefront-data-health'
          aria-label='Return to storefront health'
          className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
        >
          <ArrowLeft size={14} aria-hidden='true' />
          Storefront Health
        </Link>

        <header>
          <p className='text-xs font-medium uppercase tracking-[0.16em] text-cyan-200'>
            Merchize catalog operations
          </p>
          <h2 id='page-title' className='mt-2 text-xl font-semibold text-white sm:text-2xl'>
            Product Options Needing Attention
          </h2>
          <p className='mt-2 max-w-3xl text-sm leading-6 text-slate-400'>
            Saved option problems and their supplier evidence. Repair the product in Merchize, then
            recheck it from Storefront Health.
          </p>
        </header>

        <VariantPublicationIssuesPanel queue={queue} />
      </section>
    </div>
  );
}

function getPositiveIntegerParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
