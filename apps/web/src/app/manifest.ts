import type { MetadataRoute } from 'next';

/** PWA 매니페스트 (홈 화면 설치). 서비스 워커·오프라인 캐시는 2단계. 색은 globals.css 다크 토큰(surface, brand)과 같은 값(스플래시는 다크) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CS 데일리',
    short_name: 'CS 데일리',
    description: '하루 5분, 매일 푸는 컴퓨터 사이언스',
    start_url: '/learn',
    display: 'standalone',
    background_color: '#282a36',
    theme_color: '#bd93f9',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
