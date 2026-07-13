import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Inter for body copy (was already named in the globals.css font stack but never
// actually loaded, so it was silently falling back to system fonts). Poppins for
// headings/section banners — a rounder, bolder geometric sans that reads closer to the
// reference incident-report form the client wants to match, without touching body
// copy legibility.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Clickforms — Internal forms & workflows',
  description:
    'Build intake, consent, and service agreement forms. Collect e-signatures and submissions, route through approvals, and manage responses — your in-house replacement for scattered form workflows.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className={`${inter.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
