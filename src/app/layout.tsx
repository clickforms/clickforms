import type { Metadata } from 'next';
import { Inter, Poppins, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Inter for body copy (was already named in the globals.css font stack but never
// actually loaded, so it was silently falling back to system fonts). Poppins for
// headings/section banners — a rounder, bolder geometric sans that reads closer to the
// reference incident-report form the client wants to match, without touching body
// copy legibility. Space Grotesk for landing display — sharper editorial weight.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Clickforms — Internal forms & workflows',
  description:
    'Build intake, consent, and service agreement forms. Collect e-signatures and submissions, route through approvals, and manage responses — your in-house replacement for scattered form workflows.',
  applicationName: 'Clickforms',
  icons: {
    icon: [
      { url: '/brand/favicon.ico', sizes: 'any' },
      { url: '/brand/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/mark.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Clickforms — Internal forms & workflows',
    description:
      'Build intake, consent, and service agreement forms. Collect e-signatures and submissions, route through approvals, and manage responses.',
    siteName: 'Clickforms',
    images: [{ url: '/brand/logo.png', width: 666, height: 184, alt: 'Clickforms' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
