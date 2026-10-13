import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: { default: 'CS 데일리', template: '%s · CS 데일리' },
  description: '하루 5분, 매일 푸는 컴퓨터 사이언스',
  manifest: '/manifest.webmanifest',
};

// themeColor는 메타 태그 값이라 CSS 변수를 쓸 수 없다. globals.css의 surface-2(ground)와 같은 값으로 맞춘다
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffbeb' },
    { media: '(prefers-color-scheme: dark)', color: '#21222c' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme은 아래 인라인 스크립트가 하이드레이션 전에 설정하므로 경고를 끈다
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* next/font/google은 쓰지 않는다: 빌드 중 폰트 다운로드가 막힌 환경이 있다 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 이 규칙은 pages/_document용이다. App Router 루트 레이아웃의 <head>는 모든 페이지에 적용된다 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
