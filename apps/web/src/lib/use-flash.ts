'use client';

import { useEffect } from 'react';

/** 클릭 완료 깜빡임 길이. globals.css의 `.is-flash`(btn-flash) 애니메이션 길이와 같아야 한다 */
export const FLASH_MS = 150;

/** 깜빡이는 대상: 주 버튼(.btn-3d)과 반전 상태인 현재 레슨 패드 */
const TARGET = '.btn-3d, .pad[data-current="true"]';

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 클릭이 끝나면 대상에 `is-flash` 클래스를 달아 반전 깜빡임(`btn-flash`, 150ms)을 한 번 재생하고, 끝나면 뗀다.
 * 눌린 동안은 CSS `:active`가 반전을 즉시 풀어 두므로, 깜빡임은 "눌린 모양 → 75ms 뒤 원래 모양"으로 이어져 아주 짧은 탭도 눈에 보인다.
 *
 * 루트에서 한 번만 호출한다(lib/providers.tsx). 문서 전체의 click을 가로채므로 `.btn-3d`를 쓰는 모든 버튼·링크와 현재 패드가
 * 개별 수정 없이 같은 동작을 한다. Enter·Space로 누른 버튼도 브라우저가 click을 일으키므로 똑같이 깜빡인다.
 * 비활성 버튼은 click이 오지 않아 움직임이 없고, `prefers-reduced-motion: reduce`에서는 클래스를 달지 않는다.
 */
export function useFlash() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (prefersReducedMotion()) return;
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(TARGET) : null;
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
      // 연타: 클래스를 뗐다 다시 달아 애니메이션을 처음부터
      el.classList.remove('is-flash');
      void el.offsetWidth;
      el.classList.add('is-flash');
    };
    const onDone = (e: AnimationEvent) => {
      if (e.animationName === 'btn-flash' && e.target instanceof Element) e.target.classList.remove('is-flash');
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('animationend', onDone, true);
    document.addEventListener('animationcancel', onDone, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('animationend', onDone, true);
      document.removeEventListener('animationcancel', onDone, true);
    };
  }, []);
}

/** 깜빡임이 끝날 때까지 기다린다(줄이기 설정이면 즉시). 클릭 직후 화면을 넘기는 동작이 깜빡임을 자르지 않게 한다 */
export const afterFlash = () => new Promise<void>((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : FLASH_MS));
