'use client';

import type { PathResponse, SessionResponse } from '@cs-daily/contracts';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CheckIcon, LockIcon, PlayIcon, StarIcon } from './icons';

/** 레슨 세션 시작 → 레슨 플레이어로 이동. 학습 경로와 "다음 레슨" 카드가 함께 쓴다 */
export function useStartLesson() {
  const router = useRouter();
  return useMutation({
    mutationFn: (lessonId: number) => api<SessionResponse>(`/lessons/${lessonId}/sessions`, { method: 'POST' }),
    onSuccess: (s) => router.push(`/lesson/${s.id}`),
  });
}

/* ---------- 배선 기하 ----------
 * 패드 56px, 패드 사이 36px. 패드 중심은 컨테이너 가운데(x=0)를 기준으로 좌우로 어긋난다.
 * 배선은 패드 아래 가장자리 중앙에서 다음 패드 위 가장자리 중앙까지, 세로 → 45° → 가로 → 45° → 세로로 꺾는다(회로 기판의 트레이스).
 */
const PAD = 56;
const GAP = 36;
const WIRE_WIDTH = 4;
const OFFSETS = [0, 44, 0, -44] as const;
/** 45° 꺾임의 한 변 */
const CHAMFER = 8;

const offsetOf = (i: number) => OFFSETS[i % OFFSETS.length] ?? 0;

/** x1에서 x2로 가는 36px 높이의 배선 경로 */
function wirePath(x1: number, x2: number): string {
  if (x1 === x2) return `M ${x1} 0 V ${GAP}`;
  const s = Math.sign(x2 - x1);
  const d = Math.min(CHAMFER, Math.abs(x2 - x1) / 2);
  const a = GAP / 2 - d; // 위쪽 세로 구간
  return `M ${x1} 0 V ${a} L ${x1 + s * d} ${a + d} H ${x2 - s * d} L ${x2} ${a + 2 * d} V ${GAP}`;
}

/**
 * 배선의 밝기는 세 단계다(정보 위계): 현재 패드로 들어오는 구간만 가장 밝게(on), 이미 지나온 구간은 켜져 있되 어둡게(done),
 * 앞으로 올 구간은 꺼 둔다(off). done 색은 globals.css의 --wire-done.
 */
type WireTone = 'on' | 'done' | 'off';
const WIRE_COLOR: Record<WireTone, string> = { on: 'var(--color-brand)', done: 'var(--wire-done)', off: 'var(--color-line)' };

/** 앞 패드가 완료여야 신호가 들어온다. 뒤 패드가 현재 레슨이면 가장 밝게 */
const wireTone = (fromCompleted: boolean, intoCurrent: boolean): WireTone => (!fromCompleted ? 'off' : intoCurrent ? 'on' : 'done');

/** 패드 사이 배선 */
function Wire({ from, to, tone }: { from: number; to: number; tone: WireTone }) {
  return (
    <svg aria-hidden focusable="false" width="100%" height={GAP} className="block overflow-visible">
      {/* 중첩 svg의 x=50%가 컨테이너 가운데를 원점으로 만든다 */}
      <svg x="50%" y="0" overflow="visible">
        <path d={wirePath(from, to)} fill="none" style={{ stroke: WIRE_COLOR[tone] }} strokeWidth={WIRE_WIDTH} strokeLinejoin="round" />
      </svg>
    </svg>
  );
}

/** 유닛 헤더 아래에서 첫 패드로 내려가는 직선 */
function Stub({ tone }: { tone: WireTone }) {
  return <div aria-hidden className="mx-auto h-7 rounded-full" style={{ width: WIRE_WIDTH, background: WIRE_COLOR[tone] }} />;
}

type Unit = PathResponse['units'][number];

export function LearningPath({ path }: { path: PathResponse }) {
  const start = useStartLesson();
  const router = useRouter();
  const skip = useMutation({
    mutationFn: (unitId: number) => api<SessionResponse>(`/units/${unitId}/skip-test`, { method: 'POST' }),
    onSuccess: (s) => router.push(`/lesson/${s.id}`),
  });

  return (
    // 600px 이상에서는 경로 폭을 420px로 고정해 가운데에 둔다
    <div className="mx-auto w-full min-[600px]:max-w-[420px]">
      {path.units.map((unit, ui) => {
        const prev: Unit | undefined = path.units[ui - 1];
        const prevLast = prev?.lessons[prev.lessons.length - 1];
        const prevLit = prevLast?.status === 'completed';
        const doneCount = unit.lessons.filter((l) => l.status === 'completed').length;
        // 현재 레슨이 속한 유닛만 번호·이름을 밝게, 나머지(완료든 미래든)는 가라앉힌다
        const isCurrentUnit = unit.lessons.some((l) => l.id === path.nextLessonId);
        // 이전 유닛 마지막 패드 → 헤더 → 이 유닛 첫 패드로 이어지는 배선
        const enter = wireTone(prevLit, unit.lessons[0]?.id === path.nextLessonId);
        return (
          <section key={unit.id} aria-labelledby={`unit-${unit.id}`}>
            {prev && prevLast && <Wire from={offsetOf(prev.lessons.length - 1)} to={0} tone={enter} />}

            <div className="flex items-center gap-3 border-b border-line bg-surface-2 pb-3 pt-3">
              <span aria-hidden className={clsx('font-mono text-[28px] font-semibold leading-none tabular-nums', isCurrentUnit ? 'text-ink' : 'text-ink-2')}>
                {String(unit.sortOrder).padStart(2, '0')}
              </span>
              <h2 id={`unit-${unit.id}`} className={clsx('min-w-0 flex-1 text-title font-semibold', isCurrentUnit ? 'text-ink' : 'text-ink-2')}>
                <span className="sr-only">유닛 {unit.sortOrder} </span>
                {unit.name}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-cap font-medium tabular-nums text-ink-2">
                  {doneCount}/{unit.lessons.length}
                </span>
                {doneCount < unit.lessons.length && (
                  <button
                    type="button"
                    disabled={skip.isPending}
                    onClick={() => skip.mutate(unit.id)}
                    title="유닛 문제 몇 개를 풀어 80% 이상 맞히면 이 유닛까지 완료로 처리됩니다"
                    className="min-h-11 px-1 text-cap font-semibold text-brand disabled:opacity-50"
                  >
                    건너뛰기
                  </button>
                )}
              </div>
            </div>

            {prev ? <Stub tone={enter} /> : <div className="h-6" />}

            <ol>
              {unit.lessons.map((lesson, i) => {
                const off = offsetOf(i);
                const isCurrent = lesson.id === path.nextLessonId;
                const locked = lesson.status === 'locked';
                const completed = lesson.status === 'completed';
                const disabled = locked || start.isPending;
                const begin = () => {
                  if (!disabled) start.mutate(lesson.id);
                };
                const isLast = i === unit.lessons.length - 1;
                return (
                  <li key={lesson.id}>
                    <div className="relative" style={{ height: PAD }}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={begin}
                        aria-label={`${lesson.name} — ${locked ? '잠김' : completed ? `완료, 최고 ${lesson.bestScore}점` : '시작 가능'}`}
                        aria-current={isCurrent ? 'step' : undefined}
                        data-state={lesson.status}
                        data-current={isCurrent}
                        className="pad absolute top-0 z-[1] -translate-x-1/2"
                        style={{ left: `calc(50% + ${off}px)` }}
                      >
                        {completed ? <CheckIcon size={28} strokeWidth={3} /> : locked ? <LockIcon size={24} /> : isCurrent ? <PlayIcon size={24} solid /> : <StarIcon size={24} solid />}
                      </button>
                      {/* 패드 오른쪽(오프셋이 음수면 왼쪽)에 레슨 이름 */}
                      <div
                        aria-hidden
                        onClick={begin}
                        className={clsx(
                          'absolute top-1/2 -translate-y-1/2 text-cap',
                          off < 0 && 'text-right',
                          // 현재 = ink 600, 열림 = ink 500, 완료 = ink-2 400, 잠김 = ink-2 400 + 흐리게
                          isCurrent ? 'font-semibold text-ink' : completed ? 'font-normal text-ink-2' : locked ? 'font-normal text-ink-2 opacity-70' : 'font-medium text-ink',
                          !locked && 'cursor-pointer',
                        )}
                        style={off < 0 ? { left: 0, right: `calc(50% - ${off}px + ${PAD / 2 + 12}px)` } : { right: 0, left: `calc(50% + ${off}px + ${PAD / 2 + 12}px)` }}
                      >
                        {lesson.name}
                        {isCurrent && <span className="term-cursor" />}
                      </div>
                    </div>
                    {!isLast && <Wire from={off} to={offsetOf(i + 1)} tone={wireTone(completed, unit.lessons[i + 1]?.id === path.nextLessonId)} />}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {start.isError && <p className="mt-6 text-center text-cap text-wrong">{(start.error as Error).message}</p>}
      {skip.isError && <p className="mt-6 text-center text-cap text-wrong">{(skip.error as Error).message}</p>}
    </div>
  );
}
