import type { QuestionId } from '../../../shared/domain/ids';

/** LessonSession 애그리거트 내부 엔티티. 세션 밖에서 단독으로 다루지 않는다 */
export class Answer {
  private constructor(
    readonly questionId: QuestionId,
    readonly questionVersion: number,
    readonly raw: unknown,
    readonly isCorrect: boolean,
    readonly timeMs: number,
    readonly answeredAt: Date,
  ) {}

  static create(p: { questionId: QuestionId; questionVersion: number; raw: unknown; isCorrect: boolean; timeMs: number; answeredAt: Date }) {
    return new Answer(p.questionId, p.questionVersion, p.raw, p.isCorrect, p.timeMs, p.answeredAt);
  }

  /** 리포지토리가 DB 행에서 복원할 때 */
  static rehydrate(p: { questionId: QuestionId; questionVersion: number; raw: unknown; isCorrect: boolean; timeMs: number; answeredAt: Date }) {
    return new Answer(p.questionId, p.questionVersion, p.raw, p.isCorrect, p.timeMs, p.answeredAt);
  }
}
