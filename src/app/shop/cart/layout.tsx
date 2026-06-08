import type { ReactNode } from 'react';
import GlobalCurrencyFXWrapper from '@/components/UI/Providers/Shop/GlobalCurrencyFXWrapper';

export default function CartLayout({ children }: { children: ReactNode }) {
  return <GlobalCurrencyFXWrapper>{children}</GlobalCurrencyFXWrapper>;
}
