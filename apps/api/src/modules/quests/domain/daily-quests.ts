import type { QuestKey } from '@cs-daily/contracts';

export const DAILY_QUEST_XP = 10;
export const DAILY_QUEST_COUNT = 3;

const CANDIDATES: readonly QuestKey[] = ['lessons', 'xp', 'perfect', 'review', 'accurate'];

function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 사용자·로컬 날짜로 고정되는 오늘의 퀘스트 3개. 같은 입력이면 항상 같은 결과. */
export function pickDailyQuests(userId: string, localDate: string, opts: { reviewEligible: boolean }): QuestKey[] {
  const pool = CANDIDATES.filter((k) => opts.reviewEligible || k !== 'review');
  const rand = mulberry32(fnv1a32(`${userId}:${localDate}`));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, DAILY_QUEST_COUNT);
}

export function goalOf(key: QuestKey, dailyGoal: number): number {
  switch (key) {
    case 'lessons':
      return dailyGoal + 1;
    case 'xp':
      return 30;
    case 'perfect':
    case 'review':
      return 1;
    case 'accurate':
      return 2;
  }
}

export function titleOf(key: QuestKey, goal: number): string {
  switch (key) {
    case 'lessons':
      return `레슨 ${goal}개 완료하기`;
    case 'xp':
      return `XP ${goal} 모으기`;
    case 'perfect':
      return `100점 레슨 ${goal}개`;
    case 'review':
      return `복습 ${goal}회 하기`;
    case 'accurate':
      return `정답률 90% 이상 레슨 ${goal}개`;
  }
}

/** 하루 활동 집계. xpExcludingQuest는 퀘스트 보상 XP를 뺀 값(보상이 보상을 부르지 않게). */
export interface DayActivity {
  lessons: number;
  perfect: number;
  accurate: number;
  reviews: number;
  xpExcludingQuest: number;
}

export function progressOf(key: QuestKey, a: DayActivity): number {
  switch (key) {
    case 'lessons':
      return a.lessons;
    case 'xp':
      return a.xpExcludingQuest;
    case 'perfect':
      return a.perfect;
    case 'review':
      return a.reviews;
    case 'accurate':
      return a.accurate;
  }
}
