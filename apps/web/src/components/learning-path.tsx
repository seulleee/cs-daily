'use client';

import type { PathResponse } from '@cs-daily/contracts';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SessionResponse } from '@cs-daily/contracts';

/** 듀오링고식 세로 경로: 유닛 헤더 아래 레슨 노드가 지그재그로 이어진다 */
export function LearningPath({ path }: { path: PathResponse }) {
  const router = useRouter();
  const start = useMutation({
    mutationFn: (lessonId: number) => api<SessionResponse>(`/lessons/${lessonId}/sessions`, { method: 'POST' }),
    onSuccess: (s) => router.push(`/lesson/${s.id}`),
  });

  return (
    <div className="space-y-10">
      {path.units.map((unit) => (
        <section key={unit.id} aria-labelledby={`unit-${unit.id}`}>
          <div className="card mb-6 flex items-center justify-between bg-(--color-brand) p-4 text-white">
            <div>
              <div className="text-xs font-semibold opacity-80">유닛 {unit.sortOrder}</div>
              <h2 id={`unit-${unit.id}`} className="text-lg font-black">
                {unit.name}
              </h2>
            </div>
            <div className="text-sm opacity-80">{unit.lessons.filter((l) => l.status === 'completed').length}/{unit.lessons.length}</div>
          </div>

          <ol className="flex flex-col items-center gap-5">
            {unit.lessons.map((lesson, i) => {
              const offset = [0, 40, 60, 40, 0, -40, -60, -40][i % 8] ?? 0;
              const isNext = lesson.id === path.nextLessonId;
              const disabled = lesson.status === 'locked' || start.isPending;
              return (
                <li key={lesson.id} style={{ transform: `translateX(${offset}px)` }} className="flex flex-col items-center">
                  {isNext && (
                    <div className="mb-1 animate-bounce rounded-full bg-(--color-surface) px-3 py-1 text-xs font-bold text-(--color-brand) shadow" aria-hidden>
                      시작
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => start.mutate(lesson.id)}
                    aria-label={`${lesson.name} — ${lesson.status === 'locked' ? '잠김' : lesson.status === 'completed' ? `완료, 최고 ${lesson.bestScore}점` : '시작 가능'}`}
                    className={clsx(
                      'flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-[0_6px_0_rgba(0,0,0,.15)] transition-transform active:translate-y-1 active:shadow-none disabled:cursor-not-allowed',
                      lesson.status === 'completed' && 'bg-(--color-correct) text-white',
                      lesson.status === 'available' && 'bg-(--color-brand) text-white',
                      lesson.status === 'locked' && 'bg-(--color-line) text-(--color-ink-2) shadow-none',
                      isNext && 'ring-4 ring-(--color-brand)/30',
                    )}
                  >
                    {lesson.status === 'completed' ? '✓' : lesson.status === 'locked' ? '🔒' : '★'}
                  </button>
                  <div className="mt-2 max-w-40 text-center text-xs font-semibold text-(--color-ink-2)">{lesson.name}</div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {start.isError && <p className="text-center text-sm text-(--color-wrong)">{(start.error as Error).message}</p>}
    </div>
  );
}
