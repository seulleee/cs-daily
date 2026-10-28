import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import type { MeQuestsResponse } from '@cs-daily/contracts';
import { USER_PREFS_PORT, type UserPrefsPort } from '../../learning/domain/ports';
import { DAILY_QUEST_XP, goalOf, progressOf, titleOf } from '../domain/daily-quests';
import { QUEST_ACTIVITY_PORT, DAILY_PICK_REPO, FRIEND_QUEST_REPO, type FriendQuestRepository, type DailyPickRepository, type QuestActivityPort } from '../domain/ports';
import { GetMyQuestsQuery } from './commands';
import { loadDayContext } from './day-context';
import { loadFriendQuest } from './friend-quest-state';

@QueryHandler(GetMyQuestsQuery)
export class GetMyQuestsHandler implements IQueryHandler<GetMyQuestsQuery, MeQuestsResponse> {
  constructor(
    @Inject(USER_PREFS_PORT) private readonly prefs: UserPrefsPort,
    @Inject(QUEST_ACTIVITY_PORT) private readonly activity: QuestActivityPort,
    @Inject(DAILY_PICK_REPO) private readonly picks: DailyPickRepository,
    private readonly queryBus: QueryBus,
    @Inject(FRIEND_QUEST_REPO) private readonly friendQuests: FriendQuestRepository,
  ) {}

  async execute({ userId, at }: GetMyQuestsQuery): Promise<MeQuestsResponse> {
    const ctx = await loadDayContext(this.prefs, this.activity, this.picks, this.queryBus, userId, at);
    const daily = ctx.keys.map((key) => {
      const goal = goalOf(key, ctx.dailyGoal);
      const raw = progressOf(key, ctx.activity);
      return { key, title: titleOf(key, goal), progress: Math.min(raw, goal), goal, done: raw >= goal, xp: DAILY_QUEST_XP };
    });
    const friend = (await loadFriendQuest(this.friendQuests, userId, at))?.view ?? null;
    return { date: ctx.localDate, daily, friend };
  }
}
