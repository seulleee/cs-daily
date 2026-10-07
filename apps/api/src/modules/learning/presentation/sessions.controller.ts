import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubmitAnswerRequest, type CompleteSessionResponse, type SessionResponse, type SubmitAnswerResponse } from '@cs-daily/contracts';
import { JwtAuthGuard } from '../../identity/presentation/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../shared/presentation/current-user.decorator';
import { ZodBody } from '../../../shared/presentation/zod-body.pipe';
import { CompleteSessionCommand, StartLessonSessionCommand, StartReviewSessionCommand, StartUnitSkipTestCommand, SubmitAnswerCommand } from '../application/commands/commands';
import { GetSessionQuery } from '../application/queries/get-session.handler';

/** 컨트롤러는 DTO → 커맨드/쿼리 변환만 한다. 로직 없음 */
@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SessionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** 레슨 세션 시작 (미완료 세션이 있으면 그것을 반환) */
  @Post('lessons/:lessonId/sessions')
  async startLesson(@CurrentUser() user: AuthUser, @Param('lessonId', ParseIntPipe) lessonId: number): Promise<SessionResponse> {
    const { sessionId } = await this.commandBus.execute<StartLessonSessionCommand, { sessionId: string }>(new StartLessonSessionCommand(user.id, lessonId));
    return this.queryBus.execute(new GetSessionQuery(user.id, sessionId));
  }

  /** 복습 세션 시작 (due 항목 없으면 404 NO_REVIEW_DUE) */
  @Post('review/sessions')
  async startReview(@CurrentUser() user: AuthUser): Promise<SessionResponse> {
    const { sessionId } = await this.commandBus.execute<StartReviewSessionCommand, { sessionId: string }>(new StartReviewSessionCommand(user.id));
    return this.queryBus.execute(new GetSessionQuery(user.id, sessionId));
  }

  /** 유닛 건너뛰기 테스트 시작 (미완료 테스트가 있으면 그것을 반환). 80% 이상 맞히면 이 유닛까지 완료 처리 */
  @Post('units/:unitId/skip-test')
  async startUnitSkipTest(@CurrentUser() user: AuthUser, @Param('unitId', ParseIntPipe) unitId: number): Promise<SessionResponse> {
    const { sessionId } = await this.commandBus.execute<StartUnitSkipTestCommand, { sessionId: string }>(new StartUnitSkipTestCommand(user.id, unitId));
    return this.queryBus.execute(new GetSessionQuery(user.id, sessionId));
  }

  @Get('sessions/:id')
  getSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<SessionResponse> {
    return this.queryBus.execute(new GetSessionQuery(user.id, id));
  }

  /** 답안 제출·채점. 같은 문제 재제출은 409 ANSWER_ALREADY_SUBMITTED */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('sessions/:id/answers')
  submitAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(SubmitAnswerRequest)) body: SubmitAnswerRequest,
  ): Promise<SubmitAnswerResponse> {
    return this.commandBus.execute(new SubmitAnswerCommand(user.id, id, body.questionId, body.answer, body.timeMs));
  }

  @Post('sessions/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<CompleteSessionResponse> {
    return this.commandBus.execute(new CompleteSessionCommand(user.id, id));
  }
}
