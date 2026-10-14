'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { CheckIcon, XIcon } from './icons';

/**
 * 토스트 (Platinum): 1px ink 테두리 + 평면 surface + 2px 2px 0 그림자의 작은 창. 타이틀바 없음.
 * 하나만 보여 준다(새 토스트가 이전 것을 교체). 2.5초 뒤 즉시 사라지고, 포커스를 가져가지 않는다.
 * 알림 영역(role=status / role=alert)은 항상 마운트해 두어 내용이 바뀔 때 스크린 리더가 읽는다.
 */
export type ToastKind = 'success' | 'error';
type ToastState = { id: number; message: string; kind: ToastKind; leaving?: boolean };
type ToastApi = { show: (message: string, opts?: { kind?: ToastKind }) => void };

const DURATION_MS = 2500;
const EXIT_FALLBACK_MS = 300;
const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있습니다');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 닫힐 때: 위로 올라가는 퇴장 애니메이션을 먼저 돌리고(onAnimationEnd에서 언마운트), 줄이기 설정이면 즉시 제거한다
  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setToast(null);
      return;
    }
    setToast((t) => (t ? { ...t, leaving: true } : t));
    // animationend가 오지 않는 경우(백그라운드 탭, CSS 미적용 등)의 폴백
    const id = seq.current;
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast((t) => (t && t.id === id ? null : t));
    }, EXIT_FALLBACK_MS);
  }, []);

  const remove = useCallback((id: number) => {
    if (id === seq.current && timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setToast((t) => (t && t.id === id ? null : t));
  }, []);

  // 교체(연속 저장)는 퇴장 없이 바로 새 토스트로 바꾼다
  const show = useCallback<ToastApi['show']>((message, opts) => {
    if (timer.current) clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, message, kind: opts?.kind ?? 'success' });
    timer.current = setTimeout(() => {
      timer.current = null;
      dismiss();
    }, DURATION_MS);
  }, [dismiss]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-host pointer-events-none fixed inset-x-0 z-[60]">
        <div role="status" aria-live="polite">
          {toast && toast.kind === 'success' && <ToastView key={toast.id} toast={toast} onClose={dismiss} onGone={remove} />}
        </div>
        <div role="alert">
          {toast && toast.kind === 'error' && <ToastView key={toast.id} toast={toast} onClose={dismiss} onGone={remove} />}
        </div>
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ toast, onClose, onGone }: { toast: ToastState; onClose: () => void; onGone: (id: number) => void }) {
  const error = toast.kind === 'error';
  return (
    <div
      className={clsx('toast pointer-events-auto flex items-center gap-3 pl-4', toast.leaving && 'toast-leaving')}
      onAnimationEnd={(e) => {
        if (toast.leaving && e.currentTarget === e.target) onGone(toast.id);
      }}
    >
      <span className={clsx('shrink-0', error && 'text-wrong')}>{error ? <XIcon size={20} /> : <CheckIcon size={20} />}</span>
      <p className={clsx('min-w-0 flex-1 py-2.5 text-body', error && 'text-wrong')}>{toast.message}</p>
      <button type="button" aria-label="닫기" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-ink active:bg-brand-fill active:text-on-brand">
        <XIcon size={16} />
      </button>
    </div>
  );
}
