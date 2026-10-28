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

/** GET /me/quests (friend는 프렌즈 퀘스트 작업에서 채운다) */
export const MeQuestsResponse = z.object({
  date: z.string(),
  daily: z.array(DailyQuest),
  friend: z.null(),
});
export type MeQuestsResponse = z.infer<typeof MeQuestsResponse>;
