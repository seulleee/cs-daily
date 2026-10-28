'use client';

import type { DailyQuest, FriendQuestView, MeQuestsResponse } from '@cs-daily/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { CheckIcon } from './icons';
import { Window } from './window';

/**
 * 오늘의 퀘스트 창. PC는 우측 보조 패널(StatsPanel 아래)에 항상 펼쳐서, 모바일(`compact`)은 /learn 경로 위에 기본 접힘으로 둔다.
 * 접힌 창의 제목 줄에는 완료 수(`1/3`)가 붙는다.
 * 그 아래에 `친구 퀘스트` 창이 붙는다(짝이 없으면 친구 추가 안내).
 */
export function QuestsPanel({ data, compact = false }: { data: MeQuestsResponse; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <DailyQuestsWindow data={data} compact={compact} />
      <FriendQuestWindow friend={data.friend} />
    </div>
  );
}

function DailyQuestsWindow({ data, compact }: { data: MeQuestsResponse; compact: boolean }) {
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

/** 친구 퀘스트 창: 둘이 합쳐 이번 주 레슨 15개. 막대는 합계, 아래 줄에 각자 몇 개인지. */
function FriendQuestWindow({ friend }: { friend: FriendQuestView | null }) {
  if (!friend) {
    return (
      <Window title="친구 퀘스트" bodyClassName="p-4">
        <p className="text-body text-ink-2">친구를 추가하면 다음 퀘스트가 시작돼요</p>
        <Link href="/friends" className="btn-outline mt-3 inline-flex">
          친구 찾기
        </Link>
      </Window>
    );
  }
  const total = friend.mine + friend.theirs;
  const shown = Math.min(total, friend.goal);
  const pct = friend.goal > 0 ? Math.round((shown / friend.goal) * 100) : 0;
  const daysLeft = Math.max(1, Math.ceil((new Date(friend.endsAt).getTime() - Date.now()) / 86_400_000));
  return (
    <Window title="친구 퀘스트" bodyClassName="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-body">{friend.partner.nickname}님과 함께</span>
        <span className="flex shrink-0 items-center gap-1">
          {friend.done && (
            <>
              <CheckIcon size={16} strokeWidth={3} />
              <span className="sr-only">완료</span>
            </>
          )}
          <span className="bit">
            {shown}/{friend.goal}
          </span>
        </span>
      </div>
      <div className="meter mt-2" role="progressbar" aria-label="친구와 레슨 15개" aria-valuemin={0} aria-valuemax={friend.goal} aria-valuenow={shown}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-body text-ink-2">
        <span className="min-w-0 truncate">
          나 {friend.mine} · {friend.partner.nickname} {friend.theirs}
        </span>
        <span className="shrink-0">{daysLeft}일 남음</span>
      </div>
    </Window>
  );
}
