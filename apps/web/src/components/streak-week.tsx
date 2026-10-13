'use client';

import clsx from 'clsx';
import type { MeResponse } from '@cs-daily/contracts';
import { WEEKDAYS, useWeekCalendar } from '@/lib/calendar';
import { CheckIcon, FlameIcon, ZapIcon } from './icons';
import { Window } from './window';

type DayState = 'done' | 'freeze' | 'today' | 'future' | 'missed';

/**
 * 이번 주(월~일) 7칸. 칸 20px, 1px 테두리, 칸 사이 6px, 아래에 요일 글자(비트맵 16px).
 *  done   = ink 채움 + 작은 check          freeze = 디더 채움(프리즈로 지킨 날)
 *  today  = 개미 행렬 점선 테두리, 속은 빔 (오늘, 아직 목표 전)
 *  future = line 색 1px 테두리, 속은 빔     missed = surface-2 채움 + line 테두리
 * 달력 데이터가 도착하기 전에는 같은 높이의 빈 자리만 남기고(위 요소가 밀리지 않게), 실패하면 아무것도 그리지 않는다.
 * 모양은 globals.css의 .day · .ants-sm.
 */
export function StreakWeek({ today, className }: { today: string; className?: string }) {
  const { dates, status, byDate } = useWeekCalendar(today);
  if (status === 'error') return null;
  if (!byDate) return <div aria-hidden className={clsx('h-10', className)} />;

  return (
    <ol aria-label="이번 주" className={clsx('flex gap-1.5', className)}>
      {dates.map((date, i) => {
        const d = byDate.get(date);
        const isToday = date === today;
        const state: DayState = d?.achieved ? 'done' : d?.usedFreeze ? 'freeze' : isToday ? 'today' : date > today ? 'future' : 'missed';
        const note = { done: ', 목표 달성', freeze: ', 프리즈 사용', today: ', 오늘 아직 목표 전', future: '', missed: ', 쉬었어요' }[state];
        return (
          <li key={date} className="flex w-5 flex-col items-center gap-1" aria-label={`${WEEKDAYS[i]}요일${isToday && state !== 'today' ? ' (오늘)' : ''}${note}`} aria-current={isToday ? 'date' : undefined}>
            <span aria-hidden className="day" data-state={state}>
              {state === 'done' && <CheckIcon size={14} strokeWidth={3} />}
              {state === 'today' && (
                <svg aria-hidden focusable="false" className="ants-sm" viewBox="0 0 20 20">
                  <rect x="1" y="1" width="18" height="18" pathLength={70} />
                </svg>
              )}
            </span>
            <span aria-hidden className={clsx('bit leading-4!', isToday ? 'text-ink' : 'text-ink-2')}>
              {WEEKDAYS[i]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 학습 홈 맨 위의 "연속 학습" 창. 연속일을 크게(48px), 총 XP를 오른쪽 위에, 이번 주 7칸을 아래에 둔다.
 * 안내 문구는 오른쪽 아래(숫자 밑줄 높이)에 한 줄 — 창이 세 줄로 길어져 "다음 레슨"이 첫 화면 밖으로 밀리는 것을 막는다.
 * PC(≥1024)에서는 우측 보조 패널의 스트릭 카드가 같은 정보를 보여 주므로 숨긴다.
 */
export function StreakWindow({ me, className }: { me: MeResponse; className?: string }) {
  const { stats, today } = me;
  const streak = stats.currentStreak;
  const caption = today.goalAchieved ? '오늘도 지켰어요' : streak === 0 ? '오늘부터 시작해요' : `오늘 학습하면 ${streak + 1}일째`;
  return (
    <Window title="연속 학습" className={className}>
      <div className="flex items-stretch justify-between gap-x-3">
        <div className="flex shrink-0 items-end gap-2 whitespace-nowrap text-streak">
          <FlameIcon size={32} className="mb-2 shrink-0" />
          <span className="bit-3 leading-12!">{streak}</span>
          <span className="bit text-ink">일째</span>
        </div>
        <div className="flex min-w-0 flex-col items-end justify-between text-right">
          <p className="bit flex items-center gap-1.5 whitespace-nowrap text-ink" aria-label={`총 ${stats.totalXp} XP`}>
            <ZapIcon size={16} />
            {stats.totalXp.toLocaleString()} XP
          </p>
          <p className="text-cap text-ink-2">{caption}</p>
        </div>
      </div>
      <StreakWeek today={today.date} className="mt-2" />
    </Window>
  );
}
