'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CodingLanguage, CompleteSessionResponse, RetryAnswerResponse, SessionResponse, SubmitAnswerResponse, UserAnswer } from '@cs-daily/contracts';
import { api, ApiError } from '@/lib/api';
import { CheckIcon, RepeatIcon, XIcon } from './icons';
import { useKeyboardInset } from '@/lib/use-keyboard-inset';
import { useHeight, useOverflowing } from '@/lib/use-measure';
import { QuestionRenderer, correctAnswerText } from './question-renderers';
import { Window } from './window';

/**
 * 레슨 플레이어 (기획서 5절): 풀스크린, 진행 바, 문제 1개, 하단 고정 확인 버튼, 정오답 시트.
 * 흐름(듀오링고식): 시작 카드 → 본 문제 → 틀린 문제 다시 풀기(맞힐 때까지, 최대 2회) → 완료
 * 상태는 서버가 진실. 재도전은 채점만 받고 점수·XP·복습엔 영향이 없다.
 */
type Phase = 'intro' | 'main' | 'retry';
type Graded = { isCorrect: boolean; correctAnswer?: unknown; explanation: string; xpDelta: number };

const MAX_RETRY = 2;

/** 결과 창 높이 상한: 화면의 절반, 최대 360px. 본문(타이틀바 24 + 테두리 2를 뺀 부분)만 스크롤된다 */
const RESULT_BODY_STYLE = { maxHeight: 'calc(min(50dvh, 360px) - 26px)' } as CSSProperties;

/** "용어 — 정의" 형태의 핵심 정리를 첫 " — " 기준으로 나눈다. 구분자가 없으면 통째로 정의로 본다 */
function splitKeyPoint(kp: string): { term: string | null; definition: string } {
  const i = kp.indexOf(' — ');
  if (i <= 0) return { term: null, definition: kp };
  return { term: kp.slice(0, i), definition: kp.slice(i + 3) };
}

export function LessonPlayer({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  // 세션은 서버가 진실이다. 캐시는 레슨 도중 제출한 답을 모르는 채로 남을 수 있어 마운트마다 새로 받고,
  // 이어 풀기 위치는 그 새 응답으로만 정한다(아래 effect의 isFetchedAfterMount)
  const sessionKey = ['session', sessionId] as const;
  const fetchSession = () => api<SessionResponse>(`/sessions/${sessionId}`);
  const session = useQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false });

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
    if (!session.data || phase !== null || !session.isFetchedAfterMount) return;
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
  }, [session.data, session.isFetchedAfterMount, answeredIds, phase]);

  const [draft, setDraft] = useState<UserAnswer | null>(null);
  const [result, setResult] = useState<Graded | null>(null);
  const startedAt = useRef<number>(Date.now());

  const submit = useMutation({
    mutationFn: (p: { questionId: string; answer: UserAnswer; lang?: CodingLanguage }) =>
      api<SubmitAnswerResponse>(`/sessions/${sessionId}/answers`, { json: { ...p, timeMs: Math.min(600_000, Date.now() - startedAt.current) } }),
    onSuccess: (r, p) => {
      setResult(r);
      // 캐시가 서버와 어긋나지 않게 이 답을 세션 캐시의 answered에도 반영한다
      qc.setQueryData<SessionResponse>(sessionKey, (old) =>
        old
          ? {
              ...old,
              answered: [
                ...old.answered.filter((a) => a.questionId !== p.questionId),
                { questionId: p.questionId, isCorrect: r.isCorrect, correctAnswer: r.correctAnswer, explanation: r.explanation },
              ],
            }
          : old,
      );
      setSubmittedIds((prev) => new Set(prev).add(p.questionId));
      if (!r.isCorrect) setWrongIds((prev) => (prev.includes(p.questionId) ? prev : [...prev, p.questionId]));
    },
    // 이미 답한 문제(409): 오류를 보이지 않고 서버 기록을 다시 받아 그 문제를 "답한 문제"로 두고 다음 미답 문제로 넘어간다
    onError: async (err) => {
      if (!(err instanceof ApiError) || err.code !== 'ANSWER_ALREADY_SUBMITTED') return;
      try {
        const fresh = await qc.fetchQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 0 });
        const done = new Set(fresh.answered.map((a) => a.questionId));
        setSubmittedIds((prev) => new Set([...prev, ...done]));
        setWrongIds(fresh.answered.filter((a) => !a.isCorrect).map((a) => a.questionId));
        const first = fresh.questions.findIndex((x) => !done.has(x.id));
        setDraft(null);
        setResult(null);
        startedAt.current = Date.now();
        setIndex(first === -1 ? fresh.questions.length : first);
        inFlight.current = false; // reset()하면 mutate 단위 onSettled가 불리지 않는다
        submit.reset();
      } catch {
        // 다시 불러오지 못하면 기존 오류 문구를 그대로 보인다
      }
    },
  });
  const retry = useMutation({
    mutationFn: (p: { questionId: string; answer: UserAnswer; lang?: CodingLanguage }) => api<RetryAnswerResponse>(`/sessions/${sessionId}/retry`, { json: p }),
    onSuccess: (r) => setResult({ ...r, xpDelta: 0 }),
  });
  // 인자는 "다시 푼 문제" 수. 응답에 없는 값이라 결과 화면용으로 따로 캐시에 둔다
  const complete = useMutation({
    mutationFn: async (retried: number) => ({ r: await api<CompleteSessionResponse>(`/sessions/${sessionId}/complete`, { method: 'POST' }), retried }),
    onSuccess: ({ r, retried }) => {
      qc.setQueryData(['session-result', sessionId], r);
      qc.setQueryData(['session-retried', sessionId], retried);
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['me', 'quests'] });
      qc.invalidateQueries({ queryKey: ['path'] });
      qc.invalidateQueries({ queryKey: ['calendar'] }); // PC 보조 패널의 이번 주 7칸·프로필 달력
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
    // 결과를 먼저 걷어 다음 문제가 앞 문제의 정오답 표시를 한 프레임도 물려받지 않게 한다
    setDraft(null);
    setResult(null);
    startedAt.current = Date.now();
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
  // 응답 전 재호출(Enter 연타·IME 이벤트 중복) 방지. pending 상태는 다음 렌더 전엔 반영되지 않아 ref로 막는다
  const inFlight = useRef(false);
  const check = () => {
    if (!q || !draft || inFlight.current) return;
    inFlight.current = true;
    const settle = { onSettled: () => { inFlight.current = false; } };
    if (phase === 'retry') retry.mutate({ questionId: q.id, answer: draft, lang: q.lang }, settle);
    else submit.mutate({ questionId: q.id, answer: draft, lang: q.lang }, settle);
  };

  const canSubmit = draft !== null && !(typeof draft === 'object' && 'text' in draft && !draft.text.trim()) && !(('indices' in (draft ?? {})) && (draft as { indices: number[] }).indices.length === 0);
  const pending = submit.isPending || retry.isPending;

  // 하단 도크: 버튼 줄 높이(문제 영역 아래 여백)와 결과 창 높이(문제 영역 끝의 빈 자리), 해설이 넘칠 때의 스크롤 여부
  const [rowRef, rowH] = useHeight<HTMLDivElement>();
  const [resultRef, resultH] = useHeight<HTMLDivElement>();
  const [resultBodyRef, resultScrolls] = useOverflowing<HTMLDivElement>();
  // 가상 키보드: iOS는 inset만큼 도크를 올리고, 열려 있으면 하단 safe-area 여백을 뺀다(Android는 inset 0)
  const kb = useKeyboardInset();
  useEffect(() => {
    if (!kb.open) return;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement) el.scrollIntoView({ block: 'nearest' });
  }, [kb.open, kb.inset, rowH]);

  // 포커스: 결과가 열리면 "계속"(autoFocus), 새 문제로 넘어가면 문제 제목(빈칸 문제는 입력창)
  const focusKey = phase === 'intro' || phase === null || result ? null : `${phase}:${q?.id}`;
  useEffect(() => {
    if (!focusKey) return;
    const el = document.querySelector<HTMLElement>('input[aria-label="빈칸"], [data-question-heading]');
    el?.focus({ preventScroll: true });
  }, [focusKey]);

  // Enter: 확인 또는 다음. 버튼·링크에 포커스가 있으면 브라우저가 Enter를 click으로 바꿔 주므로 여기서는 건드리지 않는다(이중 실행 방지).
  // 빈칸 입력창의 Enter는 기본 동작이 없어 여기서 제출로 받는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented) return;
      // 한글 IME 조합 중 Enter는 조합 확정용이다. 제출하지 않는다.
      // keyCode 229만으로는 막지 않는다: iOS Safari·Android Gboard는 조합 직후 리턴도 229(isComposing=false)로 보낸다
      if (e.isComposing) return;
      const t = e.target;
      if (t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement || t instanceof HTMLTextAreaElement) return;
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
    const intro = session.data.lessonIntro ?? [];
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
          <ExitLink />
        </header>
        <section className="flex flex-1 flex-col items-center justify-center px-6 pb-40 text-center">
          <div className="w-full max-w-[600px]">
            <p className="bit text-ink">이번 레슨</p>
            <h1 className="bit-2 mt-2">{session.data.lessonName ?? '레슨'}</h1>
            {session.data.lessonObjective && <p className="mt-4 text-body text-ink-2">{session.data.lessonObjective}</p>}
            {intro.length > 0 && (
              <div className="mt-6 space-y-4 text-left text-body leading-[1.75] text-ink" data-testid="lesson-intro">
                {intro.map((para) => (
                  <p key={para}>{para}</p>
                ))}
              </div>
            )}
            {keyPoints.length > 0 && (
              <div className="card mt-6 p-5 text-left">
                <h2 className="bit">핵심 정리</h2>
                <ul className="mt-3 space-y-3 text-body">
                  {keyPoints.map((kp) => {
                    const { term, definition } = splitKeyPoint(kp);
                    return (
                      <li key={kp} className="flex gap-3">
                        <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-ink" />
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
            <p className="bit mt-6 text-ink-2">
              {total}문제 · 약 5분 · 틀린 문제는 끝에서 다시 풀어요
            </p>
          </div>
        </section>
        <footer className="fixed inset-x-0 bottom-0 border-t border-ink bg-surface pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
          <div className="mx-auto max-w-[720px] px-4">
            <button key="start" type="button" onClick={() => setPhase('main')} className="btn-3d w-full" autoFocus>시작</button>
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
        <div className="meter flex-1" role="progressbar" aria-label="진행률" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="bit text-ink-2">
          {phase === 'retry' ? `다시 ${retryDone}/${retryTotal}` : `${answered}/${total}`}
        </span>
      </header>

      {/* 문제 영역은 헤더 아래 위쪽 고정이다. 아래 여백은 도크의 버튼 줄 높이 + 24px, 결과 창이 열리면 영역 끝에 창 높이만큼 빈 자리를 더해
          위쪽 콘텐츠는 1px도 움직이지 않고 창에 가린 보기는 스크롤로 볼 수 있다 */}
      <section className="flex flex-1 flex-col px-4" style={{ paddingTop: 'clamp(16px, 6dvh, 48px)', paddingBottom: rowH + 24 + kb.inset }}>
        <div className="mx-auto w-full max-w-[600px]">
          {session.data.kind === 'review' && <p className="bit mb-3 flex items-center gap-1.5 text-ink">복습 세션 · XP ×1.5</p>}
          {session.data.kind === 'placement' && (
            <p className="bit mb-3 text-ink">
              건너뛰기 테스트{session.data.lessonName ? ` · ${session.data.lessonName}` : ''} — 80% 이상 맞히면 이 유닛까지 완료돼요
            </p>
          )}
          {phase === 'retry' && (
            <p className="bit mb-3 flex items-center gap-1.5 text-ink">
              <RepeatIcon size={16} /> 틀린 문제 다시 풀기
            </p>
          )}
          <QuestionRenderer question={q} value={draft} onChange={setDraft} revealed={result ? { correctAnswer: result.correctAnswer, isCorrect: result.isCorrect } : null} />
          {(submit.isError || retry.isError) && <p className="mt-3 text-cap text-wrong">{((submit.error ?? retry.error) as ApiError).message}</p>}
        </div>
        <div aria-hidden style={{ height: result ? resultH : 0 }} />
      </section>

      {/* 스크린 리더용 결과 안내(시각적으로는 결과 창이 같은 내용을 보여 준다) */}
      <div className="sr-only" aria-live="polite">
        {result && `${result.isCorrect ? '정답입니다.' : '오답입니다.'}${answerText ? ` 정답 ${answerText}.` : ''} ${result.explanation}`}
      </div>

      {/* 하단 도크: 풀기 전후로 계속 같은 자리에 있다. 위쪽 = 결과 창 자리(풀기 전에는 비어 있음), 아래쪽 = 주 버튼 줄.
          "확인"과 "계속"은 같은 줄·같은 폭이라 버튼 아래 끝 y가 변하지 않는다 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-ink bg-surface" style={{ bottom: kb.inset }}>
        {result && (
          <div ref={resultRef} className="mx-auto max-w-[720px] px-4 pt-3">
            {/* 열릴 때 줌 사각형 세 개(60ms 간격)가 지나간 뒤 창이 나타난다. 닫을 때는 효과 없이 즉시 (globals.css .zoom-rect) */}
            <div className="relative">
              <div aria-hidden className="zoom-rect zoom-rect-1" />
              <div aria-hidden className="zoom-rect zoom-rect-2" />
              <div aria-hidden className="zoom-rect zoom-rect-3" />
              <Window
                title="결과"
                className="sheet-win"
                bodyClassName="overflow-y-auto p-4"
                bodyStyle={RESULT_BODY_STYLE}
                bodyProps={{ ref: resultBodyRef, ...(resultScrolls ? { tabIndex: 0, role: 'region', 'aria-label': '해설' } : {}) }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center ${result.isCorrect ? 'bg-correct-fill text-on-correct' : 'bg-wrong text-on-wrong'}`}
                  >
                    {result.isCorrect ? <CheckIcon size={16} strokeWidth={3} /> : <XIcon size={16} strokeWidth={3} />}
                  </span>
                  <p className={`bit ${result.isCorrect ? 'text-ink' : 'text-wrong'}`}>
                    {result.isCorrect ? (result.xpDelta > 0 ? `정답! +${result.xpDelta} XP` : '정답!') : phase === 'retry' ? '한 번 더 볼게요' : '아쉬워요'}
                  </p>
                  {!result.isCorrect && phase === 'main' && (
                    <span className="border border-ink px-2.5 py-0.5 text-cap font-medium text-ink-2">끝에서 다시 풀어요</span>
                  )}
                </div>
                {answerText && (
                  <p className="mt-3 text-body">
                    <span className="text-ink-2">정답 </span>
                    <strong className="font-semibold">{answerText}</strong>
                  </p>
                )}
                <p className="mt-2 text-body">{result.explanation}</p>
              </Window>
            </div>
          </div>
        )}
        <div ref={rowRef} className={`mx-auto max-w-[720px] px-4 ${kb.open ? 'pb-2 pt-2' : 'pb-[max(env(safe-area-inset-bottom),16px)] pt-4'}`}>
          {/* key: 확인 ↔ 계속처럼 같은 자리의 버튼 DOM이 재사용되면 앞 버튼의 클릭 깜빡임(lib/use-flash.ts)이 다음 버튼 위에서 이어지므로 버튼마다 분리한다 */}
          {result ? (
            <button key="next" type="button" onClick={next} className="btn-3d w-full" autoFocus>
              계속
            </button>
          ) : (
            <button key="check" type="button" disabled={!canSubmit || pending} onClick={check} className="btn-3d w-full">
              {pending ? '채점 중…' : '확인'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExitLink() {
  return (
    <Link href="/learn" aria-label="나가기" className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink">
      <XIcon size={24} />
    </Link>
  );
}
