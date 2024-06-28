import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'Codex Christi',
  description: 'A Hub for Christian developers',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body
        className={cn(
          ` font-nico bg-black overflow-x-hidden`,
          nicoMoji.variable,
          OCR_ext.variable
        )}
      >
        <MainNav />
        {children}
      </body>
    </html>
  );
}
