import 'server-only';

import type { ReactNode } from 'react';
import { getServerAuthSnapshot } from '@/lib/session/server-session';
import RequireAccount from './RequireAccount';

export default async function ServerAccountBoundary({
  children,
  shop = false,
}: {
  children: ReactNode;
  shop?: boolean;
}) {
  return (
    <RequireAccount shop={shop} initialSession={await getServerAuthSnapshot()}>
      {children}
    </RequireAccount>
  );
}
