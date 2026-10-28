import type { QueryBus } from '@nestjs/cqrs';
import type { QuestKey } from '@cs-daily/contracts';
import { addDaysToLocalDate, localDateOf, zonedMidnightToUtc } from '../../../shared/domain/local-date';
import { UserId } from '../../../shared/domain/ids';
import type { UserPrefsPort } from '../../learning/domain/ports';
import { CountDueReviewsQuery } from '../../review/application/queries/queries';
import { pickDailyQuests, type DayActivity } from '../domain/daily-quests';
import type { DailyPickRepository, QuestActivityPort } from '../domain/ports';

export interface DayContext {
  localDate: string;
  keys: QuestKey[];
  activity: DayActivity;
  dailyGoal: number;
}

/** 사용자 로컬 날짜의 활동 집계와 그날의 퀘스트 3개(저장해 고정). review 자격은 "끝까지 due>0 또는 오늘 복습 완료>0". */
export async function loadDayContext(
  prefs: UserPrefsPort,
  activityPort: QuestActivityPort,
  picks: DailyPickRepository,
  queryBus: QueryBus,
  userId: string,
  at: Date,
): Promise<DayContext> {
  const { timeZone } = await prefs.prefsOf(UserId.of(userId));
  const localDate = localDateOf(at, timeZone);
  const from = zonedMidnightToUtc(localDate, timeZone);
  const to = zonedMidnightToUtc(addDaysToLocalDate(localDate, 1), timeZone);
  const [activity, dailyGoal] = await Promise.all([activityPort.dayActivity(userId, from, to), activityPort.dailyGoalOf(userId)]);
  // 그날 처음 볼 때 한 번만 계산해 저장한다. 이미 있으면 due 조회도 하지 않는다.
  const keys = await picks.getOrCreate(userId, localDate, async () => {
    const due = await queryBus.execute<CountDueReviewsQuery, number>(new CountDueReviewsQuery(userId, to));
    return pickDailyQuests(userId, localDate, { reviewEligible: due > 0 || activity.reviews > 0 });
  });
  return { localDate, keys, activity, dailyGoal };
}
