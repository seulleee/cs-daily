import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ErrorCode, type FriendSearchResponse, type FriendsResponse } from '@cs-daily/contracts';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { FriendshipAccepted, FriendshipEnded } from '../domain/events';
import { decideSend, FRIEND_LIMIT, SEARCH_MAX } from '../domain/friendship-rules';
import { SOCIAL_REPO, type SocialRepository } from '../domain/ports';
import { seoulWeekStart } from '../domain/week';
import {
  AcceptFriendRequestCommand,
  BlockUserCommand,
  CancelFriendRequestCommand,
  DeclineFriendRequestCommand,
  ListFriendsQuery,
  RemoveFriendCommand,
  SearchFriendsQuery,
  SendFriendRequestCommand,
  UnblockUserCommand,
} from './commands';

const limitError = () => new ConflictError(ErrorCode.FRIEND_LIMIT, '친구 또는 요청 한도에 도달했어요');
const notFound = () => new NotFoundError(ErrorCode.NOT_FOUND, '요청을 찾을 수 없어요');

/** 두 사람 중 누구든 친구가 가득 차 있으면 수락할 수 없다 */
async function assertRoomForBoth(repo: SocialRepository, a: string, b: string) {
  const [ca, cb] = await Promise.all([repo.countFriends(a), repo.countFriends(b)]);
  if (ca >= FRIEND_LIMIT || cb >= FRIEND_LIMIT) throw limitError();
}

@CommandHandler(SendFriendRequestCommand)
export class SendFriendRequestHandler implements ICommandHandler<SendFriendRequestCommand, void> {
  constructor(
    @Inject(SOCIAL_REPO) private readonly repo: SocialRepository,
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
  ) {}

  async execute({ me, targetId }: SendFriendRequestCommand): Promise<void> {
    // 자기 자신·차단 관계는 일반 성공과 구분되지 않게 조용히 끝낸다
    if (me === targetId) return;
    const accepted = await this.uow.run(async () => {
      // 없는 사용자도 일반 성공과 같게 응답하고 아무것도 저장하지 않는다
      if (!(await this.repo.userExists(targetId))) return null;
      const [blockedEitherWay, existing, myFriends, myPendingOut, theirFriends] = await Promise.all([
        this.repo.isBlockedEitherWay(me, targetId),
        this.repo.findPair(me, targetId),
        this.repo.countFriends(me),
        this.repo.countPendingOut(me),
        this.repo.countFriends(targetId),
      ]);
      const decision = decideSend({ blockedEitherWay, existing, me, myFriends, myPendingOut, theirFriends });
      if (decision === 'limit') throw limitError();
      if (decision === 'create') {
        await this.repo.createRequest(me, targetId);
        return null;
      }
      if (decision === 'accept-reverse' && existing) {
        await assertRoomForBoth(this.repo, me, targetId);
        const at = new Date();
        await this.repo.markAccepted(existing.id, at);
        return at;
      }
      return null;
    });
    if (accepted) this.events.publish(new FriendshipAccepted({ userA: me, userB: targetId, at: accepted }));
  }
}

@CommandHandler(AcceptFriendRequestCommand)
export class AcceptFriendRequestHandler implements ICommandHandler<AcceptFriendRequestCommand, void> {
  constructor(
    @Inject(SOCIAL_REPO) private readonly repo: SocialRepository,
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
  ) {}

  async execute({ me, requestId }: AcceptFriendRequestCommand): Promise<void> {
    const { requesterId, at } = await this.uow.run(async () => {
      const req = await this.repo.findIncomingPending(requestId, me);
      if (!req) throw notFound();
      await assertRoomForBoth(this.repo, me, req.requesterId);
      const at = new Date();
      await this.repo.markAccepted(requestId, at);
      return { requesterId: req.requesterId, at };
    });
    this.events.publish(new FriendshipAccepted({ userA: requesterId, userB: me, at }));
  }
}

@CommandHandler(DeclineFriendRequestCommand)
export class DeclineFriendRequestHandler implements ICommandHandler<DeclineFriendRequestCommand, void> {
  constructor(@Inject(SOCIAL_REPO) private readonly repo: SocialRepository) {}

  async execute({ me, requestId }: DeclineFriendRequestCommand): Promise<void> {
    if (!(await this.repo.deleteIncomingPending(requestId, me))) throw notFound();
  }
}

@CommandHandler(CancelFriendRequestCommand)
export class CancelFriendRequestHandler implements ICommandHandler<CancelFriendRequestCommand, void> {
  constructor(@Inject(SOCIAL_REPO) private readonly repo: SocialRepository) {}

  async execute({ me, requestId }: CancelFriendRequestCommand): Promise<void> {
    if (!(await this.repo.deleteOutgoingPending(requestId, me))) throw notFound();
  }
}

@CommandHandler(RemoveFriendCommand)
export class RemoveFriendHandler implements ICommandHandler<RemoveFriendCommand, void> {
  constructor(
    @Inject(SOCIAL_REPO) private readonly repo: SocialRepository,
    private readonly events: EventBus,
  ) {}

  async execute({ me, friendId }: RemoveFriendCommand): Promise<void> {
    if (await this.repo.deleteAccepted(me, friendId)) {
      this.events.publish(new FriendshipEnded({ userA: me, userB: friendId, at: new Date() }));
    }
  }
}

@CommandHandler(BlockUserCommand)
export class BlockUserHandler implements ICommandHandler<BlockUserCommand, void> {
  constructor(
    @Inject(SOCIAL_REPO) private readonly repo: SocialRepository,
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
  ) {}

  async execute({ me, targetId }: BlockUserCommand): Promise<void> {
    if (me === targetId) return;
    const wasFriend = await this.uow.run(async () => {
      if (!(await this.repo.userExists(targetId))) throw notFound();
      const removed = await this.repo.deletePair(me, targetId);
      await this.repo.upsertBlock(me, targetId);
      return removed === 'accepted';
    });
    if (wasFriend) this.events.publish(new FriendshipEnded({ userA: me, userB: targetId, at: new Date() }));
  }
}

@CommandHandler(UnblockUserCommand)
export class UnblockUserHandler implements ICommandHandler<UnblockUserCommand, void> {
  constructor(@Inject(SOCIAL_REPO) private readonly repo: SocialRepository) {}

  async execute({ me, targetId }: UnblockUserCommand): Promise<void> {
    await this.repo.deleteBlock(me, targetId);
  }
}

@QueryHandler(ListFriendsQuery)
export class ListFriendsHandler implements IQueryHandler<ListFriendsQuery, FriendsResponse> {
  constructor(@Inject(SOCIAL_REPO) private readonly repo: SocialRepository) {}

  async execute({ me, at }: ListFriendsQuery): Promise<FriendsResponse> {
    const [friends, incoming, outgoing] = await Promise.all([
      this.repo.listFriends(me, seoulWeekStart(at), at),
      this.repo.listIncoming(me),
      this.repo.listOutgoing(me),
    ]);
    return { friends, incoming, outgoing };
  }
}

@QueryHandler(SearchFriendsQuery)
export class SearchFriendsHandler implements IQueryHandler<SearchFriendsQuery, FriendSearchResponse> {
  constructor(@Inject(SOCIAL_REPO) private readonly repo: SocialRepository) {}

  async execute({ me, q }: SearchFriendsQuery): Promise<FriendSearchResponse> {
    return { users: await this.repo.search(me, q, SEARCH_MAX) };
  }
}

export const FRIEND_HANDLERS = [
  SendFriendRequestHandler,
  AcceptFriendRequestHandler,
  DeclineFriendRequestHandler,
  CancelFriendRequestHandler,
  RemoveFriendHandler,
  BlockUserHandler,
  UnblockUserHandler,
  ListFriendsHandler,
  SearchFriendsHandler,
];
