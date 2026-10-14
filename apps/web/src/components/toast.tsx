'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { CheckIcon, XIcon } from './icons';

/**
 * 토스트 (Platinum): 1px ink 테두리 + 평면 surface + 2px 2px 0 그림자의 작은 창. 타이틀바 없음.
 * 하나만 보여 준다(새 토스트가 이전 것을 교체). 2.5초 뒤 즉시 사라지고, 포커스를 가져가지 않는다.
 * 알림 영역(role=status / role=alert)은 항상 마운트해 두어 내용이 바뀔 때 스크린 리더가 읽는다.
 */
export type ToastKind = 'success' | 'error';
type ToastState = { id: number; message: string; kind: ToastKind };
type ToastApi = { show: (message: string, opts?: { kind?: ToastKind }) => void };

const DURATION_MS = 2500;
const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있습니다');
  return ctx;
}

// 하단 탭 바가 있는 화면(AppShell). 그 밖(레슨 플레이어·온보딩·로그인)은 탭 바가 없다
const TAB_BAR_PATHS = ['/learn', '/review', '/profile', '/settings'];

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname() ?? '';
  const hasTabBar = TAB_BAR_PATHS.some((p) => pathname.startsWith(p));

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback<ToastApi['show']>((message, opts) => {
    if (timer.current) clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, message, kind: opts?.kind ?? 'success' });
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast(null);
    }, DURATION_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className={clsx(
          'pointer-events-none fixed inset-x-0 z-50 px-4 md:bottom-6',
          hasTabBar ? 'bottom-[calc(57px+env(safe-area-inset-bottom)+12px)]' : 'bottom-[calc(16px+env(safe-area-inset-bottom))]',
        )}
      >
        <div role="status" aria-live="polite" className="mx-auto w-full max-w-[360px]">
          {toast && toast.kind === 'success' && <ToastView key={toast.id} toast={toast} onClose={dismiss} />}
        </div>
        <div role="alert" className="mx-auto w-full max-w-[360px]">
          {toast && toast.kind === 'error' && <ToastView key={toast.id} toast={toast} onClose={dismiss} />}
        </div>
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const error = toast.kind === 'error';
  return (
    <div className="toast pointer-events-auto flex items-center gap-3 pl-4">
      <span className={clsx('shrink-0', error && 'text-wrong')}>{error ? <XIcon size={20} /> : <CheckIcon size={20} />}</span>
      <p className={clsx('min-w-0 flex-1 py-2.5 text-body', error && 'text-wrong')}>{toast.message}</p>
      <button type="button" aria-label="닫기" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-ink active:bg-brand-fill active:text-on-brand">
        <XIcon size={16} />
      </button>
    </div>
  );
}
