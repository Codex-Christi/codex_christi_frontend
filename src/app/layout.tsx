import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Montserrat } from 'next/font/google';

import { cn } from '@/lib/utils';

// Components Import

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

  icons: {
    icon: [
      {
        media: '(prefers-color-scheme: light)',
        url: '/media/favicons/favicon-light-mode.ico',
        href: '/media/favicons/favicon-light-mode.ico',
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: '/media/favicons/favicon-dark-mode.ico',
        href: '/media/favicons/favicon-dark-mode.ico',
      },
    ],
  },
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
        {children}
      </body>
    </html>
  );
}
