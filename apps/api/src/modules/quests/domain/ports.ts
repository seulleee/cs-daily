import type { QuestKey } from '@cs-daily/contracts';
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
}
export const QUEST_REWARD_REPO = Symbol('QUEST_REWARD_REPO');

/** 그날 뽑은 데일리 퀘스트 키를 (사용자, 날짜)별로 고정해 저장한다. */
export interface DailyPickRepository {
  /** 저장된 값이 있으면 그것을, 없으면 compute()로 계산해 저장한 뒤 다시 읽은 값을 돌려준다(동시 요청에도 하루 한 조합). */
  getOrCreate(userId: string, period: string, compute: () => Promise<QuestKey[]>): Promise<QuestKey[]>;
}
export const DAILY_PICK_REPO = Symbol('DAILY_PICK_REPO');
