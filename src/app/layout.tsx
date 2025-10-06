import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Inter, Trade_Winds } from 'next/font/google';
import { cn } from '@/lib/utils';
import { headers } from 'next/headers';
import dynamic from 'next/dynamic';

// Dynamic Components

const AllRootProviders = dynamic(() => import('@/components/UI/Providers/AllRootProviders'));

const nicoMoji = localFont({
  src: '../res/fonts/Nico-Moji.woff',
  variable: '--font-nico',
  preload: true,
});

const OCR_ext = localFont({
  src: '../res/fonts/OCR-ext.ttf',
  variable: '--font-ocr',
  preload: false,
});

const InterFont = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  preload: true,
});

const TradeWinds = Trade_Winds({
  subsets: ['latin'],
  variable: '--font-trade-winds',
  weight: ['400'],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    // dynamically get the host from the Next headers
    metadataBase: new URL(`https://${(await headers()).get('host')}`),
    title: 'Codex Christi',
    description: 'A Hub for Christian Creatives to connect, share, and glorify God.',
  };
}

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
          ` font-inter bg-black text-white !max-w-full !overflow-x-hidden antialiased`,
          nicoMoji.variable,
          OCR_ext.variable,
          InterFont.variable,
          TradeWinds.variable,
        )}
      >
        <AllRootProviders>{children}</AllRootProviders>
      </body>
    </html>
  );
}
