'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { MeQuestsResponse, MeResponse, PathResponse } from '@cs-daily/contracts';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { QuestsPanel } from '@/components/quests-panel';
import { StatsPanel } from '@/components/stats-panel';
import { LearningPath } from '@/components/learning-path';
import { NextLessonCard } from '@/components/next-lesson-card';
import { StreakBar } from '@/components/streak-week';
import { readLastTrack, writeLastTrack } from '@/lib/last-track';

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

  // 트랙 선택 우선순위: URL ?track= → 마지막으로 보던 트랙(기기 저장) → 첫 트랙.
  // 저장값은 클라이언트에서만 읽을 수 있으므로 읽기 전(undefined)에는 경로를 요청하지 않는다 (잘못된 트랙이 먼저 깜빡이는 것 방지)
  const [lastTrack, setLastTrack] = useState<string | null | undefined>(undefined);
  useEffect(() => setLastTrack(readLastTrack()), []);
  const tracks = me.data?.tracks ?? [];
  const has = (slug: string | null | undefined) => !!slug && tracks.some((t) => t.slug === slug);
  const fromUrl = params.get('track');
  const trackSlug = has(fromUrl) ? fromUrl! : lastTrack === undefined ? undefined : has(lastTrack) ? lastTrack! : tracks[0]?.slug;
  useEffect(() => {
    if (trackSlug) writeLastTrack(trackSlug);
  }, [trackSlug]);
  // 가로 스크롤 줄에서 선택된 칩이 화면 밖이면 줄의 scrollLeft만 조정해 보이게 한다 (세로 페이지 스크롤은 건드리지 않는다)
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsReady = !!me.data && me.data.tracks.length > 0;
  useEffect(() => {
    const row = tabsRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const r = row.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (c.left < r.left) row.scrollLeft += c.left - r.left;
    else if (c.right > r.right) row.scrollLeft += c.right - r.right;
  }, [trackSlug, tabsReady]);
  const quests = useQuery({ queryKey: ['me', 'quests'], queryFn: () => api<MeQuestsResponse>('/me/quests') });
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
          <h1 className="bit-2">아직 선택한 트랙이 없어요</h1>
          <p className="mt-2 text-ink-2">공부할 분야를 고르면 경로가 만들어집니다.</p>
          <Link href="/onboarding" className="btn-3d mt-6">트랙 고르기</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      aside={
        <>
          <StatsPanel me={me.data} />
          {quests.data && <QuestsPanel data={quests.data} />}
        </>
      }
    >
      <header className="space-y-4">
        {/* 연속 학습 상태 바 한 줄 (PC에서는 우측 보조 패널의 스트릭 카드가 같은 정보를 보여 준다) */}
        <StreakBar me={me.data} className="lg:hidden" />

        {quests.data && (
          <div className="lg:hidden">
            <QuestsPanel data={quests.data} compact />
          </div>
        )}

        {path.data ? <NextLessonCard path={path.data} me={me.data} /> : <HeroSkeleton />}

        <div ref={tabsRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 mouse:flex-wrap mouse:overflow-x-visible" role="tablist" aria-label="트랙">
          {me.data.tracks.map((t) => (
            <Link key={t.slug} href={`/learn?track=${t.slug}`} role="tab" aria-selected={t.slug === trackSlug} className="chip">
              {t.name}
            </Link>
          ))}
        </div>
      </header>

      <div className="mt-8">
        {path.isLoading && <PadsSkeleton />}
        {path.data && <LearningPath path={path.data} />}
      </div>
    </AppShell>
  );
}

function Skeleton() {
  return (
    <div aria-busy>
      <HeroSkeleton />
      <div className="mt-8">
        <PadsSkeleton />
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return <div className="h-52 border border-line bg-surface" aria-hidden />;
}

function PadsSkeleton() {
  return (
    <div className="space-y-9" aria-busy>
      <div className="mx-auto h-14 w-14 border border-line bg-surface" />
      <div className="mx-auto h-14 w-14 border border-line bg-surface" />
    </div>
  );
}
