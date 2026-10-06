import type { MetadataRoute } from 'next';

/** PWA 매니페스트 (홈 화면 설치). 서비스 워커·오프라인 캐시는 2단계 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CS 데일리',
    short_name: 'CS 데일리',
    description: '하루 5분, 매일 푸는 컴퓨터 사이언스',
    start_url: '/learn',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
