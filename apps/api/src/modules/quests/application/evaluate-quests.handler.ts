import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import type { QuestRewardItem } from '@cs-daily/contracts';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { USER_PREFS_PORT, type UserPrefsPort } from '../../learning/domain/ports';
import { DAILY_QUEST_XP, goalOf, progressOf, titleOf } from '../domain/daily-quests';
import { FRIEND_QUEST_KEY, FRIEND_QUEST_TITLE, FRIEND_QUEST_XP } from '../domain/friend-quests';
import { DAILY_PICK_REPO, FRIEND_QUEST_REPO, QUEST_ACTIVITY_PORT, QUEST_REWARD_REPO, XP_LEDGER_PORT, type DailyPickRepository, type FriendQuestRepository, type QuestActivityPort, type QuestRewardRepository, type XpLedgerPort } from '../domain/ports';
import { EvaluateQuestsCommand } from './commands';
import { loadDayContext } from './day-context';
import { loadFriendQuest } from './friend-quest-state';

/** 오늘의 퀘스트 중 목표를 채운 것에 XP를 한 번만 지급한다. 지급 기록(tryInsert)이 먼저, XP 적립은 true일 때만. */
@CommandHandler(EvaluateQuestsCommand)
export class EvaluateQuestsHandler implements ICommandHandler<EvaluateQuestsCommand, QuestRewardItem[]> {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(USER_PREFS_PORT) private readonly prefs: UserPrefsPort,
    @Inject(QUEST_ACTIVITY_PORT) private readonly activity: QuestActivityPort,
    @Inject(QUEST_REWARD_REPO) private readonly rewards: QuestRewardRepository,
    @Inject(XP_LEDGER_PORT) private readonly ledger: XpLedgerPort,
    @Inject(DAILY_PICK_REPO) private readonly picks: DailyPickRepository,
    private readonly queryBus: QueryBus,
    @Inject(FRIEND_QUEST_REPO) private readonly friendQuests: FriendQuestRepository,
  ) {}

  async execute({ userId, at }: EvaluateQuestsCommand): Promise<QuestRewardItem[]> {
    return this.uow.run(async () => {
      // 친구 퀘스트를 먼저: 두 사람 몫을 id 순으로 잠가서, 동시에 평가하는 짝과 락 순서가 같다(교착 방지)
      const friendReward = await this.evaluateFriend(userId, at);
      const ctx = await loadDayContext(this.prefs, this.activity, this.picks, this.queryBus, userId, at);
      const granted: QuestRewardItem[] = [];
      for (const key of ctx.keys) {
        const goal = goalOf(key, ctx.dailyGoal);
        if (progressOf(key, ctx.activity) < goal) continue;
        const inserted = await this.rewards.tryInsert({ userId, questKey: key, period: ctx.localDate, xp: DAILY_QUEST_XP });
        if (!inserted) continue;
        await this.ledger.credit({ userId, amount: DAILY_QUEST_XP, reason: 'quest', at });
        granted.push({ key, title: titleOf(key, goal), xp: DAILY_QUEST_XP });
      }
      if (friendReward) granted.push(friendReward);
      return granted;
    });
  }

  /** 이번 주 합계가 목표 이상이면 두 사람 모두에게 한 번씩 지급한다. 응답에는 호출자 몫만 돌려준다. */
  private async evaluateFriend(userId: string, at: Date): Promise<QuestRewardItem | null> {
    const state = await loadFriendQuest(this.friendQuests, userId, at);
    if (!state || !state.view.done) return null;
    let mine: QuestRewardItem | null = null;
    for (const memberId of state.memberIds) {
      const inserted = await this.rewards.tryInsert({ userId: memberId, questKey: FRIEND_QUEST_KEY, period: state.weekStart, xp: FRIEND_QUEST_XP });
      if (!inserted) continue;
      await this.ledger.credit({ userId: memberId, amount: FRIEND_QUEST_XP, reason: 'quest', at });
      if (memberId === userId) mine = { key: 'friend', title: FRIEND_QUEST_TITLE, xp: FRIEND_QUEST_XP };
    }
    return mine;
  }
}
