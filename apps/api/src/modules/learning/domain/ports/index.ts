import type { QuestionType } from '@cs-daily/contracts';
import type { LessonSession } from '../lesson-session.aggregate';
import type { LessonId, QuestionId, SessionId, UserId } from '../../../../shared/domain/ids';
import type { SessionKind } from '../services/session-kind';

// ---- 영속 포트 (infrastructure/persistence가 구현) ----
export interface LessonSessionRepository {
  findById(id: SessionId): Promise<LessonSession | null>;
  /** 사용자의 미완료 세션 (레슨·종류 지정 시 그것만) */
  findOpen(userId: UserId, lessonId?: LessonId, kind?: SessionKind): Promise<LessonSession | null>;
  save(session: LessonSession): Promise<void>;
  /** 오늘(사용자 로컬 날짜) 같은 레슨을 완료한 횟수 — XP 파밍 방지 */
  countCompletedToday(userId: UserId, lessonId: LessonId, localDate: string, timeZone: string): Promise<number>;
}
export const LESSON_SESSION_REPO = Symbol('LESSON_SESSION_REPO');

// ---- 컨텍스트 간 포트 (ACL). Curriculum 모듈이 구현체를 export ----
export interface QuestionForGrading {
  id: QuestionId;
  type: QuestionType;
  version: number;
  answerKey: unknown;
  explanation: string;
}
export interface QuestionPublic {
  id: string;
  type: QuestionType;
  content: unknown;
  difficulty: number;
}
export interface LessonOutline {
  id: number;
  name: string;
  trackId: number;
  unitSortOrder: number;
  lessonSortOrder: number;
  questionCount: number;
}
export interface UnitOutline {
  id: number;
  name: string;
  trackId: number;
  sortOrder: number;
  /** 유닛 안 레슨 id (sort_order 순) */
  lessonIds: number[];
  /** 트랙 처음부터 이 유닛 끝까지의 레슨 id — 건너뛰기 통과 시 완료 처리 대상 */
  lessonIdsThroughUnit: number[];
}
export interface QuestionGradingPort {
  forGrading(id: QuestionId): Promise<QuestionForGrading>;
}
export const QUESTION_GRADING_PORT = Symbol('QUESTION_GRADING_PORT');

export interface CurriculumQueryPort {
  lessonOutline(lessonId: LessonId): Promise<LessonOutline | null>;
  unitOutline(unitId: number): Promise<UnitOutline | null>;
  /** 레슨이 속한 유닛 (건너뛰기 세션은 유닛의 마지막 레슨 id로 저장된다) */
  unitOfLesson(lessonId: LessonId): Promise<UnitOutline | null>;
  /** published 문제 id를 sort_order 순으로 */
  publishedQuestionIds(lessonId: LessonId): Promise<string[]>;
  /** 이 레슨이 사용자에게 열려 있는가 (앞 레슨 완료 또는 첫 레슨) */
  isLessonUnlocked(userId: UserId, lessonId: LessonId): Promise<boolean>;
  publicQuestions(ids: string[]): Promise<QuestionPublic[]>;
}
export const CURRICULUM_QUERY_PORT = Symbol('CURRICULUM_QUERY_PORT');

// ---- Identity 컨텍스트 포트: 타임존·데일리 목표 ----
export interface UserPrefs {
  timeZone: string;
  dailyGoal: number;
}
export interface UserPrefsPort {
  prefsOf(userId: UserId): Promise<UserPrefs>;
}
export const USER_PREFS_PORT = Symbol('USER_PREFS_PORT');

// ---- Review 컨텍스트 포트: 복습 예정 문제 ----
export interface ReviewQueuePort {
  dueQuestionIds(userId: UserId, limit: number, now: Date): Promise<string[]>;
}
export const REVIEW_QUEUE_PORT = Symbol('REVIEW_QUEUE_PORT');
