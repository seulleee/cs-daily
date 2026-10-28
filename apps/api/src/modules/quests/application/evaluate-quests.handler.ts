import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import type { QuestRewardItem } from '@cs-daily/contracts';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { USER_PREFS_PORT, type UserPrefsPort } from '../../learning/domain/ports';
import { DAILY_QUEST_XP, goalOf, progressOf, titleOf } from '../domain/daily-quests';
import { DAILY_PICK_REPO, QUEST_ACTIVITY_PORT, QUEST_REWARD_REPO, XP_LEDGER_PORT, type DailyPickRepository, type QuestActivityPort, type QuestRewardRepository, type XpLedgerPort } from '../domain/ports';
import { EvaluateQuestsCommand } from './commands';
import { loadDayContext } from './day-context';

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
  ) {}

  async execute({ userId, at }: EvaluateQuestsCommand): Promise<QuestRewardItem[]> {
    return this.uow.run(async () => {
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
      return granted;
    });
  }
}
