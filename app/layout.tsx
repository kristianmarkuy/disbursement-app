import './globals.css';
import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-provider';

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
});

export const metadata: Metadata = {
  title: 'LedgerOne',
  description: 'LedgerOne Cash Disbursement Register System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={interTight.variable}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
