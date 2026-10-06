import type { ErrorCode } from '@cs-daily/contracts';

/**
 * 도메인 예외. presentation의 DomainExceptionFilter가 code → HTTP 상태로 매핑한다.
 * 도메인 레이어는 HTTP를 모르므로 여기에는 상태 코드가 없다.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}
export class ForbiddenError extends DomainError {}
export class InvariantViolation extends DomainError {}
