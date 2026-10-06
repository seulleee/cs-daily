import type { IEvent } from '@nestjs/cqrs';

/** 모든 도메인 이벤트의 공통 형태. 이름은 과거형, payload는 불변 */
export abstract class DomainEvent implements IEvent {
  readonly occurredAt: Date;
  constructor(occurredAt?: Date) {
    this.occurredAt = occurredAt ?? new Date();
  }
}
