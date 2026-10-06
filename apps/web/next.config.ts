import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * /api/*  → NestJS 리라이트: 브라우저는 같은 오리진에만 요청하므로 JWT 쿠키가 same-site로 붙는다.
 * /auth/* → OAuth 시작·콜백·refresh·logout도 같은 이유로 리라이트.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cs-daily/contracts'],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${api}/:path*` },
      { source: '/auth/:path*', destination: `${api}/auth/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
