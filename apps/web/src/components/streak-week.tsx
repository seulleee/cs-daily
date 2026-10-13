'use client';

import clsx from 'clsx';
import type { MeResponse } from '@cs-daily/contracts';
import { WEEKDAYS, useWeekCalendar } from '@/lib/calendar';
import { CheckIcon, FlameIcon, ZapIcon } from './icons';

type DayState = 'done' | 'freeze' | 'today' | 'future' | 'missed';

const NOTE: Record<DayState, string> = { done: ' 달성', freeze: ' 프리즈 사용', today: ' 오늘, 아직 목표 전', future: '', missed: ' 쉬었어요' };

/**
 * 이번 주(월~일) 7칸. 상태 표현은 두 크기가 같다.
 *  done   = ink 채움                      freeze = 디더 채움(프리즈로 지킨 날)
 *  today  = 개미 행렬 점선 테두리, 속은 빔   future = line 색 1px 테두리, 속은 빔     missed = surface-2 채움 + line 테두리
 * 기본(보조 패널): 칸 20px·간격 6, done에 작은 check, 아래에 요일 글자(비트맵 16px).
 * `bar`(학습 홈 상태 바): 칸 12px·간격 4, check 없이 채움만, 요일 글자 없이 칸마다 title·aria-label("월요일 달성").
 * 달력 데이터가 도착하기 전에는 같은 크기의 빈 자리만 남기고(옆 요소가 밀리지 않게), 실패하면 아무것도 그리지 않는다.
 * 모양은 globals.css의 .day · .day-sm · .ants-sm · .ants-xs.
 */
export function StreakWeek({ today, bar = false, className }: { today: string; bar?: boolean; className?: string }) {
  const { dates, status, byDate } = useWeekCalendar(today);
  if (status === 'error') return null;
  if (!byDate) return <div aria-hidden className={clsx(bar ? 'h-3 w-[108px]' : 'h-10', className)} />;

  return (
    <ol aria-label="이번 주" className={clsx('flex', bar ? 'gap-1' : 'gap-1.5', className)}>
      {dates.map((date, i) => {
        const d = byDate.get(date);
        const isToday = date === today;
        const state: DayState = d?.achieved ? 'done' : d?.usedFreeze ? 'freeze' : isToday ? 'today' : date > today ? 'future' : 'missed';
        const label = `${WEEKDAYS[i]}요일${NOTE[state]}`;
        return (
          <li
            key={date}
            className={bar ? 'flex' : 'flex w-5 flex-col items-center gap-1'}
            aria-label={label}
            title={bar ? label : undefined}
            aria-current={isToday ? 'date' : undefined}
          >
            <span aria-hidden className={clsx('day', bar && 'day-sm')} data-state={state}>
              {state === 'done' && !bar && <CheckIcon size={14} strokeWidth={3} />}
              {state === 'today' &&
                (bar ? (
                  <svg aria-hidden focusable="false" className="ants-xs" viewBox="0 0 12 12">
                    <rect x="0.5" y="0.5" width="11" height="11" pathLength={44} />
                  </svg>
                ) : (
                  <svg aria-hidden focusable="false" className="ants-sm" viewBox="0 0 20 20">
                    <rect x="1" y="1" width="18" height="18" pathLength={70} />
                  </svg>
                ))}
            </span>
            {!bar && (
              <span aria-hidden className={clsx('bit leading-4!', isToday ? 'text-ink' : 'text-ink-2')}>
                {WEEKDAYS[i]}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 학습 홈 맨 위의 한 줄 상태 바(높이 36, 옛 메뉴 바). 강조는 크기가 아니라 반전으로 한다:
 * 왼쪽에 반전 배지(불꽃 + "N일째") → 8px 뒤에 이번 주 12px 7칸, 오른쪽 끝에 총 XP.
 * "오늘 학습하면 N일째" 안내는 두지 않는다(오늘 칸의 개미 행렬이 그 역할). 연속 0일이면 배지는 "0일째" 그대로.
 * 한 줄에 다 안 들어가면(320px에 세 자리 연속일 등) XP가 둘째 줄로 밀려나 overflow로 잘려 숨고 배지+칸만 남는다.
 * PC(≥1024)에서는 우측 보조 패널의 스트릭 카드가 같은 정보를 보여 주므로 숨긴다.
 */
export function StreakBar({ me, className }: { me: MeResponse; className?: string }) {
  const { stats, today } = me;
  return (
    <div role="group" aria-label="연속 학습" className={clsx('flex h-9 flex-wrap overflow-hidden border-b border-ink bg-surface', className)}>
      <div className="flex h-[35px] items-center gap-2">
        <p className="bit flex items-center gap-1 whitespace-nowrap bg-brand-fill px-2 py-0.5 text-on-brand">
          <FlameIcon size={16} className="shrink-0" />
          <span>
            <span className="sr-only">연속 학습 </span>
            {stats.currentStreak}일째
          </span>
        </p>
        <StreakWeek bar today={today.date} />
      </div>
      <p className="bit ml-auto flex h-[35px] items-center gap-1.5 whitespace-nowrap pl-2 text-ink-2">
        <ZapIcon size={16} className="shrink-0" />
        {stats.totalXp.toLocaleString()} XP
      </p>
    </div>
  );
}
