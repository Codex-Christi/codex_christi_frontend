import { Metadata } from 'next';
import { ReactNode } from 'react';
import ShopNav from '@/components/UI/Shop/Nav/Navbar';
import Footer from '@/components/UI/Shop/Footer';
import CometsContainer from '@/components/UI/general/CometsContainer';
import PublicCurrencyFXWrapper from '@/components/UI/Providers/Shop/PublicCurrencyFXWrapper';
import { getShopSiteBaseUrl } from '@/lib/siteBaseUrls';

export const metadata: Metadata = {
  metadataBase: new URL(getShopSiteBaseUrl()),
  title: 'Shop for Godly, Creative Merch | Codex Christi Shop',
  description: `Discover Godly and creative merch at Codex Christi Shop! Explore unique,
    faith-inspired apparel, accessories, and gifts designed to inspire and uplift.
    Shop now for meaningful creations that celebrate your faith!`,
};

export default function ShopRootLayout({ children }: { children: ReactNode }) {
  return (
    <CometsContainer cometMotion='static'>
      <PublicCurrencyFXWrapper>
        <ShopNav />
        {children}
      </PublicCurrencyFXWrapper>
      <Footer />
    </CometsContainer>
  );
}
