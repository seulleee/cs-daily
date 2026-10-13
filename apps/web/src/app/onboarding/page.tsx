'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PathResponse, SessionResponse, TrackSummary } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { writeLastTrack } from '@/lib/last-track';
import { writePlacementChain } from '@/lib/placement-chain';

type PathUnit = PathResponse['units'][number];
type Level = 'beginner' | 'some' | 'expert';

/** "조금 알아요"에서 연달아 테스트할 최대 유닛 수 */
const MAX_CHAIN_UNITS = 3;

const LEVELS: readonly (readonly [Level, string, string])[] = [
  ['beginner', '처음이에요', '1유닛부터 차근차근 시작해요'],
  ['some', '조금 알아요', `짧은 테스트로 아는 유닛은 건너뛰어요 · 유닛당 8문제, 최대 ${MAX_CHAIN_UNITS}유닛`],
  ['expert', '잘 알아요', '시작할 유닛을 직접 고르고 테스트 한 번으로 확인해요'],
];

/** 첫 유닛 건너뛰기 테스트 세션을 만들고, 이어 풀 유닛 체인을 저장한다. 레슨 플레이어로 갈 세션 id를 돌려준다 */
async function startPlacement(track: string, units: { id: number; name: string }[]) {
  const first = units[0];
  if (!first) throw new Error('테스트할 유닛이 없어요');
  const session = await api<SessionResponse>(`/units/${first.id}/skip-test`, { method: 'POST' });
  writePlacementChain({ track, units, index: 0, sessionId: session.id });
  return session.id;
}

/** 온보딩 3스텝: 트랙 선택 → 데일리 목표 → 시작 지점(처음 / 배치 테스트). 배치 테스트는 3단계 */
export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const tracks = useQuery({ queryKey: ['tracks'], queryFn: () => api<TrackSummary[]>('/tracks') });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [goal, setGoal] = useState(1);
  const [level, setLevel] = useState<Level>('beginner');
  /** "잘 알아요" 유닛 선택 뷰: null이면 시작 지점 선택 화면 */
  const [pickUnits, setPickUnits] = useState<PathUnit[] | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);

  // 시작 지점 기준은 첫 번째로 고른 트랙
  const firstTrack = tracks.data?.find((t) => t.id === selected[0]);

  const begin = useMutation({
    mutationFn: async (): Promise<{ to: string } | { units: PathUnit[] }> => {
      await api('/me/tracks', { method: 'PUT', json: { trackIds: selected } });
      await api('/me', { method: 'PATCH', json: { dailyGoal: goal, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (firstTrack) writeLastTrack(firstTrack.slug);
      if (!firstTrack || level === 'beginner') return { to: '/learn' };

      const path = await api<PathResponse>(`/me/path?track=${encodeURIComponent(firstTrack.slug)}`);
      if (path.units.length === 0) return { to: '/learn' };
      if (level === 'expert') return { units: path.units };
      const units = path.units.slice(0, MAX_CHAIN_UNITS).map((u) => ({ id: u.id, name: u.name }));
      return { to: `/lesson/${await startPlacement(firstTrack.slug, units)}` };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['me'] });
      if ('units' in r) setPickUnits(r.units);
      else router.replace(r.to);
    },
  });

  const startPicked = useMutation({
    mutationFn: (v: { track: string; unit: { id: number; name: string } }) => startPlacement(v.track, [v.unit]),
    onSuccess: (sessionId) => router.replace(`/lesson/${sessionId}`),
  });

  const pickedUnit = pickUnits?.find((u) => u.id === pickedId);
  const error = (begin.isError ? begin.error : startPicked.isError ? startPicked.error : null) as ApiError | null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center p-6">
      <div className="mb-6 flex gap-2" aria-label={`${step}/3 단계`}>
        {[1, 2, 3].map((s) => <div key={s} className="h-2 flex-1 rounded-full" style={{ background: s <= step ? 'var(--color-brand)' : 'var(--color-line)' }} />)}
      </div>

      {step === 1 && (
        <>
          <h1 className="text-2xl font-black">무엇을 공부할까요?</h1>
          <p className="mt-1 text-(--color-ink-2)">여러 개 골라도 됩니다. 나중에 설정에서 바꿀 수 있어요.</p>
          <div className="mt-6 space-y-3">
            {tracks.data?.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button key={t.id} type="button" data-selected={on} onClick={() => setSelected(on ? selected.filter((id) => id !== t.id) : [...selected, t.id])} className="option">
                  <div className="font-bold">{t.name}</div>
                  <div className="text-sm text-(--color-ink-2)">{t.description}</div>
                  <div className="mt-1 text-xs text-(--color-ink-2)">{t.unitCount}유닛 · {t.lessonCount}레슨</div>
                </button>
              );
            })}
          </div>
          <button type="button" disabled={selected.length === 0} onClick={() => setStep(2)} className="btn-3d mt-8 w-full">다음</button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-2xl font-black">하루에 얼마나 할까요?</h1>
          <p className="mt-1 text-(--color-ink-2)">목표를 채운 날이 이어지면 스트릭이 쌓입니다. 한 레슨은 약 5분이에요.</p>
          <div className="mt-6 space-y-3">
            {[
              [1, '가볍게', '하루 1레슨 · 5분'],
              [2, '꾸준히', '하루 2레슨 · 10분'],
              [3, '진지하게', '하루 3레슨 · 15분'],
            ].map(([n, title, desc]) => (
              <button key={n} type="button" data-selected={goal === n} onClick={() => setGoal(n as number)} className="option">
                <div className="font-bold">{title}</div>
                <div className="text-sm text-(--color-ink-2)">{desc}</div>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep(3)} className="btn-3d mt-8 w-full">다음</button>
          <button type="button" onClick={() => setStep(1)} className="mt-3 text-sm text-(--color-ink-2) underline">이전</button>
        </>
      )}

      {step === 3 && !pickUnits && (
        <>
          <h1 className="text-2xl font-black">얼마나 알고 있나요?</h1>
          <p className="mt-1 text-(--color-ink-2)">첫 번째로 고른 트랙 기준이에요. 다른 트랙은 학습 경로에서 유닛별로 건너뛸 수 있어요.</p>
          <div className="mt-6 space-y-3">
            {LEVELS.map(([value, title, desc]) => (
              <button key={value} type="button" data-selected={level === value} onClick={() => setLevel(value)} className="option">
                <div className="font-bold">{title}</div>
                <div className="text-sm text-(--color-ink-2)">{desc}</div>
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-(--color-wrong)">{error.message}</p>}
          <button type="button" disabled={begin.isPending} onClick={() => begin.mutate()} className="btn-3d mt-8 w-full">시작하기</button>
          <button type="button" onClick={() => { begin.reset(); setStep(2); }} className="mt-3 text-sm text-(--color-ink-2) underline">이전</button>
        </>
      )}

      {step === 3 && pickUnits && (
        <>
          <h1 className="text-2xl font-black">어느 유닛부터 시작할까요?</h1>
          <p className="mt-1 text-(--color-ink-2)">고른 유닛의 테스트를 통과하면 그 유닛까지 건너뛰어요.</p>
          <div className="mt-6 space-y-3">
            {pickUnits.map((u) => (
              <button key={u.id} type="button" data-selected={pickedId === u.id} onClick={() => setPickedId(u.id)} className="option">
                <div className="font-bold">유닛 {u.sortOrder} · {u.name}</div>
                <div className="mt-1 text-xs text-(--color-ink-2)">레슨 {u.lessons.length}개</div>
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-(--color-wrong)">{error.message}</p>}
          <button
            type="button"
            disabled={!firstTrack || !pickedUnit || startPicked.isPending}
            onClick={() => firstTrack && pickedUnit && startPicked.mutate({ track: firstTrack.slug, unit: { id: pickedUnit.id, name: pickedUnit.name } })}
            className="btn-3d mt-8 w-full"
          >
            테스트 시작
          </button>
          <button type="button" onClick={() => { startPicked.reset(); setPickUnits(null); setPickedId(null); }} className="mt-3 text-sm text-(--color-ink-2) underline">이전</button>
        </>
      )}
    </div>
  );
}
