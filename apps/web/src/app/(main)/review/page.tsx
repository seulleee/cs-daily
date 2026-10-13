'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MeResponse, SessionResponse } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { RepeatIcon } from '@/components/icons';
import { StatsPanel } from '@/components/stats-panel';
import { Window } from '@/components/window';

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
      <h1 className="bit-2">복습</h1>
      <p className="mt-1 text-cap text-ink-2">지금 복습할 문제</p>

      {due.isLoading && <p className="card mt-6 p-5 text-ink-2">확인 중…</p>}

      {due.data && due.data.count === 0 && (
        <div className="card mt-6 p-5">
          <p className="text-body">지금 복습할 문제가 없어요. 레슨을 풀면 내일부터 쌓여요.</p>
          <Link href="/learn" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
            학습으로 가기
          </Link>
        </div>
      )}

      {due.data && due.data.count > 0 && (
        <>
          <Window title="복습 대기" className="mt-6" bodyClassName="flex items-center justify-between p-5">
            <div className="flex items-baseline gap-2">
              <span className="bit-3">{due.data.count}</span>
              <span className="text-body text-ink-2">문제</span>
            </div>
            <span aria-hidden className="flex h-16 w-16 items-center justify-center border border-ink bg-surface text-ink">
              <RepeatIcon size={30} />
            </span>
          </Window>

          {due.data.byTrack.length > 0 && (
            <ul className="card mt-6 divide-y divide-line">
              {due.data.byTrack.map((t) => (
                <li key={t.trackSlug} className="flex items-center justify-between px-5 py-3.5">
                  <span>{t.trackName}</span>
                  <span className="bit">{t.count}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="bit mt-4 text-ink-2">한 번에 최대 10문제 · 복습 세션은 XP ×1.5</p>
          <button type="button" onClick={() => start.mutate()} disabled={start.isPending} className="btn-3d mt-5 w-full">
            복습 시작
          </button>
          {start.isError && <p className="mt-2 text-cap text-wrong">{(start.error as ApiError).message}</p>}
        </>
      )}
    </AppShell>
  );
}
