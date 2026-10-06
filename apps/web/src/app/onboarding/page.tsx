'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TrackSummary } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';

/** 온보딩 2스텝: 트랙 선택 → 데일리 목표. 배치 테스트는 2단계 */
export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const tracks = useQuery({ queryKey: ['tracks'], queryFn: () => api<TrackSummary[]>('/tracks') });
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [goal, setGoal] = useState(1);

  const finish = useMutation({
    mutationFn: async () => {
      await api('/me/tracks', { method: 'PUT', json: { trackIds: selected } });
      await api('/me', { method: 'PATCH', json: { dailyGoal: goal, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      router.replace('/learn');
    },
  });

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center p-6">
      <div className="mb-6 flex gap-2" aria-label={`${step}/2 단계`}>
        {[1, 2].map((s) => <div key={s} className="h-2 flex-1 rounded-full" style={{ background: s <= step ? 'var(--color-brand)' : 'var(--color-line)' }} />)}
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
          {finish.isError && <p className="mt-3 text-sm text-(--color-wrong)">{(finish.error as ApiError).message}</p>}
          <button type="button" disabled={finish.isPending} onClick={() => finish.mutate()} className="btn-3d mt-8 w-full">시작하기</button>
          <button type="button" onClick={() => setStep(1)} className="mt-3 text-sm text-(--color-ink-2) underline">이전</button>
        </>
      )}
    </div>
  );
}
