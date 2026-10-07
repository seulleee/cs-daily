import { ErrorCode } from '@cs-daily/contracts';
import { ConflictError, ForbiddenError, InvariantViolation, NotFoundError } from '../../../shared/domain/domain-error';

export class SessionNotFound extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.SESSION_NOT_FOUND, `세션을 찾을 수 없습니다: ${id}`);
  }
}
export class SessionAlreadyFinished extends ConflictError {
  constructor(id: string) {
    super(ErrorCode.SESSION_FINISHED, `이미 완료된 세션입니다: ${id}`);
  }
}
export class SessionIncomplete extends InvariantViolation {
  constructor(answered: number, total: number) {
    super(ErrorCode.SESSION_INCOMPLETE, `아직 답하지 않은 문제가 있습니다 (${answered}/${total})`, { answered, total });
  }
}
export class QuestionNotInSession extends ForbiddenError {
  constructor(questionId: string) {
    super(ErrorCode.QUESTION_NOT_IN_SESSION, `이 세션의 문제가 아닙니다: ${questionId}`);
  }
}
export class AnswerAlreadySubmitted extends ConflictError {
  constructor(questionId: string) {
    super(ErrorCode.ANSWER_ALREADY_SUBMITTED, `이미 답한 문제입니다: ${questionId}`);
  }
}
export class LessonLocked extends ForbiddenError {
  constructor(lessonId: number) {
    super(ErrorCode.LESSON_LOCKED, `아직 잠긴 레슨입니다: ${lessonId}`);
  }
}
export class LessonHasNoQuestions extends InvariantViolation {
  constructor(lessonId: number) {
    super(ErrorCode.LESSON_HAS_NO_QUESTIONS, `출제할 문제가 없는 레슨입니다: ${lessonId}`);
  }
}
export class NoReviewDue extends NotFoundError {
  constructor() {
    super(ErrorCode.NO_REVIEW_DUE, '지금 복습할 문제가 없습니다');
  }
}

export class UnitNotFound extends NotFoundError {
  constructor(unitId: number) {
    super(ErrorCode.LESSON_NOT_FOUND, `유닛이 없습니다: ${unitId}`);
  }
}
