import type { DayActivity } from './daily-quests';

/** 퀘스트 보상 XP를 원장에 넣는 포트. Progression 컨텍스트가 구현한다. */
export interface XpLedgerPort {
  credit(input: { userId: string; amount: number; reason: 'quest'; at: Date }): Promise<void>;
}
export const XP_LEDGER_PORT = Symbol('XP_LEDGER_PORT');

/** 하루 학습 활동 집계. [from, to)에 finished_at이 든 세션만 센다. */
export interface QuestActivityPort {
  dayActivity(userId: string, from: Date, to: Date): Promise<DayActivity>;
  dailyGoalOf(userId: string): Promise<number>;
}
export const QUEST_ACTIVITY_PORT = Symbol('QUEST_ACTIVITY_PORT');

export interface QuestRewardRepository {
  /** 처음 지급이면 true, 이미 지급된 (user, key, period)면 false */
  tryInsert(r: { userId: string; questKey: string; period: string; xp: number }): Promise<boolean>;
  grantedKeys(userId: string, period: string): Promise<string[]>;
}
export const QUEST_REWARD_REPO = Symbol('QUEST_REWARD_REPO');
