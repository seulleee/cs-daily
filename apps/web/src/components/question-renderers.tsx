'use client';

import type { PublicQuestion, UserAnswer } from '@cs-daily/contracts';
import { useEffect, useRef } from 'react';
import { CheckIcon, XIcon } from './icons';
import { SelectMark } from './select-mark';

interface RendererProps {
  question: PublicQuestion;
  value: UserAnswer | null;
  onChange: (v: UserAnswer) => void;
  /** 채점 후: 정답 키. null이면 아직 미채점 */
  revealed: { correctAnswer: unknown; isCorrect: boolean } | null;
}

type SingleContent = { prompt: string; code?: { language: string; source: string } | null; options: string[] };
type OxContent = { prompt: string; code?: { language: string; source: string } | null };
type FillContent = { prompt: string; code?: { language: string; source: string } | null; hint?: string };

export function QuestionRenderer(props: RendererProps) {
  switch (props.question.type) {
    case 'single':
      return <ChoiceRenderer {...props} multi={false} />;
    case 'multi':
      return <ChoiceRenderer {...props} multi />;
    case 'ox':
      return <OxRenderer {...props} />;
    case 'fill':
      return <FillRenderer {...props} />;
  }
}

function Prompt({ prompt, code }: { prompt: string; code?: { language: string; source: string } | null }) {
  return (
    <div className="mb-6">
      <h2 className="text-title font-semibold">{prompt}</h2>
      {code && <CodeBlock source={code.source} className="mt-3" />}
    </div>
  );
}

function CodeBlock({ source, className = '' }: { source: string; className?: string }) {
  return (
    <pre className={`overflow-x-auto border border-ink bg-surface p-3 font-mono text-cap text-ink [word-spacing:normal] ${className}`}>
      <code>{source}</code>
    </pre>
  );
}

/** 채점 후 "정답 ○○"으로 보여 줄 문장. 정답 키 모양이 예상과 다르면 null */
export function correctAnswerText(question: PublicQuestion, correctAnswer: unknown): string | null {
  const a = correctAnswer as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return null;
  switch (question.type) {
    case 'single':
    case 'multi': {
      const options = (question.content as SingleContent).options;
      const idx = question.type === 'multi' ? (a.indices as number[] | undefined) : typeof a.index === 'number' ? [a.index] : undefined;
      const texts = idx?.map((i) => options[i]).filter((t): t is string => !!t);
      return texts && texts.length > 0 ? texts.join(', ') : null;
    }
    case 'ox':
      return typeof a.value === 'boolean' ? (a.value ? 'O (맞다)' : 'X (틀리다)') : null;
    case 'fill': {
      const accepted = a.accepted as string[] | undefined;
      return accepted?.[0] ?? null;
    }
  }
}

/** 채점 후 보기 오른쪽 끝의 상태 아이콘. 정답은 색이 아니라 아이콘(check)+굵은 테두리로, 오답은 x+wrong 테두리로 구분한다 */
function StateIcon({ state }: { state: 'correct' | 'wrong' | undefined }) {
  if (state === 'correct') return <CheckIcon size={22} strokeWidth={3} className="shrink-0 text-correct" />;
  if (state === 'wrong') return <XIcon size={22} strokeWidth={3} className="shrink-0 text-wrong" />;
  return null;
}

/** 객관식(단일·복수). 숫자 키 1~6으로 선택 가능 */
function ChoiceRenderer({ question, value, onChange, revealed, multi }: RendererProps & { multi: boolean }) {
  const c = question.content as SingleContent;
  const selected = new Set(multi ? ((value as { indices?: number[] } | null)?.indices ?? []) : value ? [(value as { index: number }).index] : []);
  const correct = new Set<number>(
    revealed ? (multi ? ((revealed.correctAnswer as { indices: number[] }).indices ?? []) : [(revealed.correctAnswer as { index: number }).index]) : [],
  );

  const toggle = (i: number) => {
    if (revealed) return;
    if (!multi) return onChange({ index: i });
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange({ indices: [...next].sort((a, b) => a - b) });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= c.options.length && !(e.target instanceof HTMLInputElement)) toggle(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.options.length, value, revealed]);

  return (
    <div>
      <Prompt prompt={c.prompt} code={c.code} />
      {multi && <p className="mb-2 text-cap font-medium text-ink-2">해당하는 것을 모두 고르세요</p>}
      <div role={multi ? 'group' : 'radiogroup'} className="space-y-3">
        {c.options.map((opt, i) => {
          const state = revealed ? (correct.has(i) ? 'correct' : selected.has(i) ? 'wrong' : undefined) : undefined;
          return (
            <button
              key={i}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={selected.has(i)}
              data-selected={selected.has(i)}
              data-state={state}
              disabled={!!revealed}
              onClick={() => toggle(i)}
              className="option flex items-center gap-3"
            >
              <SelectMark kind={multi ? 'box' : 'radio'} />
              <span className="flex-1 text-body">{opt}</span>
              <StateIcon state={state} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OxRenderer({ question, value, onChange, revealed }: RendererProps) {
  const c = question.content as OxContent;
  const v = (value as { value: boolean } | null)?.value;
  const correct = revealed ? (revealed.correctAnswer as { value: boolean }).value : null;
  return (
    <div>
      <Prompt prompt={c.prompt} code={c.code} />
      <div className="grid grid-cols-2 gap-3" role="radiogroup">
        {[true, false].map((b) => (
          <button
            key={String(b)}
            type="button"
            role="radio"
            aria-checked={v === b}
            data-selected={v === b}
            data-state={revealed ? (correct === b ? 'correct' : v === b ? 'wrong' : undefined) : undefined}
            disabled={!!revealed}
            onClick={() => onChange({ value: b })}
            className="option flex flex-col items-center py-5 text-center"
          >
            <SelectMark corner />
            <span className="bit-2">{b ? 'O' : 'X'}</span>
            <span className="mt-1 text-cap font-medium text-ink-2">{b ? '맞다' : '틀리다'}</span>
            <span className="absolute right-3 top-3">
              <StateIcon state={revealed ? (correct === b ? 'correct' : v === b ? 'wrong' : undefined) : undefined} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FillRenderer({ question, value, onChange, revealed }: RendererProps) {
  const c = question.content as FillContent;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), [question.id]);
  const [before, after] = c.prompt.split('___');
  const text = (value as { text: string } | null)?.text ?? '';
  return (
    <div>
      <h2 className="mb-5 text-title font-semibold">
        {before}
        <input
          ref={ref}
          type="text"
          value={text}
          disabled={!!revealed}
          onChange={(e) => onChange({ text: e.target.value })}
          aria-label="빈칸"
          autoComplete="off"
          className="mx-1 inline-block w-40 border border-ink bg-paper px-2 py-0.5 text-center text-ink focus:shadow-[inset_0_0_0_1px_var(--color-ink)]"
          style={revealed ? { borderColor: revealed.isCorrect ? 'var(--color-correct)' : 'var(--color-wrong)', color: revealed.isCorrect ? 'var(--color-correct)' : 'var(--color-wrong)', boxShadow: `inset 0 0 0 1px ${revealed.isCorrect ? 'var(--color-correct)' : 'var(--color-wrong)'}` } : undefined}
        />
        {revealed && (
          <span className="mr-1 inline-block align-middle">
            <StateIcon state={revealed.isCorrect ? 'correct' : 'wrong'} />
          </span>
        )}
        {after}
      </h2>
      {c.code && <CodeBlock source={c.code.source} className="mb-4" />}
      {c.hint && !revealed && <p className="text-cap text-ink-2">힌트: {c.hint}</p>}
    </div>
  );
}
