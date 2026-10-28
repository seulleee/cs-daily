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

/** 친구 관계 조회 포트. Social 컨텍스트가 구현한다. */
export interface FriendsPort {
  /** 수락된 친구 id 목록. 친구가 없는 사용자도 빈 배열로 키를 가진다. */
  friendIdsOf(userIds: string[]): Promise<Map<string, string[]>>;
  areFriends(a: string, b: string): Promise<boolean>;
}
export const FRIENDS_PORT = Symbol('FRIENDS_PORT');

export interface ActiveFriendQuest {
  goal: number;
  members: { userId: string; nickname: string; avatarUrl: string | null }[];
}

export interface FriendQuestRepository {
  /** [from, to)에 kind=lesson 세션을 완료한 사용자 id */
  activeUserIds(from: Date, to: Date): Promise<string[]>;
  /** 그 주(서울 월요일 YYYY-MM-DD)에 퀘스트 멤버인 모든 사용자 id */
  memberIdsOfWeek(weekStart: string): Promise<Set<string>>;
  /** 그 주 퀘스트의 짝 목록 [userA, userB] */
  pairsOfWeek(weekStart: string): Promise<[string, string][]>;
  /** 퀘스트 1행 + 멤버 2행을 한 트랜잭션에 만든다. 둘 중 한 명이라도 이미 그 주 멤버면 아무것도 만들지 않고 false. */
  createPair(weekStart: string, a: string, b: string): Promise<boolean>;
  /** 그 주에 사용자가 속한, 아직 끝나지 않은(endedAt=null) 퀘스트. 없으면 null. */
  activeQuestOf(userId: string, weekStart: string): Promise<ActiveFriendQuest | null>;
  /** [from, to)에 kind=lesson 세션을 완료한 수 (사용자별, 없으면 0) */
  lessonCounts(userIds: string[], from: Date, to: Date): Promise<Map<string, number>>;
  /** 두 사람이 같은 그 주 퀘스트에 있고 아직 안 끝났으면 endedAt을 찍는다 */
  endSharedQuest(weekStart: string, a: string, b: string, at: Date): Promise<void>;
}
export const FRIEND_QUEST_REPO = Symbol('FRIEND_QUEST_REPO');
