import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CURRICULUM_QUERY_PORT, QUESTION_GRADING_PORT } from '../learning/domain/ports';
import { UpsertQuestionHandler } from './application/commands/upsert-question.handler';
import { GetPathHandler, ListTracksHandler } from './application/queries/get-path.handler';
import { CurriculumAdapter } from './infrastructure/question-grading.adapter';
import { AdminQuestionsController, CurriculumController } from './presentation/curriculum.controller';

/** Curriculum 컨텍스트. Learning이 쓰는 포트 구현체를 export */
@Module({
  imports: [IdentityModule],
  controllers: [CurriculumController, AdminQuestionsController],
  providers: [
    CurriculumAdapter,
    { provide: QUESTION_GRADING_PORT, useExisting: CurriculumAdapter },
    { provide: CURRICULUM_QUERY_PORT, useExisting: CurriculumAdapter },
    GetPathHandler,
    ListTracksHandler,
    UpsertQuestionHandler,
  ],
  exports: [QUESTION_GRADING_PORT, CURRICULUM_QUERY_PORT],
})
export class CurriculumModule {}
