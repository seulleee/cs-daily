'use client';

import { useEffect, useState } from 'react';

/** 키보드가 열렸다고 볼 최소 높이(px). 주소창 접힘 같은 작은 변화는 키보드로 보지 않는다 */
const KEYBOARD_MIN = 120;

export type KeyboardState = {
  /** 레이아웃 뷰포트 아래 끝에서 보이는 영역 아래 끝까지의 거리. 고정 하단 요소를 이만큼 올린다 */
  inset: number;
  /** 가상 키보드가 열려 있는지(Android resizes-content라 inset이 0이어도 true) */
  open: boolean;
};

/**
 * 순수 계산. innerHeight = 레이아웃 뷰포트 높이, vvHeight·vvOffsetTop = visualViewport,
 * baseline = 키보드가 닫혀 있을 때 본 가장 큰 높이.
 * iOS Safari: 레이아웃 뷰포트가 그대로라 innerHeight - vvHeight - offsetTop 이 키보드 높이다.
 * Android Chrome(interactive-widget=resizes-content): innerHeight 자체가 줄어 inset은 0이 된다(이중 이동 방지).
 */
export function computeKeyboardState(innerHeight: number, vvHeight: number, vvOffsetTop: number, baseline: number): KeyboardState {
  const inset = Math.max(0, Math.round(innerHeight - vvHeight - vvOffsetTop));
  const shrunk = Math.max(baseline, innerHeight) - vvHeight - vvOffsetTop;
  return { inset, open: inset >= KEYBOARD_MIN || shrunk >= KEYBOARD_MIN };
}

const CLOSED: KeyboardState = { inset: 0, open: false };

export function useKeyboardInset(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(CLOSED);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let baseline = Math.max(window.innerHeight, vv.height);
    let raf = 0;
    const update = () => {
      raf = 0;
      // 닫힌 상태(두 높이가 거의 같음)에서만 기준 높이를 갱신한다. 회전하면 새 기준이 된다
      if (Math.abs(window.innerHeight - vv.height) < 2 && vv.offsetTop === 0) baseline = window.innerHeight;
      const next = computeKeyboardState(window.innerHeight, vv.height, vv.offsetTop, baseline);
      setState((prev) => (prev.inset === next.inset && prev.open === next.open ? prev : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('orientationchange', schedule);
    return () => {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('orientationchange', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return state;
}
