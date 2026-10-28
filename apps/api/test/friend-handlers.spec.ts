import { describe, expect, it, vi } from 'vitest';
import type { EventBus } from '@nestjs/cqrs';
import type { UnitOfWork } from '../src/shared/infrastructure/unit-of-work';
import type { SocialRepository } from '../src/modules/social/domain/ports';
import { AcceptFriendRequestHandler, SendFriendRequestHandler } from '../src/modules/social/application/friend.handlers';
import { AcceptFriendRequestCommand, SendFriendRequestCommand } from '../src/modules/social/application/commands';
import { FriendshipAccepted } from '../src/modules/social/domain/events';

const uow = { run: <T>(fn: () => Promise<T>) => fn() } as unknown as UnitOfWork;

function setup(over: Partial<SocialRepository> = {}) {
  const repo = {
    userExists: vi.fn(async () => true),
    isBlockedEitherWay: vi.fn(async () => false),
    findPair: vi.fn(async () => null),
    countFriends: vi.fn(async () => 0),
    countPendingOut: vi.fn(async () => 0),
    createRequest: vi.fn(async () => true),
    markAccepted: vi.fn(async () => undefined),
    findIncomingPending: vi.fn(async () => null),
    ...over,
  } as unknown as SocialRepository;
  const publish = vi.fn();
  return { repo, publish, events: { publish } as unknown as EventBus };
}

describe('SendFriendRequestHandler', () => {
  it('차단 관계면 저장하지 않고 정상 종료', async () => {
    const s = setup({ isBlockedEitherWay: vi.fn(async () => true) });
    await new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'b'));
    expect(s.repo.createRequest).not.toHaveBeenCalled();
    expect(s.publish).not.toHaveBeenCalled();
  });
  it('일반 요청은 저장', async () => {
    const s = setup();
    await new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'b'));
    expect(s.repo.createRequest).toHaveBeenCalledWith('a', 'b');
  });
  it('역방향 대기 요청이면 수락하고 이벤트 발행', async () => {
    const s = setup({ findPair: vi.fn(async () => ({ id: 'f1', status: 'pending' as const, requesterId: 'b' })) });
    await new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'b'));
    expect(s.repo.markAccepted).toHaveBeenCalledWith('f1', expect.any(Date));
    expect(s.publish).toHaveBeenCalledWith(expect.any(FriendshipAccepted));
  });
  it('보낸 대기 요청 20개면 FRIEND_LIMIT', async () => {
    const s = setup({ countPendingOut: vi.fn(async () => 20) });
    await expect(new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'b'))).rejects.toMatchObject({ code: 'FRIEND_LIMIT' });
  });
  it('자기 자신에게는 아무것도 하지 않는다', async () => {
    const s = setup();
    await new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'a'));
    expect(s.repo.createRequest).not.toHaveBeenCalled();
  });
});

describe('AcceptFriendRequestHandler', () => {
  it('없거나 남의 요청이면 404', async () => {
    const s = setup();
    await expect(new AcceptFriendRequestHandler(s.repo, uow, s.events).execute(new AcceptFriendRequestCommand('a', 'x'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('한쪽이 친구 100명이면 FRIEND_LIMIT, 수락 안 함', async () => {
    const s = setup({
      findIncomingPending: vi.fn(async () => ({ requesterId: 'b' })),
      countFriends: vi.fn(async (id: string) => (id === 'b' ? 100 : 3)),
    });
    await expect(new AcceptFriendRequestHandler(s.repo, uow, s.events).execute(new AcceptFriendRequestCommand('a', 'x'))).rejects.toMatchObject({ code: 'FRIEND_LIMIT' });
    expect(s.repo.markAccepted).not.toHaveBeenCalled();
  });
  it('정상 수락은 이벤트 발행', async () => {
    const s = setup({ findIncomingPending: vi.fn(async () => ({ requesterId: 'b' })) });
    await new AcceptFriendRequestHandler(s.repo, uow, s.events).execute(new AcceptFriendRequestCommand('a', 'x'));
    expect(s.publish).toHaveBeenCalledTimes(1);
  });
});
