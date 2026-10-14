'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * 요소의 높이(border-box, px)를 ResizeObserver로 따라가는 콜백 ref 훅. 요소가 없으면 0.
 * 레슨 플레이어가 하단 도크의 버튼 줄·결과 창 높이를 재서 문제 영역의 아래 여백으로 쓴다.
 */
export function useHeight<T extends HTMLElement>() {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) {
      setHeight(0);
      return;
    }
    const read = () => setHeight(Math.round(el.getBoundingClientRect().height));
    read();
    observer.current = new ResizeObserver(read);
    observer.current.observe(el);
  }, []);
  return [ref, height] as const;
}

/** 요소의 내용이 넘쳐 스크롤되는지(scrollHeight > clientHeight)를 따라가는 콜백 ref 훅 */
export function useOverflowing<T extends HTMLElement>() {
  const [overflowing, setOverflowing] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) {
      setOverflowing(false);
      return;
    }
    const read = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    read();
    observer.current = new ResizeObserver(read);
    observer.current.observe(el);
    // 내용이 바뀌어도 요소 크기는 그대로일 수 있어 자식도 관찰한다
    for (const child of Array.from(el.children)) observer.current.observe(child);
  }, []);
  return [ref, overflowing] as const;
}
