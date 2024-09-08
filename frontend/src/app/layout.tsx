import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Montserrat } from 'next/font/google';

import { cn } from '@/lib/utils';

// Components Import
import MainNav from '@/components/UI/general/MainNav';

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

export const metadata: Metadata = {
  title: 'Codex Christi',
  description: 'A Hub for Christian Creatives',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className='!overflow-x-hidden'>
      <body
        className={cn(
          ` font-nico bg-black text-white !overflow-x-hidden !overflow-y-auto w-full min-h-screen !relative `,
          nicoMoji.variable,
          OCR_ext.variable,
          MontserratFont.variable
        )}
      >
        <MainNav />
        {children}
      </body>
    </html>
  );
}
