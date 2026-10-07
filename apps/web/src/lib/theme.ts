/**
 * 테마 설정 (기기별). localStorage `cs_theme`에 system | light | dark 저장.
 * - system: OS 설정(prefers-color-scheme)을 따른다 → <html>에 data-theme 없음
 * - light/dark: <html data-theme="…">로 강제
 * 첫 페인트 전에 적용해야 깜빡임이 없으므로 THEME_INIT_SCRIPT를 <head>에 인라인으로 넣는다.
 */
export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cs_theme';

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function readThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // 저장 불가(사파리 개인정보 모드 등)면 이번 방문 동안만 적용
  }
}
