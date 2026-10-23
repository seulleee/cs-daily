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

/** 프리미엄 사전 신청 — 관심 항목 (결제 없음, 수요 검증용) */
export const PREMIUM_INTERESTS = ['aws', 'security', 'coding_test', 'eip', 'review_tools'] as const;
export const PremiumInterestKey = z.enum(PREMIUM_INTERESTS);
export type PremiumInterestKey = z.infer<typeof PremiumInterestKey>;
export const PREMIUM_INTEREST_LABEL: Record<PremiumInterestKey, string> = {
  aws: 'AWS 트랙',
  security: '보안 트랙',
  coding_test: '코딩 테스트',
  eip: '정보처리기사',
  review_tools: '오답 노트·복습 기능',
};

/** 월 가격 의향 구간 */
export const PREMIUM_PRICE_BANDS = ['free_only', 'lte_3000', 'from_3000_to_6000', 'from_6000_to_10000', 'gt_10000'] as const;
export const PremiumPriceBand = z.enum(PREMIUM_PRICE_BANDS);
export type PremiumPriceBand = z.infer<typeof PremiumPriceBand>;
export const PREMIUM_PRICE_BAND_LABEL: Record<PremiumPriceBand, string> = {
  free_only: '무료일 때만',
  lte_3000: '3,000원 이하',
  from_3000_to_6000: '3,000~6,000원',
  from_6000_to_10000: '6,000~10,000원',
  gt_10000: '10,000원 이상',
};

/** PUT /me/premium-interest */
export const PremiumInterestRequest = z.object({
  interests: z
    .array(PremiumInterestKey)
    .min(1)
    .max(PREMIUM_INTERESTS.length)
    .refine((a) => new Set(a).size === a.length, '중복된 항목이 있어요'),
  priceBand: PremiumPriceBand,
  /** 출시 알림 이메일 수신 동의. 명시적으로 켠 경우에만 true */
  notifyConsent: z.boolean(),
});
export type PremiumInterestRequest = z.infer<typeof PremiumInterestRequest>;

/** 저장된 사전 신청 상태 (GET /me, PUT /me/premium-interest 응답) */
export const PremiumInterestState = PremiumInterestRequest.extend({
  updatedAt: z.string(),
});
export type PremiumInterestState = z.infer<typeof PremiumInterestState>;

/** GET /me */
export const MeResponse = z.object({
  user: UserProfile,
  stats: UserStats,
  today: TodayActivity,
  tracks: z.array(TrackSummary),
  dueReviewCount: z.number().int(),
  /** 프리미엄 사전 신청 상태. 신청 전이면 null (옛 API 호환을 위해 생략될 수 있음) */
  premiumInterest: PremiumInterestState.nullable().optional(),
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
