import { DomainEvent } from '../../../../shared/domain/domain-event';

/** 친구 요청이 수락돼 두 사람이 친구가 됨 */
export class FriendshipAccepted extends DomainEvent {
  constructor(
    readonly payload: { userA: string; userB: string; at: Date },
    occurredAt?: Date,
  ) {
    super(occurredAt);
  }
}

/** 친구 관계가 끊김(친구 끊기·차단). 대기 요청 삭제는 발행하지 않는다 */
export class FriendshipEnded extends DomainEvent {
  constructor(
    readonly payload: { userA: string; userB: string; at: Date },
    occurredAt?: Date,
  ) {
    super(occurredAt);
  }
}
