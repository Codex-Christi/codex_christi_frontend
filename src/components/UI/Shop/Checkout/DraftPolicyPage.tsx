import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';

export default function DraftPolicyPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className='mx-auto w-full max-w-3xl px-4 py-8 text-white sm:py-12'>
      <CustomShopLink
        href='/shop/checkout'
        className='mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-white/75'
      >
        <ArrowLeft size={18} aria-hidden='true' /> Back to checkout
      </CustomShopLink>
      <article className='rounded-2xl bg-[#1b1b1b] p-5 sm:p-8'>
        <span className='inline-flex rounded-full border border-amber-200/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100'>
          Draft — pending approval
        </span>
        <h1 className='mt-4 text-2xl font-semibold sm:text-3xl'>{title}</h1>
        <p className='mt-3 border-b border-white/20 pb-5 text-sm leading-6 text-amber-100/85'>
          This is proposed wording for review. It has not been approved as the shop’s final policy.
          Business details, applicable requirements, and the final wording still need confirmation.
        </p>
        <div className='mt-6 space-y-6 text-sm leading-7 text-white/75 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white'>
          {children}
        </div>
      </article>
    </main>
  );
}
