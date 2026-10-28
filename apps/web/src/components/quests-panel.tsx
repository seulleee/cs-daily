'use client';

import type { DailyQuest, MeQuestsResponse } from '@cs-daily/contracts';
import { useState } from 'react';
import { CheckIcon } from './icons';
import { Window } from './window';

/**
 * 오늘의 퀘스트 창. PC는 우측 보조 패널(StatsPanel 아래)에 항상 펼쳐서, 모바일(`compact`)은 /learn 경로 위에 기본 접힘으로 둔다.
 * 접힌 창의 제목 줄에는 완료 수(`1/3`)가 붙는다.
 */
export function QuestsPanel({ data, compact = false }: { data: MeQuestsResponse; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const doneCount = data.daily.filter((q) => q.done).length;
  const list = (
    <ul className="space-y-4">
      {data.daily.map((q) => (
        <QuestRow key={q.key} q={q} />
      ))}
    </ul>
  );

  if (!compact) {
    return (
      <Window title="오늘의 퀘스트" bodyClassName="p-4">
        {list}
      </Window>
    );
  }

  return (
    <Window title={`오늘의 퀘스트 ${doneCount}/${data.daily.length}`} bodyClassName="p-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="quests-list"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center px-4 text-body"
      >
        <span className="text-ink-2">{open ? '접기' : '펼쳐서 보기'}</span>
      </button>
      {open && (
        <div id="quests-list" className="border-t border-line p-4">
          {list}
        </div>
      )}
    </Window>
  );
}

function QuestRow({ q }: { q: DailyQuest }) {
  const shown = Math.min(q.progress, q.goal);
  const pct = q.goal > 0 ? Math.round((shown / q.goal) * 100) : 0;
  return (
    <li>
      <div className="flex items-center justify-between gap-2">
        <span className="text-body">{q.title}</span>
        <span className="flex shrink-0 items-center gap-1">
          {q.done && (
            <>
              <CheckIcon size={16} strokeWidth={3} />
              <span className="sr-only">완료</span>
            </>
          )}
          <span className="bit">
            {shown}/{q.goal}
          </span>
        </span>
      </div>
      <div className="meter mt-2" role="progressbar" aria-label={q.title} aria-valuemin={0} aria-valuemax={q.goal} aria-valuenow={shown}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
