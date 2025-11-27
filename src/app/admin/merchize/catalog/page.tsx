// src/app/admin/merchize/catalog/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import AdminCatalogClient from './AdminCatalogClient';

const ADMIN_PASSWORD = process.env.MERCHIZE_PRICE_CATALOG_ADMIN_PASSWORD!;

// --- server action for login only ---

export async function loginAction(formData: FormData) {
  'use server';
  const pass = formData.get('password');
  if (pass === ADMIN_PASSWORD) {
    (await cookies()).set('merchize_admin', 'ok', {
      httpOnly: true,
      secure: true,
      path: '/',
    });
    redirect('/admin/merchize/catalog');
  }
}

// --- page component ---

export default async function MerchizeAdminPage() {
  const cookieStore = await cookies();
  const authed = cookieStore.get('merchize_admin')?.value === 'ok';

  if (!authed) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-950 text-slate-50'>
        <form
          action={loginAction}
          className='bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-xl w-full max-w-sm'
        >
          <h1 className='text-xl font-semibold mb-4'>Merchize Catalog Login</h1>
          <input
            type='password'
            name='password'
            placeholder='Admin password'
            className='w-full mb-4 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
          />
          <button
            type='submit'
            className='w-full rounded-md bg-emerald-500 text-slate-950 font-medium py-2 text-sm hover:bg-emerald-400 transition'
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  const [syncState, sampleVariants] = await Promise.all([
    merchizeCatalogPrisma.syncState.findUnique({
      where: { id: 'merchize_catalog' },
    }),
    merchizeCatalogPrisma.variant.findMany({
      include: { product: true, shippingBands: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return <AdminCatalogClient initialSyncState={syncState} initialSamples={sampleVariants} />;
}
