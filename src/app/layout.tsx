import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Montserrat } from 'next/font/google';
import { cn } from '@/lib/utils';
import { headers } from 'next/headers';
import { Toaster } from '@/components/UI/primitives/toaster';

// Components Import
import FaviconUpdater from '@/components/UI/general/Helpers/FaviconUpdater';

const nicoMoji = localFont({
  src: '../res/fonts/Nico-Moji.woff',
  variable: '--font-nico',
});
const OCR_ext = localFont({
  src: '../res/fonts/OCR-ext.ttf',
  variable: '--font-ocr',
});
const MontserratFont = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    // dynamically get the host from the Next headers
    metadataBase: new URL(`https://${(await headers()).get('host')}`),
    title: 'Codex Christi',
    description:
      'A Hub for Christian Creatives to connect, share, and glorify God.',
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
          ` font-montserrat bg-black text-white !max-w-full !overflow-x-hidden antialiased`,
          nicoMoji.variable,
          OCR_ext.variable,
          MontserratFont.variable
        )}
      >
        <FaviconUpdater />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
