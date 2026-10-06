'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { MeResponse, PathResponse } from '@cs-daily/contracts';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { StatsPanel } from '@/components/stats-panel';
import { LearningPath } from '@/components/learning-path';

export default function LearnPage() {
  return (
    <Suspense fallback={<AppShell><Skeleton /></AppShell>}>
      <LearnInner />
    </Suspense>
  );
}

function LearnInner() {
  const params = useSearchParams();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const trackSlug = params.get('track') ?? me.data?.tracks[0]?.slug;
  const path = useQuery({
    queryKey: ['path', trackSlug],
    queryFn: () => api<PathResponse>(`/me/path?track=${trackSlug}`),
    enabled: !!trackSlug,
  });

  if (me.isLoading) return <AppShell><Skeleton /></AppShell>;
  if (me.isError || !me.data) return <AppShell><p className="card p-6 text-center">불러오지 못했습니다. 새로고침해 주세요.</p></AppShell>;
  if (me.data.tracks.length === 0) {
    return (
      <AppShell>
        <div className="card p-8 text-center">
          <h1 className="text-xl font-black">아직 선택한 트랙이 없어요</h1>
          <p className="mt-2 text-(--color-ink-2)">공부할 분야를 고르면 경로가 만들어집니다.</p>
          <Link href="/onboarding" className="btn-3d mt-6">트랙 고르기</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell aside={<StatsPanel me={me.data} />}>
      <header className="mb-6">
        <div className="lg:hidden"><StatsPanel me={me.data} compact /></div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="트랙">
          {me.data.tracks.map((t) => (
            <Link
              key={t.slug}
              href={`/learn?track=${t.slug}`}
              role="tab"
              aria-selected={t.slug === trackSlug}
              className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold ${t.slug === trackSlug ? 'border-(--color-brand) bg-(--color-brand) text-white' : 'border-(--color-line) text-(--color-ink-2)'}`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      </header>

      {path.isLoading && <Skeleton />}
      {path.data && <LearningPath path={path.data} />}
    </AppShell>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-24 animate-pulse rounded-2xl bg-(--color-line)" />
      <div className="h-16 w-16 animate-pulse rounded-full bg-(--color-line)" />
      <div className="h-16 w-16 animate-pulse rounded-full bg-(--color-line)" />
    </div>
  );
}
