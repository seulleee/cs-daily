'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { use } from 'react';
import type { CompleteSessionResponse } from '@cs-daily/contracts';

/** 레슨 완료 화면. 결과는 complete 응답을 QueryClient에 넣어 둔 것을 읽는다 (새로고침 시 홈으로) */
export default function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const qc = useQueryClient();
  const r = qc.getQueryData<CompleteSessionResponse>(['session-result', sessionId]);

  if (!r) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-(--color-ink-2)">결과가 만료되었습니다.</p>
        <Link href="/learn" className="btn-3d">홈으로</Link>
      </div>
    );
  }

  const pct = Math.round((r.correct / r.total) * 100);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-6xl" aria-hidden>{pct === 100 ? '🏆' : pct >= 70 ? '🎉' : '💪'}</div>
        <h1 className="text-2xl font-black">{pct === 100 ? '완벽해요!' : pct >= 70 ? '레슨 완료!' : '조금 더 연습해요'}</h1>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="획득 XP" value={`+${r.xpEarned}`} color="var(--color-brand)" />
          <Stat label="정답률" value={`${pct}%`} color="var(--color-correct)" />
          <Stat label="스트릭" value={`🔥 ${r.streak.current}`} color="var(--color-streak)" />
        </div>

        {r.streak.extended && <p className="rounded-2xl bg-(--color-streak)/10 p-3 text-sm font-bold text-(--color-streak)">스트릭이 {r.streak.current}일로 늘었어요!</p>}
        <p className="text-sm text-(--color-ink-2)">
          오늘 목표 {r.dailyGoal.done}/{r.dailyGoal.target} {r.dailyGoal.achieved ? '달성 ✓' : ''} · 내일 복습 예정 {r.newReviewCount}문제
        </p>

        <div className="flex flex-col gap-3">
          <Link href="/learn" className="btn-3d">계속하기</Link>
          {r.newReviewCount > 0 && <Link href="/review" className="rounded-2xl border-2 px-5 py-3 font-bold" style={{ borderColor: 'var(--color-line)' }}>복습 보기</Link>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs font-semibold text-(--color-ink-2)">{label}</div>
      <div className="mt-1 text-xl font-black" style={{ color }}>{value}</div>
    </div>
  );
}
