import type { ReactNode } from 'react';
import '../../route-utilities.css';
import GlobalCurrencyFXWrapper from '@/components/UI/Providers/Shop/GlobalCurrencyFXWrapper';

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <GlobalCurrencyFXWrapper>{children}</GlobalCurrencyFXWrapper>;
}
