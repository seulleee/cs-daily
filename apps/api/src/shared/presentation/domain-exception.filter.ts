import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { ErrorCode, type ApiErrorBody } from '@cs-daily/contracts';
import { ConflictError, DomainError, ForbiddenError, InvariantViolation, NotFoundError } from '../domain/domain-error';

/**
 * 도메인 예외 → HTTP 매핑. 도메인은 HTTP를 모르므로 매핑은 여기 한 곳에서만.
 * 응답 형식은 contracts의 ApiErrorBody로 고정.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.map(exception);
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(status).json(body);
  }

  private map(e: unknown): { status: number; body: ApiErrorBody } {
    if (e instanceof DomainError) {
      const status =
        e instanceof NotFoundError ? 404
        : e instanceof ConflictError ? 409
        : e instanceof ForbiddenError ? 403
        : e instanceof InvariantViolation ? 422
        : 400;
      return { status, body: { error: { code: e.code, message: e.message, details: e.details } } };
    }
    if (e instanceof ZodError) {
      return { status: 400, body: { error: { code: ErrorCode.VALIDATION_FAILED, message: '요청 형식이 올바르지 않습니다', details: e.issues } } };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const resp = e.getResponse();
      const message = typeof resp === 'string' ? resp : ((resp as { message?: string | string[] }).message ?? e.message);
      const code =
        status === 401 ? ErrorCode.UNAUTHORIZED
        : status === 403 ? ErrorCode.FORBIDDEN
        : status === 404 ? ErrorCode.NOT_FOUND
        : status === 429 ? ErrorCode.RATE_LIMITED
        : status === 400 ? ErrorCode.VALIDATION_FAILED
        : ErrorCode.INTERNAL;
      return { status, body: { error: { code, message: Array.isArray(message) ? message.join(', ') : message } } };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { error: { code: ErrorCode.INTERNAL, message: '서버 오류' } } };
  }
}
