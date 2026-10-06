import { AggregateRoot as CqrsAggregateRoot } from '@nestjs/cqrs';
import type { DomainEvent } from './domain-event';

/**
 * 모든 애그리거트 루트의 기반. @nestjs/cqrs의 AggregateRoot를 감싸
 * 도메인 이벤트를 모아 두었다가 커밋 후 발행(EventPublisher.mergeObjectContext)할 수 있게 한다.
 * domain 레이어는 Nest 데코레이터를 쓰지 않지만, 이벤트 버퍼링만은 cqrs 베이스 클래스에 위임한다.
 */
export abstract class AggregateRoot extends CqrsAggregateRoot<DomainEvent> {
  /** 테스트·리포지토리에서 발행 전 이벤트를 들여다볼 때 사용 */
  pullDomainEvents(): DomainEvent[] {
    const events = [...this.getUncommittedEvents()]; // uncommit()이 내부 배열을 비우므로 복사본을 돌려준다
    this.uncommit();
    return events;
  }
}
