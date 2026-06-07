import { Metadata } from 'next';
import { ReactNode } from 'react';
import ShopNav from '@/components/UI/Shop/Nav/Navbar';
import Footer from '@/components/UI/Shop/Footer';
import CometsContainer from '@/components/UI/general/CometsContainer';
import GlobalCurrencyFXWrapper from '@/components/UI/Providers/Shop/GlobalCurrencyFXWrapper';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SHOP_SITE_URL ?? 'https://codexchristi.shop'),
  title: 'Shop for Godly, Creative Merch | Codex Christi Shop',
  description: `Discover Godly and creative merch at Codex Christi Shop! Explore unique,
    faith-inspired apparel, accessories, and gifts designed to inspire and uplift.
    Shop now for meaningful creations that celebrate your faith!`,
};

export default function ShopRootLayout({ children }: { children: ReactNode }) {
  return (
    <CometsContainer>
      <GlobalCurrencyFXWrapper>
        <ShopNav />
        {children}
      </GlobalCurrencyFXWrapper>
      <Footer />
    </CometsContainer>
  );
}
