import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { getMainSiteBaseUrl } from '@/lib/siteBaseUrls';

// Dynamic Components

const AllRootProviders = dynamic(() => import('@/components/UI/Providers/AllRootProviders'));

const nicoMoji = localFont({
  src: '../res/fonts/Nico-Moji-latin.woff2',
  variable: '--font-nico',
  display: 'swap',
  preload: true,
});

const OCR_ext = localFont({
  src: '../res/fonts/OCR-ext-latin.woff2',
  variable: '--font-ocr',
  display: 'swap',
  preload: true,
});

const InterFont = localFont({
  src: '../res/fonts/Inter-latin.var.woff2',
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const TradeWinds = localFont({
  src: '../res/fonts/Trade-Winds.ttf',
  variable: '--font-trade-winds',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(getMainSiteBaseUrl()),
  title: 'Codex Christi',
  description: 'A Hub for Christian Creatives to connect, share, and glorify God.',
};

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: 'cover',
  width: 'device-width',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Main HTML Document
  return (
    <html lang='en' className='!overflow-x-hidden !overflow-y-auto '>
      {/* !w-screen */}
      <body
        className={cn(
          ` font-inter bg-black text-white !max-w-full !overflow-x-hidden antialiased break-words [word-break:break-word] [word-wrap:break-word]`,
          // break-words [word-break:break-word] [word-wrap:break-word]
          nicoMoji.variable,
          OCR_ext.variable,
          InterFont.variable,
          TradeWinds.variable,
        )}
      >
        {children}
        <AllRootProviders />
      </body>
    </html>
  );
}
