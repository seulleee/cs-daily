import { z } from 'zod';

export const QuestKey = z.enum(['lessons', 'xp', 'perfect', 'review', 'accurate']);
export type QuestKey = z.infer<typeof QuestKey>;

/** 오늘의 퀘스트 한 칸 */
export const DailyQuest = z.object({
  key: QuestKey,
  title: z.string(),
  progress: z.number().int(),
  goal: z.number().int(),
  done: z.boolean(),
  xp: z.number().int(),
});
export type DailyQuest = z.infer<typeof DailyQuest>;

/** 레슨 완료 응답에 실리는 이번에 지급된 퀘스트 보상 */
export const QuestRewardItem = z.object({
  key: z.union([QuestKey, z.literal('friend')]),
  title: z.string(),
  xp: z.number().int(),
});
export type QuestRewardItem = z.infer<typeof QuestRewardItem>;

/** 이번 주 친구 퀘스트. 짝과 레슨 수를 합쳐 목표를 채운다. 끝난(친구를 끊은) 퀘스트는 내려가지 않는다 */
export const FriendQuestView = z.object({
  partner: z.object({ nickname: z.string(), avatarUrl: z.string().nullable() }),
  mine: z.number().int(),
  theirs: z.number().int(),
  goal: z.number().int(),
  done: z.boolean(),
  /** 이번 주가 끝나는 시각(서울 다음 월요일 00:00, ISO UTC) */
  endsAt: z.string(),
});
export type FriendQuestView = z.infer<typeof FriendQuestView>;

/** GET /me/quests */
export const MeQuestsResponse = z.object({
  date: z.string(),
  daily: z.array(DailyQuest),
  friend: FriendQuestView.nullable(),
});
export type MeQuestsResponse = z.infer<typeof MeQuestsResponse>;
