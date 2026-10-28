import type { FriendQuestView } from '@cs-daily/contracts';
import { weekRangeUtc, weekStartSeoul } from '../domain/friend-quests';
import type { FriendQuestRepository } from '../domain/ports';

export interface FriendQuestState {
  weekStart: string;
  /** id 순 정렬(보상 지급 때 락 순서를 맞춘다) */
  memberIds: string[];
  view: FriendQuestView;
}

/** 이번 주(서울) 진행 중인 친구 퀘스트와 두 사람의 레슨 수. 없으면 null. */
export async function loadFriendQuest(repo: FriendQuestRepository, userId: string, at: Date): Promise<FriendQuestState | null> {
  const weekStart = weekStartSeoul(at);
  const quest = await repo.activeQuestOf(userId, weekStart);
  const partner = quest?.members.find((m) => m.userId !== userId);
  if (!quest || !partner || !quest.members.some((m) => m.userId === userId)) return null;
  const { from, to } = weekRangeUtc(weekStart);
  const counts = await repo.lessonCounts(
    quest.members.map((m) => m.userId),
    from,
    to,
  );
  const mine = counts.get(userId) ?? 0;
  const theirs = counts.get(partner.userId) ?? 0;
  return {
    weekStart,
    memberIds: quest.members.map((m) => m.userId).sort(),
    view: {
      partner: { nickname: partner.nickname, avatarUrl: partner.avatarUrl },
      mine,
      theirs,
      goal: quest.goal,
      done: mine + theirs >= quest.goal,
      endsAt: to.toISOString(),
    },
  };
}
