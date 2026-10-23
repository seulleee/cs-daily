import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { addDaysToLocalDate, localDateOf } from '../../../shared/domain/local-date';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { COHORT_WEEKS, foldCohorts, recentCohortWeeks, type CohortRetention, type SignupDayRow } from '../domain/usage-stats';

export class GetUsageStatsQuery {
  constructor(readonly now: Date) {}
}

export interface UsageStats {
  at: string;
  definitions: Record<string, string>;
  users: { total: number; active1d: number; active7d: number; active30d: number };
  retention: { cohortWeeks: CohortRetention[] };
  tracks: { slug: string; name: string; startedUsers: number; completedLessons: number; completedLessonsLast7d: number }[];
  streaks: { atLeast3: number; atLeast7: number };
}

/** 코호트·리텐션 날짜 계산의 기본 타임존 (User.timezone이 비정상이면 이쪽으로) */
const DEFAULT_TZ = 'Asia/Seoul';

const DEFINITIONS = {
  active: '레슨 또는 복습 세션(placement 제외)을 1개 이상 끝낸 사용자. 최근 1·7·30일은 현재 시각 기준 24h·7d·30d 롤링',
  retention:
    '가입 코호트(사용자 로컬 가입일이 속한 월요일 시작 주) 중 D{n}일째 로컬 날짜에 레슨/복습 세션을 끝낸 비율. 분모(eligible)는 D{n} 날짜가 로컬 기준으로 이미 지난 가입자만',
  tracks: 'startedUsers=트랙 선택 사용자, completedLessons=레슨 완료(건너뛰기 테스트 통과로 처리된 것 포함), completedLessonsLast7d=최근 7일 최초 완료',
  streaks: 'user_stats.current_streak 기준 현재 스트릭',
};

/**
 * 운영자용 사용 지표 (집계만, 개인 식별 정보 없음).
 * 운영 DB 왕복 지연 때문에 행 단위 루프 없이 집계 SQL 몇 개를 한 번에 병렬로 보낸다.
 */
@QueryHandler(GetUsageStatsQuery)
export class GetUsageStatsHandler implements IQueryHandler<GetUsageStatsQuery, UsageStats> {
  constructor(private readonly uow: UnitOfWork) {}

  async execute({ now }: GetUsageStatsQuery): Promise<UsageStats> {
    const db = this.uow.client;
    const today = localDateOf(now, DEFAULT_TZ);
    const weeks = recentCohortWeeks(today, COHORT_WEEKS);
    // 타임존 차이로 가입 로컬 날짜가 하루 어긋날 수 있어 하루 여유를 두고 읽고, 접을 때 주 밖 행을 버린다
    const cohortFrom = new Date(`${addDaysToLocalDate(weeks[0]!, -1)}T00:00:00Z`);
    const finishedLearning = `s.finished_at IS NOT NULL AND s.kind IN ('lesson','review')`;

    const [users, retentionRows, tracks, streaks] = await Promise.all([
      db.$queryRawUnsafe<{ total: number; a1: number; a7: number; a30: number }[]>(
        `SELECT (SELECT count(*) FROM users)::int AS total,
                count(DISTINCT s.user_id) FILTER (WHERE s.finished_at >= $1::timestamptz - interval '1 day')::int AS a1,
                count(DISTINCT s.user_id) FILTER (WHERE s.finished_at >= $1::timestamptz - interval '7 days')::int AS a7,
                count(DISTINCT s.user_id)::int AS a30
           FROM lesson_sessions s
          WHERE ${finishedLearning} AND s.finished_at >= $1::timestamptz - interval '30 days'`,
        now,
      ),
      db.$queryRawUnsafe<{ signup: string; users: number; e1: number; r1: number; e7: number; r7: number; e30: number; r30: number }[]>(
        `WITH u AS (
           SELECT x.id,
                  COALESCE(z.name, '${DEFAULT_TZ}') AS tz,
                  (x.created_at AT TIME ZONE COALESCE(z.name, '${DEFAULT_TZ}'))::date AS signup,
                  ($2::timestamptz AT TIME ZONE COALESCE(z.name, '${DEFAULT_TZ}'))::date AS today
             FROM users x LEFT JOIN pg_timezone_names z ON z.name = x.timezone
            WHERE x.created_at >= $1::timestamptz
         ), act AS (
           SELECT DISTINCT s.user_id, (s.finished_at AT TIME ZONE u.tz)::date AS d
             FROM lesson_sessions s JOIN u ON u.id = s.user_id
            WHERE ${finishedLearning}
         )
         SELECT u.signup::text AS signup, count(*)::int AS users,
                count(*) FILTER (WHERE u.signup + 1 < u.today)::int AS e1,   count(a1.user_id)::int AS r1,
                count(*) FILTER (WHERE u.signup + 7 < u.today)::int AS e7,   count(a7.user_id)::int AS r7,
                count(*) FILTER (WHERE u.signup + 30 < u.today)::int AS e30, count(a30.user_id)::int AS r30
           FROM u
           LEFT JOIN act a1  ON a1.user_id  = u.id AND a1.d  = u.signup + 1
           LEFT JOIN act a7  ON a7.user_id  = u.id AND a7.d  = u.signup + 7
           LEFT JOIN act a30 ON a30.user_id = u.id AND a30.d = u.signup + 30
          GROUP BY u.signup
          ORDER BY u.signup`,
        cohortFrom,
        now,
      ),
      db.$queryRawUnsafe<{ slug: string; name: string; started: number; completed: number; completed7: number }[]>(
        `SELECT t.slug, t.name,
                (SELECT count(*) FROM user_tracks ut WHERE ut.track_id = t.id)::int AS started,
                count(p.user_id)::int AS completed,
                count(p.user_id) FILTER (WHERE p.completed_at >= $1::timestamptz - interval '7 days')::int AS completed7
           FROM tracks t
           LEFT JOIN units un ON un.track_id = t.id AND un.sort_order > 0
           LEFT JOIN lessons l ON l.unit_id = un.id AND l.sort_order > 0
           LEFT JOIN user_lesson_progress p ON p.lesson_id = l.id AND p.completed_at IS NOT NULL
          GROUP BY t.id, t.slug, t.name, t.sort_order
          ORDER BY t.sort_order`,
        now,
      ),
      db.$queryRawUnsafe<{ s3: number; s7: number }[]>(
        `SELECT count(*) FILTER (WHERE current_streak >= 3)::int AS s3, count(*) FILTER (WHERE current_streak >= 7)::int AS s7 FROM user_stats`,
      ),
    ]);

    const rows: SignupDayRow[] = retentionRows.map((r) => ({
      signup: r.signup,
      users: r.users,
      eligible: { 1: r.e1, 7: r.e7, 30: r.e30 },
      retained: { 1: r.r1, 7: r.r7, 30: r.r30 },
    }));

    return {
      at: now.toISOString(),
      definitions: DEFINITIONS,
      users: { total: users[0]?.total ?? 0, active1d: users[0]?.a1 ?? 0, active7d: users[0]?.a7 ?? 0, active30d: users[0]?.a30 ?? 0 },
      retention: { cohortWeeks: foldCohorts(rows, weeks) },
      tracks: tracks.map((t) => ({ slug: t.slug, name: t.name, startedUsers: t.started, completedLessons: t.completed, completedLessonsLast7d: t.completed7 })),
      streaks: { atLeast3: streaks[0]?.s3 ?? 0, atLeast7: streaks[0]?.s7 ?? 0 },
    };
  }
}
