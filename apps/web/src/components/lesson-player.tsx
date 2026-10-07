'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompleteSessionResponse, SessionResponse, SubmitAnswerResponse, UserAnswer } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { QuestionRenderer } from './question-renderers';

/**
 * 레슨 플레이어 (기획서 5절): 풀스크린, 진행 바, 문제 1개, 하단 고정 확인 버튼, 정오답 시트.
 * 상태는 서버가 진실. 로컬 상태는 "현재 문제 인덱스 + 입력 중인 답"뿐이다.
 */
export function LessonPlayer({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ['session', sessionId], queryFn: () => api<SessionResponse>(`/sessions/${sessionId}`) });

  // 이어 풀기: 아직 답하지 않은 첫 문제부터
  const answeredIds = useMemo(() => new Set(session.data?.answered.map((a) => a.questionId) ?? []), [session.data]);
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    if (session.data && index === null) {
      const first = session.data.questions.findIndex((q) => !answeredIds.has(q.id));
      setIndex(first === -1 ? session.data.questions.length : first);
    }
  }, [session.data, answeredIds, index]);

  // 세션 응답(answered)은 처음 한 번만 받아오므로, 이번 화면에서 제출한 문제는 로컬로 누적한다.
  // (이게 없으면 '계속'을 누를 때마다 result가 초기화되어 진행 바가 0으로 돌아갔다)
  const [submittedIds, setSubmittedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [draft, setDraft] = useState<UserAnswer | null>(null);
  const [result, setResult] = useState<SubmitAnswerResponse | null>(null);
  const startedAt = useRef<number>(Date.now());

  const submit = useMutation({
    mutationFn: (p: { questionId: string; answer: UserAnswer }) =>
      api<SubmitAnswerResponse>(`/sessions/${sessionId}/answers`, { json: { ...p, timeMs: Math.min(600_000, Date.now() - startedAt.current) } }),
    onSuccess: (r, p) => {
      setResult(r);
      setSubmittedIds((prev) => new Set(prev).add(p.questionId));
    },
  });
  const complete = useMutation({
    mutationFn: () => api<CompleteSessionResponse>(`/sessions/${sessionId}/complete`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.setQueryData(['session-result', sessionId], r);
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['path'] });
      router.replace(`/lesson/${sessionId}/result`);
    },
  });

  const total = session.data?.questions.length ?? 0;
  const q = index !== null ? session.data?.questions[index] : undefined;

  // 문제 이동 시 입력·결과 초기화, 타이머 리셋
  useEffect(() => {
    setDraft(null);
    setResult(null);
    startedAt.current = Date.now();
  }, [q?.id]);

  // 모든 문제에 답했으면 완료 호출
  useEffect(() => {
    if (session.data && index !== null && index >= total && !complete.isPending && !complete.isSuccess) complete.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total, session.data]);

  const canSubmit = draft !== null && !(typeof draft === 'object' && 'text' in draft && !draft.text.trim()) && !(('indices' in (draft ?? {})) && (draft as { indices: number[] }).indices.length === 0);

  // Enter: 확인 또는 다음
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (result) setIndex((i) => (i ?? 0) + 1);
      else if (canSubmit && q) submit.mutate({ questionId: q.id, answer: draft! });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, canSubmit, q, draft, submit]);

  if (session.isLoading || index === null) return <div className="p-8 text-center text-(--color-ink-2)">불러오는 중…</div>;
  if (session.isError || !session.data) return <div className="p-8 text-center">세션을 찾을 수 없습니다. <Link href="/learn" className="underline">홈으로</Link></div>;
  if (session.data.finished || index >= total) return <div className="p-8 text-center text-(--color-ink-2)">결과를 계산하는 중…</div>;
  if (!q) return null;

  const answered = session.data.questions.filter((x) => answeredIds.has(x.id) || submittedIds.has(x.id)).length;
  const progress = Math.round((answered / total) * 100);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 md:mx-auto md:w-full md:max-w-[720px]">
        <Link href="/learn" aria-label="나가기" className="text-2xl text-(--color-ink-2)">×</Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-(--color-line)" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-(--color-correct) transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm font-bold text-(--color-ink-2)">{answered}/{total}</span>
      </header>

      {/* 문제 영역은 헤더와 하단 버튼 사이에서 세로 가운데 정렬 (콘텐츠가 길면 위에서부터 스크롤) */}
      <section className="flex flex-1 flex-col justify-center px-4 pt-4 pb-40 md:pb-44">
        <div className="mx-auto w-full max-w-[600px]">
        {session.data.kind === 'review' && <p className="mb-2 text-xs font-bold text-(--color-streak)">복습 세션 · XP ×1.5</p>}
        {session.data.kind === 'placement' && (
          <p className="mb-2 text-xs font-bold text-(--color-brand)">
            ⏭ 건너뛰기 테스트{session.data.lessonName ? ` · ${session.data.lessonName}` : ''} — 80% 이상 맞히면 이 유닛까지 완료돼요
          </p>
        )}
        <QuestionRenderer question={q} value={draft} onChange={setDraft} revealed={result ? { correctAnswer: result.correctAnswer, isCorrect: result.isCorrect } : null} />
        {submit.isError && <p className="mt-3 text-sm text-(--color-wrong)">{(submit.error as ApiError).message}</p>}
        </div>
      </section>

      {/* 하단 고정: 확인 또는 정오답 시트 */}
      <footer
        className="fixed inset-x-0 bottom-0 border-t pb-[max(env(safe-area-inset-bottom),16px)] pt-4 transition-colors"
        style={{
          borderColor: 'var(--color-line)',
          background: result ? (result.isCorrect ? 'var(--color-correct-bg)' : 'var(--color-wrong-bg)') : 'var(--color-surface)',
        }}
      >
        <div className="mx-auto max-w-[720px] px-4">
          {result ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <div className={`text-lg font-black ${result.isCorrect ? 'text-(--color-correct)' : 'text-(--color-wrong)'}`}>
                  {result.isCorrect ? (result.xpDelta > 0 ? `정답! +${result.xpDelta} XP` : '정답!') : '아쉬워요'}
                  {!result.isCorrect && <span className="ml-2 rounded-full bg-(--color-surface) px-2 py-0.5 text-xs font-bold text-(--color-ink-2)">복습에 추가됨</span>}
                </div>
                <p className="mt-1 text-sm leading-relaxed">{result.explanation}</p>
              </div>
              <button type="button" onClick={() => setIndex(index + 1)} className={`btn-3d w-full md:w-40 ${result.isCorrect ? 'correct' : 'wrong'}`} autoFocus>
                계속
              </button>
            </div>
          ) : (
            <button type="button" disabled={!canSubmit || submit.isPending} onClick={() => submit.mutate({ questionId: q.id, answer: draft! })} className="btn-3d w-full">
              {submit.isPending ? '채점 중…' : '확인'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
