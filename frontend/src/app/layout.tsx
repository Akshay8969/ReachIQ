import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'ReachIQ — AI-Native Mini CRM',
  description: 'Intelligent marketing CRM that helps fashion brands reach their shoppers with AI-powered segmentation and personalised campaigns.',
  keywords: 'CRM, AI, marketing, campaigns, customer segmentation, WhatsApp, email marketing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
