'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState, type CSSProperties } from 'react';
import type { CompleteSessionResponse, SessionResponse } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { clearPlacementChain, nextPlacementStep, readPlacementChain, writePlacementChain } from '@/lib/placement-chain';
import { CheckIcon, ExternalLinkIcon, FlameLive } from '@/components/icons';
import { Window } from '@/components/window';

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
  // 실전 문제 링크는 레슨 플레이어가 캐시에 둔 세션 응답에서 읽는다 (API가 아직 안 내려주면 없음)
  const practice = qc.getQueryData<SessionResponse>(['session', sessionId])?.lessonPractice ?? [];

  if (r.placement) return <PlacementResult sessionId={sessionId} r={r} placement={r.placement} pct={pct} />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <Window title="레슨 완료" className="w-full max-w-[420px]" bodyClassName="space-y-6 p-6 text-center">
        <ScoreRing pct={pct} />
        <h1 className="bit-2">{pct === 100 ? '완벽해요!' : pct >= 70 ? '레슨 완료!' : '조금 더 연습해요'}</h1>
        <p className="bit-2 text-xp">+{r.xpEarned} XP</p>

        <div className="grid grid-cols-3 gap-2">
          <Tile label="스트릭">
            <span className="flex items-center justify-center gap-1 text-streak">
              <FlameLive lit size={18} />
              {r.streak.current}일
            </span>
          </Tile>
          <Tile label="오늘 목표">
            <span className="flex items-center justify-center gap-1">
              {r.dailyGoal.achieved && (
                <>
                  <CheckIcon size={18} strokeWidth={3} className="text-brand" />
                  <span className="sr-only">달성</span>
                </>
              )}
              {r.dailyGoal.done}/{r.dailyGoal.target}
            </span>
          </Tile>
          <Tile label="다시 푼 문제">{retried}</Tile>
        </div>

        {r.streak.extended && <p className="text-cap font-medium text-streak">스트릭이 {r.streak.current}일로 늘었어요!</p>}
        <p className="bit text-ink-2">내일 복습 예정 {r.newReviewCount}문제</p>

        <PracticeLinks items={practice} />

        <div className="flex flex-col gap-4">
          <Link href="/learn" className="btn-3d">계속하기</Link>
          {r.newReviewCount > 0 && <Link href="/review" className="btn-outline">복습 보기</Link>}
        </div>
      </Window>
    </div>
  );
}

/**
 * 정답률 링: 160px 원(1px ink 테두리) 안쪽에 136px 원(surface, 1px ink 테두리)을 얹어 링을 만든다. 채움은 ink, 남은 부분은 ground.
 * 채움 각도는 CSS 변수 --p(@property로 등록한 숫자)이고, 마운트 때 0에서 pct까지 600ms 동안 10칸으로 차오른다. 이 화면의 유일한 진입 모션.
 * @property를 지원하지 않는 브라우저(CSS.registerProperty가 없음)에서는 클래스를 붙이지 않아 최종 값이 바로 보인다.
 */
function ScoreRing({ pct }: { pct: number }) {
  const animate = typeof CSS !== 'undefined' && 'registerProperty' in CSS;
  return (
    <div
      role="img"
      aria-label={`정답률 ${pct}%`}
      className={`score-ring mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-ink${animate ? ' score-ring-anim' : ''}`}
      style={{ '--p': pct } as CSSProperties}
    >
      <div className="flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full border border-ink bg-surface">
        <span className="bit-3">{pct}%</span>
        <span className="text-cap text-ink-2">정답률</span>
      </div>
    </div>
  );
}

/** 레슨 관련 실전 문제(백준) 링크. 번호·제목만 보여 주고 문제는 원문 사이트에서 푼다. 없으면 블록 자체를 그리지 않는다 */
function PracticeLinks({ items }: { items: NonNullable<SessionResponse['lessonPractice']> }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="practice-title" className="text-left">
      <h2 id="practice-title" className="bit">실전 문제</h2>
      <ul className="card mt-2 divide-y divide-ink">
        {items.map((p) => (
          <li key={`${p.site}-${p.id}`}>
            <a
              href={`https://www.acmicpc.net/problem/${p.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-body"
            >
              <span>
                <span className="font-semibold">백준 {p.id}</span> · {p.title}
              </span>
              <ExternalLinkIcon size={18} />
              <span className="sr-only">(새 탭에서 열림)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card px-2 py-3">
      <div className="text-cap text-ink-2">{label}</div>
      <div className="bit mt-1">{children}</div>
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
      <p className="bit text-ink-2">
        {r.total}문제 중 {r.correct}개 정답 ({pct}%) · 통과 기준 {p.passPercent}%
      </p>
    );
    const toLearn = `/learn?track=${chain.track}`;
    const startLearning = (label: string, primary: boolean) => (
      <Link href={toLearn} onClick={clearPlacementChain} className={primary ? 'btn-3d w-full' : 'min-h-11 text-body text-ink-2 underline underline-offset-4'}>{label}</Link>
    );

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6">
        <Window title="테스트 결과" className="w-full max-w-[420px]" bodyClassName="space-y-6 p-6 text-center">
          <ScoreRing pct={pct} />
          <h1 className="bit-2">{p.passed ? '유닛 통과!' : '여기서 시작하면 딱 좋아요'}</h1>
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
            <div className="flex flex-col items-center gap-4">
              <button type="button" disabled={nextTest.isPending} onClick={() => nextTest.mutate(step)} className="btn-3d w-full">다음 유닛 테스트</button>
              {startLearning('여기서부터 시작', false)}
            </div>
          ) : (
            startLearning('학습 시작', true)
          )}
        </Window>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <Window title="테스트 결과" className="w-full max-w-[420px]" bodyClassName="space-y-6 p-6 text-center">
        <ScoreRing pct={pct} />
        <h1 className="bit-2">{p.passed ? `${p.unitName} 건너뛰기 성공!` : '조금만 더 배워 봐요'}</h1>
        <p className="bit text-ink-2">
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
      </Window>
    </div>
  );
}
