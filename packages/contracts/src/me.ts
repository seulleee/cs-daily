import { z } from 'zod';
import { TrackSummary } from './curriculum.js';
import { CodingLanguage } from './questions.js';

export const UserProfile = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nickname: z.string(),
  avatarUrl: z.string().url().nullable(),
  timezone: z.string(),
  /** 하루 목표 레슨 수 (1/2/3) */
  dailyGoal: z.number().int().min(1).max(3),
  /** "HH:mm" 로컬 시각, null이면 리마인더 끔 */
  reminderAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  role: z.enum(['user', 'admin']),
  /** 코딩 테스트(ct) 트랙 코드 문제를 풀 언어 */
  codeLanguage: CodingLanguage,
  /** 닉네임 검색에 노출되는지 */
  discoverable: z.boolean(),
});

export const UserStats = z.object({
  totalXp: z.number().int(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  freezeCount: z.number().int(),
  lastActiveDate: z.string().nullable(),
});

export const TodayActivity = z.object({
  date: z.string(),
  xp: z.number().int(),
  lessonsCompleted: z.number().int(),
  goalAchieved: z.boolean(),
});

/** GET /me */
export const MeResponse = z.object({
  user: UserProfile,
  stats: UserStats,
  today: TodayActivity,
  tracks: z.array(TrackSummary),
  dueReviewCount: z.number().int(),
});
export type MeResponse = z.infer<typeof MeResponse>;

/** PATCH /me */
export const UpdateMeRequest = z
  .object({
    nickname: z.string().min(2).max(30).regex(/^[\p{L}\p{N}_-]+$/u),
    timezone: z.string().min(1).max(64),
    dailyGoal: z.number().int().min(1).max(3),
    reminderAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    codeLanguage: CodingLanguage,
    discoverable: z.boolean(),
  })
  .partial();
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

/** GET /me/stats/calendar?month=YYYY-MM */
export const CalendarResponse = z.object({
  month: z.string(),
  days: z.array(
    z.object({
      date: z.string(),
      xp: z.number().int(),
      achieved: z.boolean(),
      usedFreeze: z.boolean(),
    }),
  ),
});

/** GET /review/due */
export const ReviewDueResponse = z.object({
  count: z.number().int(),
  byTrack: z.array(z.object({ trackSlug: z.string(), trackName: z.string(), count: z.number().int() })),
});
