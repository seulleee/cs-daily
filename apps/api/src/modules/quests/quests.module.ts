import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ProgressionModule } from '../progression/progression.module';
import { EvaluateQuestsHandler } from './application/evaluate-quests.handler';
import { GetMyQuestsHandler } from './application/get-my-quests.handler';
import { QUEST_ACTIVITY_PORT, QUEST_REWARD_REPO } from './domain/ports';
import { PrismaQuestActivity } from './infrastructure/prisma-quest-activity';
import { PrismaQuestRewardRepository } from './infrastructure/prisma-quest-reward.repository';

/** Quests 컨텍스트: 데일리 퀘스트 평가·조회. 컨트롤러는 이후 작업에서 추가 */
@Module({
  imports: [IdentityModule, ProgressionModule],
  providers: [
    PrismaQuestActivity,
    PrismaQuestRewardRepository,
    { provide: QUEST_ACTIVITY_PORT, useExisting: PrismaQuestActivity },
    { provide: QUEST_REWARD_REPO, useExisting: PrismaQuestRewardRepository },
    EvaluateQuestsHandler,
    GetMyQuestsHandler,
  ],
})
export class QuestsModule {}
