import type { QueryBus } from '@nestjs/cqrs';
import type { QuestKey } from '@cs-daily/contracts';
import { addDaysToLocalDate, localDateOf, zonedMidnightToUtc } from '../../../shared/domain/local-date';
import { UserId } from '../../../shared/domain/ids';
import type { UserPrefsPort } from '../../learning/domain/ports';
import { CountDueReviewsQuery } from '../../review/application/queries/queries';
import { pickDailyQuests, type DayActivity } from '../domain/daily-quests';
import type { QuestActivityPort } from '../domain/ports';

export interface DayContext {
  localDate: string;
  keys: QuestKey[];
  activity: DayActivity;
  dailyGoal: number;
}

/** 사용자 로컬 날짜의 활동 집계와 그날의 퀘스트 3개. review 자격은 "끝까지 due>0 또는 오늘 복습 완료>0". */
export async function loadDayContext(
  prefs: UserPrefsPort,
  activityPort: QuestActivityPort,
  queryBus: QueryBus,
  userId: string,
  at: Date,
): Promise<DayContext> {
  const { timeZone } = await prefs.prefsOf(UserId.of(userId));
  const localDate = localDateOf(at, timeZone);
  const from = zonedMidnightToUtc(localDate, timeZone);
  const to = zonedMidnightToUtc(addDaysToLocalDate(localDate, 1), timeZone);
  const [activity, dailyGoal, due] = await Promise.all([
    activityPort.dayActivity(userId, from, to),
    activityPort.dailyGoalOf(userId),
    queryBus.execute<CountDueReviewsQuery, number>(new CountDueReviewsQuery(userId, to)),
  ]);
  const keys = pickDailyQuests(userId, localDate, { reviewEligible: due > 0 || activity.reviews > 0 });
  return { localDate, keys, activity, dailyGoal };
}
