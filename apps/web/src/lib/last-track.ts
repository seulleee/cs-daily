/**
 * 마지막으로 보던 트랙 탭 (기기별, localStorage).
 * 레슨·결과 화면에서 /learn 으로 돌아올 때 URL에 ?track= 이 없어도 보던 트랙을 다시 연다.
 */
const KEY = 'cs_last_track';

export function readLastTrack(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeLastTrack(slug: string) {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    // 저장 불가 환경이면 이번 방문 동안만 URL로 동작
  }
}
