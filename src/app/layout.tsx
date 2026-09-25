import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';

// Self-hosted so compile/runtime never needs to reach Google Fonts (offline, air-gapped,
// or DNS failures all used to 500 the layout). Inter for body copy, Poppins for
// headings/section banners, Space Grotesk for landing display. CSS variables stay the
// same as the previous next/font/google setup so globals.css does not need to change.
const inter = localFont({
  src: [
    { path: './fonts/inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/inter-latin-wght-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-inter',
  display: 'swap',
});
const poppins = localFont({
  src: [
    { path: './fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/poppins-latin-800-normal.woff2', weight: '800', style: 'normal' },
    { path: './fonts/poppins-latin-900-normal.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});
const spaceGrotesk = localFont({
  src: [
    {
      path: './fonts/space-grotesk-latin-wght-normal.woff2',
      weight: '300 700',
      style: 'normal',
    },
  ],
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
