import { headers } from 'next/headers';
import { Suspense, type ReactNode } from 'react';
import { getAuthRoutes } from '@/lib/auth/domain-routing';
import AuthRoutesProvider from './AuthRoutesProvider';
import FormContainer from './FormContainer';

export default async function AuthFormLayout({
  children,
  shop = false,
}: {
  children: ReactNode;
  shop?: boolean;
}) {
  const routes = getAuthRoutes((await headers()).get('host') ?? 'localhost', shop);
  return (
    <AuthRoutesProvider routes={routes}>
      <FormContainer>
        <Suspense>{children}</Suspense>
      </FormContainer>
    </AuthRoutesProvider>
  );
}
