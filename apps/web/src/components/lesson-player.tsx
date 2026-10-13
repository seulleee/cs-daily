'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompleteSessionResponse, RetryAnswerResponse, SessionResponse, SubmitAnswerResponse, UserAnswer } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { CheckIcon, RepeatIcon, XIcon } from './icons';
import { QuestionRenderer, correctAnswerText } from './question-renderers';

/**
 * 레슨 플레이어 (기획서 5절): 풀스크린, 진행 바, 문제 1개, 하단 고정 확인 버튼, 정오답 시트.
 * 흐름(듀오링고식): 시작 카드 → 본 문제 → 틀린 문제 다시 풀기(맞힐 때까지, 최대 2회) → 완료
 * 상태는 서버가 진실. 재도전은 채점만 받고 점수·XP·복습엔 영향이 없다.
 */
type Phase = 'intro' | 'main' | 'retry';
type Graded = { isCorrect: boolean; correctAnswer?: unknown; explanation: string; xpDelta: number };

const MAX_RETRY = 2;

/** "용어 — 정의" 형태의 핵심 정리를 첫 " — " 기준으로 나눈다. 구분자가 없으면 통째로 정의로 본다 */
function splitKeyPoint(kp: string): { term: string | null; definition: string } {
  const i = kp.indexOf(' — ');
  if (i <= 0) return { term: null, definition: kp };
  return { term: kp.slice(0, i), definition: kp.slice(i + 3) };
}

export function LessonPlayer({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ['session', sessionId], queryFn: () => api<SessionResponse>(`/sessions/${sessionId}`) });

  const answeredIds = useMemo(() => new Set(session.data?.answered.map((a) => a.questionId) ?? []), [session.data]);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [index, setIndex] = useState(0);
  // 이번 화면에서 제출한 문제(진행 바)와 첫 답이 틀린 문제(다시 풀기 대상)
  const [submittedIds, setSubmittedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [retryQueue, setRetryQueue] = useState<string[]>([]);
  const [retryAttempts, setRetryAttempts] = useState<Record<string, number>>({});
  const [retryDone, setRetryDone] = useState(0);

  // 이어 풀기: 아직 답하지 않은 첫 문제부터. 답한 게 없고 레슨이면 시작 카드부터
  useEffect(() => {
    if (!session.data || phase !== null) return;
    const first = session.data.questions.findIndex((q) => !answeredIds.has(q.id));
    const resumedWrong = session.data.answered.filter((a) => !a.isCorrect).map((a) => a.questionId);
    setWrongIds(resumedWrong);
    if (first === -1) {
      setIndex(session.data.questions.length);
      setPhase('main');
    } else if (first === 0 && session.data.kind === 'lesson') {
      setPhase('intro');
    } else {
      setIndex(first);
      setPhase('main');
    }
  }, [session.data, answeredIds, phase]);

  const [draft, setDraft] = useState<UserAnswer | null>(null);
  const [result, setResult] = useState<Graded | null>(null);
  const startedAt = useRef<number>(Date.now());

  const submit = useMutation({
    mutationFn: (p: { questionId: string; answer: UserAnswer }) =>
      api<SubmitAnswerResponse>(`/sessions/${sessionId}/answers`, { json: { ...p, timeMs: Math.min(600_000, Date.now() - startedAt.current) } }),
    onSuccess: (r, p) => {
      setResult(r);
      setSubmittedIds((prev) => new Set(prev).add(p.questionId));
      if (!r.isCorrect) setWrongIds((prev) => (prev.includes(p.questionId) ? prev : [...prev, p.questionId]));
    },
  });
  const retry = useMutation({
    mutationFn: (p: { questionId: string; answer: UserAnswer }) => api<RetryAnswerResponse>(`/sessions/${sessionId}/retry`, { json: p }),
    onSuccess: (r) => setResult({ ...r, xpDelta: 0 }),
  });
  // 인자는 "다시 푼 문제" 수. 응답에 없는 값이라 결과 화면용으로 따로 캐시에 둔다
  const complete = useMutation({
    mutationFn: async (retried: number) => ({ r: await api<CompleteSessionResponse>(`/sessions/${sessionId}/complete`, { method: 'POST' }), retried }),
    onSuccess: ({ r, retried }) => {
      qc.setQueryData(['session-result', sessionId], r);
      qc.setQueryData(['session-retried', sessionId], retried);
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['path'] });
      router.replace(`/lesson/${sessionId}/result`);
    },
  });

  const questions = session.data?.questions ?? [];
  const total = questions.length;
  const q = phase === 'main' ? questions[index] : phase === 'retry' ? questions.find((x) => x.id === retryQueue[0]) : undefined;

  // 문제 이동 시 입력·결과 초기화, 타이머 리셋
  useEffect(() => {
    setDraft(null);
    setResult(null);
    startedAt.current = Date.now();
  }, [q?.id, phase]);

  // 본 문제가 끝나면: 틀린 게 있으면 다시 풀기, 없으면 완료
  useEffect(() => {
    if (!session.data || phase !== 'main' || index < total) return;
    if (wrongIds.length > 0) {
      setRetryQueue(wrongIds);
      setPhase('retry');
    } else if (!complete.isPending && !complete.isSuccess) {
      complete.mutate(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total, phase, session.data]);

  // 다시 풀기 큐가 비면 완료
  useEffect(() => {
    if (phase === 'retry' && retryQueue.length === 0 && !complete.isPending && !complete.isSuccess) complete.mutate(wrongIds.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, retryQueue.length]);

  const next = () => {
    if (phase === 'main') {
      setIndex((i) => i + 1);
      return;
    }
    if (phase === 'retry' && q && result) {
      const attempts = (retryAttempts[q.id] ?? 0) + 1;
      setRetryAttempts((m) => ({ ...m, [q.id]: attempts }));
      if (result.isCorrect || attempts >= MAX_RETRY) {
        setRetryDone((n) => n + 1);
        setRetryQueue((qs) => qs.slice(1));
      } else {
        setRetryQueue((qs) => [...qs.slice(1), qs[0]!]); // 또 틀리면 맨 뒤로
      }
    }
  };
  const check = () => {
    if (!q || !draft) return;
    if (phase === 'retry') retry.mutate({ questionId: q.id, answer: draft });
    else submit.mutate({ questionId: q.id, answer: draft });
  };

  const canSubmit = draft !== null && !(typeof draft === 'object' && 'text' in draft && !draft.text.trim()) && !(('indices' in (draft ?? {})) && (draft as { indices: number[] }).indices.length === 0);
  const pending = submit.isPending || retry.isPending;

  // Enter: 확인 또는 다음
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (phase === 'intro') setPhase('main');
      else if (result) next();
      else if (canSubmit && q && !pending) check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (session.isLoading || phase === null) return <div className="p-8 text-center text-ink-2">불러오는 중…</div>;
  if (session.isError || !session.data) return <div className="p-8 text-center">세션을 찾을 수 없습니다. <Link href="/learn" className="underline">홈으로</Link></div>;

  if (phase === 'intro') {
    // 배포 순서상 API가 아직 옛 버전이면 필드가 없을 수 있다
    const keyPoints = session.data.lessonKeyPoints ?? [];
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
          <ExitLink />
        </header>
        <section className="flex flex-1 flex-col items-center justify-center px-6 pb-40 text-center">
          <div className="w-full max-w-[520px]">
            <p className="font-mono text-cap font-semibold text-brand">이번 레슨</p>
            <h1 className="mt-2 text-h2 font-semibold">{session.data.lessonName ?? '레슨'}</h1>
            {session.data.lessonObjective && <p className="mt-4 text-body text-ink-2">{session.data.lessonObjective}</p>}
            {keyPoints.length > 0 && (
              <div className="card mt-6 p-5 text-left">
                <h2 className="font-mono text-cap font-semibold">핵심 정리</h2>
                <ul className="mt-3 space-y-3 text-body">
                  {keyPoints.map((kp) => {
                    const { term, definition } = splitKeyPoint(kp);
                    return (
                      <li key={kp} className="flex gap-3">
                        <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        <span className="text-ink-2">
                          {term && <strong className="font-semibold text-ink">{term}</strong>}
                          {term && ' — '}
                          {definition}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <p className="mt-6 font-mono text-cap text-ink-2">
              {total}문제 · 약 5분 · 틀린 문제는 끝에서 다시 풀어요
            </p>
          </div>
        </section>
        <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
          <div className="mx-auto max-w-[720px] px-4">
            <button type="button" onClick={() => setPhase('main')} className="btn-3d w-full" autoFocus>시작</button>
          </div>
        </footer>
      </div>
    );
  }

  if (session.data.finished || !q) return <div className="p-8 text-center text-ink-2">결과를 계산하는 중…</div>;

  // 진행 바: 본 문제 + 다시 풀기까지 한 줄로 이어진다
  const answered = questions.filter((x) => answeredIds.has(x.id) || submittedIds.has(x.id)).length;
  const retryTotal = phase === 'retry' ? retryDone + retryQueue.length : 0;
  const progress = Math.round(((answered + retryDone) / (total + retryTotal)) * 100);
  const answerText = result && !result.isCorrect ? correctAnswerText(q, result.correctAnswer) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 md:mx-auto md:w-full md:max-w-[720px]">
        <ExitLink />
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="진행률" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand-fill transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="font-mono text-body font-semibold tabular-nums text-ink-2">
          {phase === 'retry' ? `다시 ${retryDone}/${retryTotal}` : `${answered}/${total}`}
        </span>
      </header>

      {/* 문제 영역은 헤더와 하단 버튼 사이에서 세로 가운데 정렬 (콘텐츠가 길면 위에서부터 스크롤) */}
      <section className={`flex flex-1 flex-col justify-center px-4 pt-4 ${result ? 'pb-72' : 'pb-40 md:pb-44'}`}>
        <div className="mx-auto w-full max-w-[600px]">
          {session.data.kind === 'review' && <p className="mb-3 flex items-center gap-1.5 font-mono text-cap font-semibold text-streak">복습 세션 · XP ×1.5</p>}
          {session.data.kind === 'placement' && (
            <p className="mb-3 font-mono text-cap font-semibold text-brand">
              건너뛰기 테스트{session.data.lessonName ? ` · ${session.data.lessonName}` : ''} — 80% 이상 맞히면 이 유닛까지 완료돼요
            </p>
          )}
          {phase === 'retry' && (
            <p className="mb-3 flex items-center gap-1.5 font-mono text-cap font-semibold text-streak">
              <RepeatIcon size={16} /> 틀린 문제 다시 풀기
            </p>
          )}
          <QuestionRenderer question={q} value={draft} onChange={setDraft} revealed={result ? { correctAnswer: result.correctAnswer, isCorrect: result.isCorrect } : null} />
          {(submit.isError || retry.isError) && <p className="mt-3 text-cap text-wrong">{((submit.error ?? retry.error) as ApiError).message}</p>}
        </div>
      </section>

      {/* 하단 고정: 확인 또는 정오답 시트 */}
      {result ? (
        <div
          role="status"
          className={`sheet-up fixed inset-x-0 bottom-0 rounded-t-[24px] p-5 pb-[max(env(safe-area-inset-bottom),20px)] ${result.isCorrect ? 'bg-correct-bg' : 'bg-wrong-bg'}`}
        >
          <div className="mx-auto flex max-w-[720px] flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  aria-hidden
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${result.isCorrect ? 'bg-correct-fill text-on-correct' : 'bg-wrong text-on-wrong'}`}
                >
                  {result.isCorrect ? <CheckIcon size={20} strokeWidth={3} /> : <XIcon size={20} strokeWidth={3} />}
                </span>
                <p className={`text-title font-semibold ${result.isCorrect ? 'text-correct' : 'text-wrong'}`}>
                  {result.isCorrect ? (result.xpDelta > 0 ? `정답! +${result.xpDelta} XP` : '정답!') : phase === 'retry' ? '한 번 더 볼게요' : '아쉬워요'}
                </p>
                {!result.isCorrect && phase === 'main' && (
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-cap font-medium text-ink-2">끝에서 다시 풀어요</span>
                )}
              </div>
              {answerText && (
                <p className="mt-3 text-body">
                  <span className="text-ink-2">정답 </span>
                  <strong className="font-semibold">{answerText}</strong>
                </p>
              )}
              <p className="mt-2 text-body">{result.explanation}</p>
            </div>
            <button type="button" onClick={next} className={`btn-3d w-full md:w-40 ${result.isCorrect ? 'correct' : ''}`} autoFocus>
              계속
            </button>
          </div>
        </div>
      ) : (
        <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
          <div className="mx-auto max-w-[720px] px-4">
            <button type="button" disabled={!canSubmit || pending} onClick={check} className="btn-3d w-full">
              {pending ? '채점 중…' : '확인'}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function ExitLink() {
  return (
    <Link href="/learn" aria-label="나가기" className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2">
      <XIcon size={24} />
    </Link>
  );
}
