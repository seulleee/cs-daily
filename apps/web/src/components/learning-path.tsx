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
 * 선은 crispEdges로 그려 안티앨리어싱 없이 픽셀 단위로 또렷하게 보이게 한다(45° 구간은 계단처럼 보인다).
 */
const PAD = 56;
const GAP = 36;
const STUB = 28;
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
 * 배선은 세 가지다(정보 위계): 현재 패드로 들어오는 구간은 ink 2px 실선(on), 이미 지나온 구간은 ink 2px 점선 4 3(done),
 * 앞으로 올 구간은 line 색 1px 실선(off).
 */
type WireTone = 'on' | 'done' | 'off';
const WIRE: Record<WireTone, { stroke: string; width: number; dash?: string }> = {
  on: { stroke: 'var(--color-ink)', width: 2 },
  done: { stroke: 'var(--color-ink)', width: 2, dash: '4 3' },
  off: { stroke: 'var(--color-line)', width: 1 },
};

/** 앞 패드가 완료여야 신호가 들어온다. 뒤 패드가 현재 레슨이면 실선 */
const wireTone = (fromCompleted: boolean, intoCurrent: boolean): WireTone => (!fromCompleted ? 'off' : intoCurrent ? 'on' : 'done');

function WirePath({ d, tone }: { d: string; tone: WireTone }) {
  const w = WIRE[tone];
  return <path d={d} fill="none" style={{ stroke: w.stroke }} strokeWidth={w.width} strokeDasharray={w.dash} shapeRendering="crispEdges" />;
}

/** 패드 사이 배선 */
function Wire({ from, to, tone }: { from: number; to: number; tone: WireTone }) {
  return (
    <svg aria-hidden focusable="false" width="100%" height={GAP} className="block overflow-visible">
      {/* 중첩 svg의 x=50%가 컨테이너 가운데를 원점으로 만든다 */}
      <svg x="50%" y="0" overflow="visible">
        <WirePath d={wirePath(from, to)} tone={tone} />
      </svg>
    </svg>
  );
}

/** 유닛 헤더 아래에서 첫 패드로 내려가는 직선 */
function Stub({ tone }: { tone: WireTone }) {
  return (
    <svg aria-hidden focusable="false" width="100%" height={STUB} className="block overflow-visible">
      <svg x="50%" y="0" overflow="visible">
        <WirePath d={`M 0 0 V ${STUB}`} tone={tone} />
      </svg>
    </svg>
  );
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

            <div className="flex items-center gap-3 border-b border-ink bg-surface-2 pb-3 pt-3">
              <span aria-hidden className={clsx('bit-2 shrink-0', isCurrentUnit ? 'text-ink' : 'text-ink-2')}>
                {String(unit.sortOrder).padStart(2, '0')}
              </span>
              <h2 id={`unit-${unit.id}`} className={clsx('min-w-0 flex-1 text-title font-semibold', isCurrentUnit ? 'text-ink' : 'text-ink-2')}>
                <span className="sr-only">유닛 {unit.sortOrder} </span>
                {unit.name}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <span className="bit text-ink-2">
                  {doneCount}/{unit.lessons.length}
                </span>
                {doneCount < unit.lessons.length && (
                  <button
                    type="button"
                    disabled={skip.isPending}
                    onClick={() => skip.mutate(unit.id)}
                    title="유닛 문제 몇 개를 풀어 80% 이상 맞히면 이 유닛까지 완료로 처리됩니다"
                    className="bit min-h-11 px-1 text-brand underline underline-offset-4 disabled:opacity-50"
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
                        {completed ? (
                          <span className="pad-plate">
                            <CheckIcon size={20} strokeWidth={3} />
                          </span>
                        ) : locked ? (
                          <LockIcon size={24} />
                        ) : isCurrent ? (
                          <PlayIcon size={24} solid />
                        ) : (
                          <StarIcon size={24} solid />
                        )}
                        {/* 현재 패드 바깥 3px에서 도는 개미 행렬. pathLength=252(= 7 × 36)로 점선 주기가 둘레에 딱 맞게 한다 */}
                        {isCurrent && (
                          <svg aria-hidden focusable="false" className="ants" viewBox="0 0 66 66">
                            <rect x="1" y="1" width="64" height="64" pathLength={252} />
                          </svg>
                        )}
                      </button>
                      {/* 레슨 이름은 경로 안쪽(여유가 큰 쪽)에: 패드가 오른쪽으로 치우치면 왼쪽, 아니면 오른쪽. 비트맵 16px 글자는 폭을 많이 쓰므로 좁은 바깥쪽(95px)을 피한다 */}
                      <div
                        aria-hidden
                        onClick={begin}
                        className={clsx(
                          'bit absolute top-1/2 -translate-y-1/2',
                          off > 0 && 'text-right',
                          // 현재·열림 = ink, 완료·잠김 = ink-2 (잠김에 opacity .7을 주면 ground 위 대비가 2.96:1이라 4.5:1을 못 넘는다. 잠김은 패드 윤곽과 자물쇠가 말해 준다)
                          isCurrent ? 'text-ink' : completed || locked ? 'text-ink-2' : 'text-ink',
                          !locked && 'cursor-pointer',
                        )}
                        style={off > 0 ? { left: 0, right: `calc(50% - ${off}px + ${PAD / 2 + 12}px)` } : { right: 0, left: `calc(50% + ${off}px + ${PAD / 2 + 12}px)` }}
                      >
                        {lesson.name}
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
