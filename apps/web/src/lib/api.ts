import type { ApiErrorBody, ErrorCode } from '@cs-daily/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * 브라우저용 fetch 래퍼. /api/* 리라이트를 타므로 쿠키가 자동으로 붙는다.
 * 401이면 /auth/refresh로 한 번 회전 후 재시도, 그래도 실패하면 로그인으로.
 */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const doFetch = () =>
    fetch(`/api${path}`, {
      ...init,
      method: init.method ?? (init.json !== undefined ? 'POST' : 'GET'),
      headers: { ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      credentials: 'include',
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError(0, 'NETWORK', '네트워크 연결을 확인해 주세요');
  }

  if (res.status === 401) {
    const refreshed = await fetch('/auth/refresh', { method: 'POST', credentials: 'include' });
    if (refreshed.ok) res = await doFetch();
    else {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요합니다');
    }
  }

  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `요청 실패 (${res.status})`, err?.details);
  }
  return body as T;
}

/** 서버 컴포넌트용: 쿠키를 전달해 API 내부 주소로 직접 호출 (SSR) */
export async function serverApi<T>(path: string, cookie: string): Promise<T | null> {
  const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const res = await fetch(`${base}${path}`, { headers: { cookie }, cache: 'no-store' });
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError(res.status, 'INTERNAL', `SSR 요청 실패 ${path}`);
  return (await res.json()) as T;
}
