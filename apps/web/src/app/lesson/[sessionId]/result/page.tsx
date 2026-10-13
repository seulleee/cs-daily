'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import type { CompleteSessionResponse, SessionResponse } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { clearPlacementChain, nextPlacementStep, readPlacementChain, writePlacementChain } from '@/lib/placement-chain';
import { CheckIcon, FlameIcon } from '@/components/icons';

/** 레슨 완료 화면. 결과는 complete 응답을 QueryClient에 넣어 둔 것을 읽는다 (새로고침 시 홈으로) */
export default function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const qc = useQueryClient();
  const r = qc.getQueryData<CompleteSessionResponse>(['session-result', sessionId]);

  if (!r) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-ink-2">결과가 만료되었습니다.</p>
        <Link href="/learn" className="btn-3d">홈으로</Link>
      </div>
    );
  }

  const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
  // 응답에 없는 값이라 레슨 플레이어가 complete 직전에 따로 캐시에 둔다
  const retried = qc.getQueryData<number>(['session-retried', sessionId]) ?? 0;

  if (r.placement) return <PlacementResult sessionId={sessionId} r={r} placement={r.placement} pct={pct} />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-[420px] space-y-6 text-center">
        <ScoreRing pct={pct} />
        <h1 className="text-h3 font-semibold">{pct === 100 ? '완벽해요!' : pct >= 70 ? '레슨 완료!' : '조금 더 연습해요'}</h1>
        <p className="font-mono text-h2 font-semibold tabular-nums text-xp">+{r.xpEarned} XP</p>

        <div className="grid grid-cols-3 gap-2">
          <Tile label="스트릭">
            <span className="flex items-center justify-center gap-1 text-streak">
              <FlameIcon size={18} />
              {r.streak.current}일
            </span>
          </Tile>
          <Tile label="오늘 목표">
            <span className="flex items-center justify-center gap-1">
              {r.dailyGoal.achieved && (
                <>
                  <CheckIcon size={18} strokeWidth={3} className="text-correct" />
                  <span className="sr-only">달성</span>
                </>
              )}
              {r.dailyGoal.done}/{r.dailyGoal.target}
            </span>
          </Tile>
          <Tile label="다시 푼 문제">{retried}</Tile>
        </div>

        {r.streak.extended && <p className="text-cap font-medium text-streak">스트릭이 {r.streak.current}일로 늘었어요!</p>}
        <p className="font-mono text-cap text-ink-2">내일 복습 예정 {r.newReviewCount}문제</p>

        <div className="flex flex-col gap-3">
          <Link href="/learn" className="btn-3d">계속하기</Link>
          {r.newReviewCount > 0 && <Link href="/review" className="btn-outline">복습 보기</Link>}
        </div>
      </div>
    </div>
  );
}

/** 정답률 링: 160px 원 안쪽에 136px ground 원을 얹어 두께 12px의 링을 만든다 */
function ScoreRing({ pct, tone = 'correct' }: { pct: number; tone?: 'correct' | 'ink' }) {
  const fill = tone === 'correct' ? 'var(--color-correct-fill)' : 'var(--color-ink)';
  return (
    <div
      role="img"
      aria-label={`정답률 ${pct}%`}
      className="mx-auto flex h-40 w-40 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${fill} ${pct}%, var(--color-line) 0)` }}
    >
      <div className="flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full bg-surface-2">
        <span className="font-mono text-hero font-semibold tabular-nums">{pct}%</span>
        <span className="text-cap text-ink-2">정답률</span>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card px-2 py-3">
      <div className="text-cap text-ink-2">{label}</div>
      <div className="mt-1 font-mono text-title font-semibold tabular-nums">{children}</div>
    </div>
  );
}

/**
 * 건너뛰기 테스트 결과. 온보딩에서 시작한 연속 테스트(체인)의 세션이면 다음 유닛 테스트를 이어 주고,
 * 아니면 기존 화면 그대로. 체인은 마운트 때 한 번만 읽는다 (다음 세션 id로 덮어써도 이 화면이 깜빡이지 않게).
 */
function PlacementResult({ sessionId, r, placement: p, pct }: { sessionId: string; r: CompleteSessionResponse; placement: NonNullable<CompleteSessionResponse['placement']>; pct: number }) {
  const router = useRouter();
  const [stored] = useState(readPlacementChain);
  const chain = stored?.sessionId === sessionId ? stored : null;
  const step = chain ? nextPlacementStep(chain, p.passed) : null;

  const nextTest = useMutation({
    mutationFn: async (next: { unit: { id: number }; index: number }) => {
      const session = await api<SessionResponse>(`/units/${next.unit.id}/skip-test`, { method: 'POST' });
      if (chain) writePlacementChain({ ...chain, index: next.index, sessionId: session.id });
      return session.id;
    },
    onSuccess: (id) => router.push(`/lesson/${id}`),
  });

  if (chain && step) {
    const score = (
      <p className="font-mono text-cap text-ink-2">
        {r.total}문제 중 {r.correct}개 정답 ({pct}%) · 통과 기준 {p.passPercent}%
      </p>
    );
    const toLearn = `/learn?track=${chain.track}`;
    const startLearning = (label: string, primary: boolean) => (
      <Link href={toLearn} onClick={clearPlacementChain} className={primary ? 'btn-3d w-full' : 'min-h-11 text-body text-ink-2 underline underline-offset-4'}>{label}</Link>
    );

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6">
        <div className="w-full max-w-[420px] space-y-6 text-center">
          <ScoreRing pct={pct} tone={p.passed ? 'correct' : 'ink'} />
          <h1 className={`text-h3 font-semibold ${p.passed ? 'text-correct' : ''}`}>{p.passed ? '유닛 통과!' : '여기서 시작하면 딱 좋아요'}</h1>
          {score}
          <p className="card p-4 text-body">
            {!p.passed
              ? chain.mode === 'pick'
                ? '트랙 처음부터 차근차근 시작해요.'
                : `${p.unitName}부터 차근차근 배워요.`
              : step.kind === 'next'
                ? `${p.unitName} 테스트를 통과했어요. 다음 유닛도 볼까요? (${step.index + 1}/${chain.units.length})`
                : `${p.unitName}까지 건너뛰었어요. 다음 유닛부터 시작해요.`}
          </p>
          {nextTest.isError && <p className="text-cap text-wrong">{(nextTest.error as ApiError).message}</p>}
          {step.kind === 'next' ? (
            <div className="flex flex-col items-center gap-3">
              <button type="button" disabled={nextTest.isPending} onClick={() => nextTest.mutate(step)} className="btn-3d w-full">다음 유닛 테스트</button>
              {startLearning('여기서부터 시작', false)}
            </div>
          ) : (
            startLearning('학습 시작', true)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-[420px] space-y-6 text-center">
        <ScoreRing pct={pct} tone={p.passed ? 'correct' : 'ink'} />
        <h1 className={`text-h3 font-semibold ${p.passed ? 'text-correct' : ''}`}>{p.passed ? `${p.unitName} 건너뛰기 성공!` : '조금만 더 배워 봐요'}</h1>
        <p className="font-mono text-cap text-ink-2">
          {r.total}문제 중 {r.correct}개 정답 ({pct}%) · 통과 기준 {p.passPercent}%
        </p>
        <p className="card p-4 text-body">
          {p.passed
            ? p.skippedLessons > 0
              ? `레슨 ${p.skippedLessons}개를 완료로 처리했어요. 다음 유닛부터 이어서 풀 수 있어요.`
              : '이미 모두 완료한 레슨이라 바뀐 것은 없어요.'
            : '틀린 문제는 복습 목록에 추가했어요. 레슨부터 차근차근 풀거나 나중에 다시 도전해 보세요.'}
        </p>
        <Link href="/learn" className="btn-3d w-full">{p.passed ? '다음 유닛으로' : '학습으로 돌아가기'}</Link>
      </div>
    </div>
  );
}
