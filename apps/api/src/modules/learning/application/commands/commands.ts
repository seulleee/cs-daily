/** 커맨드 객체. 컨트롤러가 DTO를 이걸로 바꿔 CommandBus에 넘긴다 */
export class StartLessonSessionCommand {
  constructor(
    readonly userId: string,
    readonly lessonId: number,
  ) {}
}

export class StartReviewSessionCommand {
  constructor(readonly userId: string) {}
}

export class SubmitAnswerCommand {
  constructor(
    readonly userId: string,
    readonly sessionId: string,
    readonly questionId: string,
    readonly answer: unknown,
    readonly timeMs: number,
  ) {}
}

export class CompleteSessionCommand {
  constructor(
    readonly userId: string,
    readonly sessionId: string,
  ) {}
}

/** 유닛 건너뛰기 테스트 시작 */
export class StartUnitSkipTestCommand {
  constructor(
    readonly userId: string,
    readonly unitId: number,
  ) {}
}
