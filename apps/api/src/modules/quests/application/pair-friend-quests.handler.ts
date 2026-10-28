import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { addDaysToLocalDate } from '../../../shared/domain/local-date';
import { ACTIVE_DAYS, pairFriends, weekStartSeoul } from '../domain/friend-quests';
import { FRIENDS_PORT, FRIEND_QUEST_REPO, type FriendQuestRepository, type FriendsPort } from '../domain/ports';
import { PairFriendQuestsCommand } from './commands';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 최근 14일 안에 레슨을 끝냈고 이번 주 멤버가 아닌 사용자끼리, 친구 중에서 짝을 짓는다. 재실행해도 이미 멤버인 사람은 건너뛴다. */
@CommandHandler(PairFriendQuestsCommand)
export class PairFriendQuestsHandler implements ICommandHandler<PairFriendQuestsCommand, { weekStart: string; pairs: number }> {
  constructor(
    @Inject(FRIEND_QUEST_REPO) private readonly repo: FriendQuestRepository,
    @Inject(FRIENDS_PORT) private readonly friends: FriendsPort,
  ) {}

  async execute({ now }: PairFriendQuestsCommand) {
    const weekStart = weekStartSeoul(now);
    const [active, members, lastPairs] = await Promise.all([
      this.repo.activeUserIds(new Date(now.getTime() - ACTIVE_DAYS * DAY_MS), now),
      this.repo.memberIdsOfWeek(weekStart),
      this.repo.pairsOfWeek(addDaysToLocalDate(weekStart, -7)),
    ]);
    const candidates = active.filter((id) => !members.has(id));
    if (candidates.length < 2) return { weekStart, pairs: 0 };

    const friendMap = await this.friends.friendIdsOf(candidates);
    const lastWeek = new Map<string, string>();
    for (const [a, b] of lastPairs) {
      lastWeek.set(a, b);
      lastWeek.set(b, a);
    }
    const pairs = pairFriends(
      candidates.map((id) => ({ id, friendIds: friendMap.get(id) ?? [] })),
      lastWeek,
    );
    let created = 0;
    for (const [a, b] of pairs) if (await this.repo.createPair(weekStart, a, b)) created++;
    return { weekStart, pairs: created };
  }
}
