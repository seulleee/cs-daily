import { Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** 컨트롤러에서 @Body(new ZodBody(Schema))로 사용. ZodError는 DomainExceptionFilter가 400으로 매핑 */
@Injectable()
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
