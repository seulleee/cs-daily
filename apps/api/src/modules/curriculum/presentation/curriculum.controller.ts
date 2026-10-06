import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { LessonFile, type PathResponse, type TrackSummary } from '@cs-daily/contracts';
import { JwtAuthGuard } from '../../identity/presentation/jwt-auth.guard';
import { RolesGuard, Roles } from '../../identity/presentation/roles.guard';
import { CurrentUser, type AuthUser } from '../../../shared/presentation/current-user.decorator';
import { ZodBody } from '../../../shared/presentation/zod-body.pipe';
import { UpsertQuestionCommand } from '../application/commands/upsert-question.handler';
import { GetPathQuery, ListTracksQuery } from '../application/queries/get-path.handler';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';

@ApiTags('curriculum')
@Controller()
export class CurriculumController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  /** 전체 트랙 목록 (온보딩·설정). 로그인 불필요 */
  @Get('tracks')
  listTracks(): Promise<TrackSummary[]> {
    return this.queryBus.execute(new ListTracksQuery());
  }

  /** 경로 화면 */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/path')
  getPath(@CurrentUser() user: AuthUser, @Query('track') track: string): Promise<PathResponse> {
    return this.queryBus.execute(new GetPathQuery(user.id, z.string().min(1).parse(track)));
  }
}

const StatusBody = z.object({ status: z.enum(['draft', 'review', 'published', 'retired']) });

/** 어드민 문제 관리. MVP는 가져오기·상태 전환·목록만 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminQuestionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly uow: UnitOfWork,
  ) {}

  /** 콘텐츠 파일(LessonFile JSON) 일괄 가져오기 → status=review */
  @Post('lessons/:lessonId/questions/import')
  async importLesson(@Param('lessonId', ParseIntPipe) lessonId: number, @Body(new ZodBody(LessonFile)) body: LessonFile) {
    const results = await Promise.all(
      body.questions.map((q, i) => this.commandBus.execute<UpsertQuestionCommand, { id: string; created: boolean }>(new UpsertQuestionCommand(lessonId, q, i + 1))),
    );
    return { created: results.filter((r) => r.created).length, updated: results.filter((r) => !r.created).length };
  }

  /** 문제 목록 (answer_key 포함 — admin 전용) */
  @Get('questions')
  list(@Query('lessonId') lessonId?: string, @Query('status') status?: string) {
    return this.uow.client.question.findMany({
      where: {
        ...(lessonId ? { lessonId: Number(lessonId) } : {}),
        ...(status ? { status: StatusBody.shape.status.parse(status) } : {}),
      },
      orderBy: [{ lessonId: 'asc' }, { sortOrder: 'asc' }],
      take: 200,
    });
  }

  @Patch('questions/:id/status')
  setStatus(@Param('id') id: string, @Body(new ZodBody(StatusBody)) body: z.infer<typeof StatusBody>) {
    return this.uow.client.question.update({ where: { id }, data: { status: body.status }, select: { id: true, status: true } });
  }
}
