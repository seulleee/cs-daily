'use client';

import type { PublicQuestion, UserAnswer } from '@cs-daily/contracts';
import { useEffect, useRef } from 'react';

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
      <h2 className="text-xl font-bold leading-snug md:text-2xl">{prompt}</h2>
      {code && (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-(--color-ink) p-3 text-sm text-(--color-surface)">
          <code>{code.source}</code>
        </pre>
      )}
    </div>
  );
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
      {multi && <p className="mb-2 text-xs font-semibold text-(--color-ink-2)">해당하는 것을 모두 고르세요</p>}
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
              className="option flex items-start gap-3"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold text-(--color-ink-2)" style={{ borderColor: 'var(--color-line)' }}>
                {i + 1}
              </span>
              <span className="text-sm md:text-base">{opt}</span>
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
            className="option py-6 text-center text-2xl font-black"
          >
            {b ? 'O' : 'X'}
            <div className="mt-1 text-xs font-semibold text-(--color-ink-2)">{b ? '맞다' : '틀리다'}</div>
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
  const accepted = revealed ? ((revealed.correctAnswer as { accepted: string[] }).accepted ?? []) : [];
  return (
    <div>
      <h2 className="mb-5 text-lg font-bold leading-relaxed md:text-xl">
        {before}
        <input
          ref={ref}
          type="text"
          value={text}
          disabled={!!revealed}
          onChange={(e) => onChange({ text: e.target.value })}
          aria-label="빈칸"
          autoComplete="off"
          className="mx-1 inline-block w-40 rounded-lg border-b-2 bg-transparent px-2 py-0.5 text-center text-(--color-brand) outline-none focus:border-(--color-brand)"
          style={{ borderColor: revealed ? (revealed.isCorrect ? 'var(--color-correct)' : 'var(--color-wrong)') : 'var(--color-line)' }}
        />
        {after}
      </h2>
      {c.code && (
        <pre className="mb-4 overflow-x-auto rounded-xl bg-(--color-ink) p-3 text-sm text-(--color-surface)">
          <code>{c.code.source}</code>
        </pre>
      )}
      {c.hint && !revealed && <p className="text-sm text-(--color-ink-2)">힌트: {c.hint}</p>}
      {revealed && !revealed.isCorrect && accepted.length > 0 && <p className="text-sm font-semibold text-(--color-correct)">정답: {accepted[0]}</p>}
    </div>
  );
}
