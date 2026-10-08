import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/privacy', '/terms', '/auth', '/api','/manifest.webmanifest', '/icons', '/_next', '/favicon.ico'];

/**
 * 쿠키 존재만 확인해 리다이렉트한다 (기획서 6.1 "Next.js 쪽 구조").
 * 실제 JWT 검증은 NestJS Guard가 하고, 만료 시 api()가 /auth/refresh로 회전한다.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const hasSession = req.cookies.has('cs_access') || req.cookies.has('cs_refresh');
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
