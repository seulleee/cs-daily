/** Learning → Progression 경계를 넘는 커맨드. Learning의 CompleteSessionHandler가 동기 호출 */
export class RecordSessionCompletionCommand {
  constructor(
    readonly payload: {
      userId: string;
      sessionId: string;
      kind: 'lesson' | 'review';
      lessonId: number | null;
      correct: number;
      total: number;
      xpEarned: number;
      /** 사용자 타임존 기준 YYYY-MM-DD */
      localDate: string;
      occurredAt: Date;
    },
  ) {}
}

export interface SessionCompletionResult {
  streak: { current: number; extended: boolean };
  dailyGoal: { target: number; done: number; achieved: boolean };
}

/** 배치: 어제 미달성 사용자에 프리즈 적용 또는 리셋 */
export class ApplyMissedDaysCommand {
  constructor(readonly now: Date) {}
}

/** 배치: 매월 1일 프리즈 2개로 충전 */
export class RefillFreezesCommand {
  constructor(readonly now: Date) {}
}
