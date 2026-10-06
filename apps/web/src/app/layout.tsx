import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: { default: 'CS 데일리', template: '%s · CS 데일리' },
  description: '하루 5분, 매일 푸는 컴퓨터 사이언스',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
