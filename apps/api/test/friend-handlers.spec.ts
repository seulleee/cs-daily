import { describe, expect, it, vi } from 'vitest';
import type { EventBus } from '@nestjs/cqrs';
import type { UnitOfWork } from '../src/shared/infrastructure/unit-of-work';
import type { SocialRepository } from '../src/modules/social/domain/ports';
import { AcceptFriendRequestHandler, ListBlocksHandler, SendFriendRequestHandler } from '../src/modules/social/application/friend.handlers';
import { AcceptFriendRequestCommand, ListBlocksQuery, SendFriendRequestCommand } from '../src/modules/social/application/commands';
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
    markAccepted: vi.fn(async () => true),
    deleteIncomingPending: vi.fn(async () => true),
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
  it('역방향 요청이 그새 취소돼 갱신 0이면 이벤트 없이 정상 종료', async () => {
    const s = setup({
      findPair: vi.fn(async () => ({ id: 'f1', status: 'pending' as const, requesterId: 'b' })),
      markAccepted: vi.fn(async () => false),
    });
    await new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'b'));
    expect(s.publish).not.toHaveBeenCalled();
  });
  it('보낸 대기 요청 20개면 FRIEND_LIMIT', async () => {
    const s = setup({ countPendingOut: vi.fn(async () => 20) });
    await expect(new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'b'))).rejects.toMatchObject({ code: 'FRIEND_LIMIT' });
  });
  it('없는 사용자도 정상 종료하고 저장하지 않는다', async () => {
    const s = setup({ userExists: vi.fn(async () => false) });
    await new SendFriendRequestHandler(s.repo, uow, s.events).execute(new SendFriendRequestCommand('a', 'b'));
    expect(s.repo.createRequest).not.toHaveBeenCalled();
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
  it('이미 취소된(갱신 0) 요청 수락은 404, 이벤트 없음', async () => {
    const s = setup({
      findIncomingPending: vi.fn(async () => ({ requesterId: 'b' })),
      markAccepted: vi.fn(async () => false),
    });
    await expect(new AcceptFriendRequestHandler(s.repo, uow, s.events).execute(new AcceptFriendRequestCommand('a', 'x'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(s.publish).not.toHaveBeenCalled();
  });
  it('차단 관계 요청 수락은 404, 요청 삭제, 이벤트 없음', async () => {
    const s = setup({
      findIncomingPending: vi.fn(async () => ({ requesterId: 'b' })),
      isBlockedEitherWay: vi.fn(async () => true),
    });
    await expect(new AcceptFriendRequestHandler(s.repo, uow, s.events).execute(new AcceptFriendRequestCommand('a', 'x'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(s.repo.markAccepted).not.toHaveBeenCalled();
    expect(s.repo.deleteIncomingPending).toHaveBeenCalledWith('x', 'a');
    expect(s.publish).not.toHaveBeenCalled();
  });
  it('정상 수락은 이벤트 발행', async () => {
    const s = setup({ findIncomingPending: vi.fn(async () => ({ requesterId: 'b' })) });
    await new AcceptFriendRequestHandler(s.repo, uow, s.events).execute(new AcceptFriendRequestCommand('a', 'x'));
    expect(s.publish).toHaveBeenCalledTimes(1);
  });
});

describe('ListBlocksHandler', () => {
  it('내 차단 목록을 최대 200명까지 저장소에서 받아 users로 감싼다', async () => {
    const row = { userId: 'b', nickname: '비', avatarUrl: null, blockedAt: '2026-10-28T00:00:00.000Z' };
    const s = setup({ listBlocks: vi.fn(async () => [row]) });
    const res = await new ListBlocksHandler(s.repo).execute(new ListBlocksQuery('a'));
    expect(s.repo.listBlocks).toHaveBeenCalledWith('a', 200);
    expect(res).toEqual({ users: [row] });
  });
});
