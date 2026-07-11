import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://disbursement-app.vercel.app'),
  title: {
    default: 'LedgerOne',
    template: '%s | LedgerOne',
  },
  description: 'LedgerOne helps schools manage cash disbursement records, reports, and approvals in one secure portal.',
  applicationName: 'LedgerOne',
  keywords: [
    'LedgerOne',
    'cash disbursement register',
    'school finance',
    'disbursement reports',
    'financial records',
  ],
  authors: [{ name: 'LedgerOne' }],
  creator: 'LedgerOne',
  publisher: 'LedgerOne',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'LedgerOne',
    title: 'LedgerOne',
    description: 'Manage school cash disbursement records, reports, and approvals in one secure portal.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'LedgerOne cash disbursement register dashboard preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LedgerOne',
    description: 'Manage school cash disbursement records, reports, and approvals in one secure portal.',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
