import { DomainEvent } from '../../../../shared/domain/domain-event';
import type { SessionKind } from '../services/session-kind';

export class SessionStarted extends DomainEvent {
  constructor(
    readonly payload: { sessionId: string; userId: string; kind: SessionKind; lessonId: number | null },
    occurredAt?: Date,
  ) {
    super(occurredAt);
  }
}

/** 답안 하나가 채점됨. Progression(XP)·Review(SM-2)가 구독 */
export class AnswerGraded extends DomainEvent {
  constructor(
    readonly payload: {
      sessionId: string;
      userId: string;
      questionId: string;
      kind: SessionKind;
      isCorrect: boolean;
      timeMs: number;
      /** 이 세션에서 이 문제가 복습 큐에서 나온 것인지 (SM-2 품질 계산용) */
      fromReview: boolean;
    },
    occurredAt?: Date,
  ) {
    super(occurredAt);
  }
}

/** 세션 완료. Progression(레슨 진행도·스트릭·데일리 목표·세션 XP)이 구독 */
export class SessionCompleted extends DomainEvent {
  constructor(
    readonly payload: {
      sessionId: string;
      userId: string;
      kind: SessionKind;
      lessonId: number | null;
      correct: number;
      total: number;
      xpEarned: number;
    },
    occurredAt?: Date,
  ) {
    super(occurredAt);
  }
}
