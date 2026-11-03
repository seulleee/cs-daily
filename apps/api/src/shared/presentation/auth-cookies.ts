/** 인증 쿠키 이름. JWT 전략(읽기)과 AuthController(쓰기)가 공유 */
export const ACCESS_COOKIE = 'cs_access';
export const REFRESH_COOKIE = 'cs_refresh';

/** 두 인증 쿠키를 지운다 (로그아웃·리프레시 실패·계정 삭제 공통) */
export function clearAuthCookies(res: { clearCookie(name: string, options: { path: string }): unknown }) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}
