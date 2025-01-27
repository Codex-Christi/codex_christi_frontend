import { Metadata } from 'next';
import { headers } from 'next/headers';
import { ReactNode } from 'react';

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
    <div>
      <h1>Hello</h1>
      {children}
    </div>
  );
}
