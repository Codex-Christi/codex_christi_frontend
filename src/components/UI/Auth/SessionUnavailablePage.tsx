import { headers } from 'next/headers';
import { getAuthRoutes, safeAuthReturnPath } from '@/lib/auth/domain-routing';
import AuthUnavailable from './AuthUnavailable';

export const sessionUnavailableMetadata = {
  title: 'Sign-in temporarily unavailable',
  robots: { index: false, follow: false },
};
export type SessionUnavailablePageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SessionUnavailablePage({
  searchParams,
  shop = false,
}: SessionUnavailablePageProps & { shop?: boolean }) {
  const routes = getAuthRoutes((await headers()).get('host') ?? 'localhost', shop);
  const { next } = await searchParams;
  const retryTo =
    safeAuthReturnPath(typeof next === 'string' ? next : null, routes) ?? routes.account;
  return <AuthUnavailable retryTo={retryTo} />;
}
