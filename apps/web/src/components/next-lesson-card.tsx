'use client';

import type { MeResponse, PathResponse } from '@cs-daily/contracts';
import Link from 'next/link';
import { useStartLesson } from './learning-path';
import { Window } from './window';

/** 학습 홈 맨 위의 "다음 레슨" 히어로 카드. 트랙을 모두 끝냈으면 복습으로 안내한다 */
export function NextLessonCard({ path, me }: { path: PathResponse; me: MeResponse }) {
  const start = useStartLesson();
  const { today, user } = me;
  const goalPct = Math.min(100, Math.round((today.lessonsCompleted / user.dailyGoal) * 100));

  const found = path.units.flatMap((unit) => unit.lessons.map((lesson) => ({ unit, lesson }))).find((x) => x.lesson.id === path.nextLessonId);
  if (path.nextLessonId !== null && !found) return null;

  return (
    <Window title="다음 레슨" bodyClassName="p-5">
      {found ? (
        <>
          <p className="bit text-ink-2">
            유닛 {found.unit.sortOrder} {found.unit.name}
          </p>
          <h2 className="bit-2 mt-1">{found.lesson.name}</h2>
          <p className="bit mt-1 text-ink-2">{found.lesson.questionCount}문제 · 약 5분</p>
        </>
      ) : (
        <>
          <p className="bit text-ink-2">{path.track.name}</p>
          <h2 className="bit-2 mt-1">이 트랙을 모두 끝냈어요</h2>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-4">
        <div className="min-w-[150px] flex-1">
          <div className="bit flex items-baseline justify-between">
            <span className="text-ink-2">오늘 목표</span>
            <span>
              {today.lessonsCompleted}/{user.dailyGoal}
            </span>
          </div>
          <div className="meter mt-1.5" role="progressbar" aria-label="오늘 목표" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${goalPct}%` }} />
          </div>
        </div>
        {found ? (
          <button
            type="button"
            disabled={start.isPending}
            onClick={() => start.mutate(found.lesson.id)}
            className="btn-3d h-12 min-h-12 w-full shrink-0 min-[360px]:w-[140px]"
          >
            레슨 시작
          </button>
        ) : (
          <Link href="/review" className="btn-3d h-12 min-h-12 w-full shrink-0 min-[360px]:w-[140px]">
            복습 시작
          </Link>
        )}
      </div>
      {start.isError && <p className="mt-3 text-cap text-wrong">{(start.error as Error).message}</p>}
    </Window>
  );
}
