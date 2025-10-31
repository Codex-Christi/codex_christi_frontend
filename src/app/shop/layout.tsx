import { Metadata } from 'next';
import { headers } from 'next/headers';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import ShopNav from '@/components/UI/Shop/Nav/Navbar';
import Footer from '@/components/UI/Shop/Footer';
const CometsContainer = dynamic(() => import('@/components/UI/general/CometsContainer'));

const UserMainProfileStoreInitializer = dynamic(
  () => import('@/components/UI/Providers/UserMainProfileStoreInitializer'),
);

export async function generateMetadata(): Promise<Metadata> {
  return {
    // dynamically get the host from the Next headers
    metadataBase: new URL(`https://${(await headers()).get('host')}`),
    title: 'Shop for Godly, Creative Merch | Codex Christi Shop',
    description: `Discover Godly and creative merch at Codex Christi Shop! Explore unique,
    faith-inspired apparel, accessories, and gifts designed to inspire and uplift.
    Shop now for meaningful creations that celebrate your faith!`,
  };
}

export default function ShopRootLayout({ children }: { children: ReactNode }) {
  return (
    <CometsContainer>
      <UserMainProfileStoreInitializer />
      <ShopNav />
      {children}
      <Footer />
    </CometsContainer>
  );
}
