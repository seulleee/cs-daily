import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SocialModule } from '../social/social.module';
import { ProgressionModule } from '../progression/progression.module';
import { QuestsController } from './presentation/quests.controller';
import { EvaluateQuestsHandler } from './application/evaluate-quests.handler';
import { GetMyQuestsHandler } from './application/get-my-quests.handler';
import { QUEST_ACTIVITY_PORT, DAILY_PICK_REPO, QUEST_REWARD_REPO, FRIEND_QUEST_REPO } from './domain/ports';
import { PrismaQuestActivity } from './infrastructure/prisma-quest-activity';
import { PrismaDailyPickRepository } from './infrastructure/prisma-daily-pick.repository';
import { PrismaQuestRewardRepository } from './infrastructure/prisma-quest-reward.repository';
import { PrismaFriendQuestRepository } from './infrastructure/prisma-friend-quest.repository';
import { PairFriendQuestsHandler } from './application/pair-friend-quests.handler';
import { EndQuestOnFriendshipEnded, PairOnFriendshipAccepted } from './application/friend-quest-events.handlers';

/** Quests 컨텍스트: 데일리 퀘스트 평가·조회 (`GET /me/quests`) */
@Module({
  imports: [IdentityModule, ProgressionModule, SocialModule],
  controllers: [QuestsController],
  providers: [
    PrismaQuestActivity,
    PrismaQuestRewardRepository,
    PrismaDailyPickRepository,
    { provide: QUEST_ACTIVITY_PORT, useExisting: PrismaQuestActivity },
    { provide: QUEST_REWARD_REPO, useExisting: PrismaQuestRewardRepository },
    { provide: DAILY_PICK_REPO, useExisting: PrismaDailyPickRepository },
    PrismaFriendQuestRepository,
    { provide: FRIEND_QUEST_REPO, useExisting: PrismaFriendQuestRepository },
    EvaluateQuestsHandler,
    PairFriendQuestsHandler,
    PairOnFriendshipAccepted,
    EndQuestOnFriendshipEnded,
    GetMyQuestsHandler,
  ],
})
export class QuestsModule {}
