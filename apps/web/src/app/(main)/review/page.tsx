'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { MeResponse, SessionResponse } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { StatsPanel } from '@/components/stats-panel';

type Due = { count: number; byTrack: { trackSlug: string; trackName: string; count: number }[] };

export default function ReviewPage() {
  const router = useRouter();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const due = useQuery({ queryKey: ['review-due'], queryFn: () => api<Due>('/review/due') });
  const start = useMutation({
    mutationFn: () => api<SessionResponse>('/review/sessions', { method: 'POST' }),
    onSuccess: (s) => router.push(`/lesson/${s.id}`),
  });

  return (
    <AppShell aside={me.data && <StatsPanel me={me.data} />}>
      <h1 className="mb-4 text-2xl font-black">복습</h1>
      <div className="card p-6">
        {due.isLoading && <p className="text-(--color-ink-2)">확인 중…</p>}
        {due.data && due.data.count === 0 && (
          <div className="text-center">
            <div className="text-4xl" aria-hidden>🌱</div>
            <p className="mt-2 font-bold">오늘 복습할 문제가 없어요</p>
            <p className="mt-1 text-sm text-(--color-ink-2)">레슨을 풀면 틀린 문제와 오래된 문제가 자동으로 쌓입니다.</p>
          </div>
        )}
        {due.data && due.data.count > 0 && (
          <>
            <p className="text-3xl font-black">{due.data.count}<span className="ml-1 text-base font-bold text-(--color-ink-2)">문제</span></p>
            <ul className="mt-3 space-y-1 text-sm text-(--color-ink-2)">
              {due.data.byTrack.map((t) => (
                <li key={t.trackSlug} className="flex justify-between"><span>{t.trackName}</span><span>{t.count}</span></li>
              ))}
            </ul>
            <button type="button" onClick={() => start.mutate()} disabled={start.isPending} className="btn-3d mt-6 w-full">
              복습 시작 (최대 10문제, XP ×1.5)
            </button>
            {start.isError && <p className="mt-2 text-sm text-(--color-wrong)">{(start.error as ApiError).message}</p>}
          </>
        )}
      </div>
    </AppShell>
  );
}
