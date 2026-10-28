import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { FriendshipAccepted, FriendshipEnded } from '../../social/domain/events';
import { weekStartSeoul } from '../domain/friend-quests';
import { FRIEND_QUEST_REPO, type FriendQuestRepository } from '../domain/ports';

/** 친구가 되면, 둘 다 이번 주 짝이 없을 때 바로 짝을 짓는다(createPair가 둘 중 하나라도 멤버면 만들지 않는다). */
@EventsHandler(FriendshipAccepted)
export class PairOnFriendshipAccepted implements IEventHandler<FriendshipAccepted> {
  private readonly logger = new Logger(PairOnFriendshipAccepted.name);
  constructor(@Inject(FRIEND_QUEST_REPO) private readonly repo: FriendQuestRepository) {}

  async handle(e: FriendshipAccepted) {
    const { userA, userB, at } = e.payload;
    try {
      await this.repo.createPair(weekStartSeoul(at), userA, userB);
    } catch (err) {
      this.logger.error(`friend quest pair failed ${userA}/${userB}: ${(err as Error).message}`);
    }
  }
}

/** 친구가 끊기면 둘이 같은 이번 주 퀘스트일 때 그 퀘스트를 끝낸다. 이미 받은 보상은 그대로. */
@EventsHandler(FriendshipEnded)
export class EndQuestOnFriendshipEnded implements IEventHandler<FriendshipEnded> {
  private readonly logger = new Logger(EndQuestOnFriendshipEnded.name);
  constructor(@Inject(FRIEND_QUEST_REPO) private readonly repo: FriendQuestRepository) {}

  async handle(e: FriendshipEnded) {
    const { userA, userB, at } = e.payload;
    try {
      await this.repo.endSharedQuest(weekStartSeoul(at), userA, userB, at);
    } catch (err) {
      this.logger.error(`friend quest end failed ${userA}/${userB}: ${(err as Error).message}`);
    }
  }
}
