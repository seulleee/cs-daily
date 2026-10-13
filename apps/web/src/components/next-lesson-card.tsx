'use client';

import type { MeResponse, PathResponse } from '@cs-daily/contracts';
import Link from 'next/link';
import { useStartLesson } from './learning-path';

/** 학습 홈 맨 위의 "다음 레슨" 히어로 카드. 트랙을 모두 끝냈으면 복습으로 안내한다 */
export function NextLessonCard({ path, me }: { path: PathResponse; me: MeResponse }) {
  const start = useStartLesson();
  const { today, user } = me;
  const goalPct = Math.min(100, Math.round((today.lessonsCompleted / user.dailyGoal) * 100));

  const found = path.units.flatMap((unit) => unit.lessons.map((lesson) => ({ unit, lesson }))).find((x) => x.lesson.id === path.nextLessonId);
  if (path.nextLessonId !== null && !found) return null;

  return (
    <section aria-label="다음 레슨" className="card rounded-hero p-5">
      {found ? (
        <>
          <p className="font-mono text-cap font-medium text-ink-2">
            유닛 {found.unit.sortOrder} {found.unit.name}
          </p>
          <h2 className="mt-1 text-h3 font-semibold">{found.lesson.name}</h2>
          <p className="mt-1 font-mono text-cap text-ink-2">{found.lesson.questionCount}문제 · 약 5분</p>
        </>
      ) : (
        <>
          <p className="font-mono text-cap font-medium text-ink-2">{path.track.name}</p>
          <h2 className="mt-1 text-h3 font-semibold">이 트랙을 모두 끝냈어요</h2>
        </>
      )}

      <div className="mt-5 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between font-mono text-cap font-medium">
            <span className="text-ink-2">오늘 목표</span>
            <span className="tabular-nums">
              {today.lessonsCompleted}/{user.dailyGoal}
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="오늘 목표"
            aria-valuenow={goalPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-brand-fill" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
        {found ? (
          <button
            type="button"
            disabled={start.isPending}
            onClick={() => start.mutate(found.lesson.id)}
            className="btn-3d h-12 min-h-12 w-[140px] shrink-0"
          >
            레슨 시작
          </button>
        ) : (
          <Link href="/review" className="btn-3d h-12 min-h-12 w-[140px] shrink-0">
            복습 시작
          </Link>
        )}
      </div>
      {start.isError && <p className="mt-3 text-cap text-wrong">{(start.error as Error).message}</p>}
    </section>
  );
}
