import { Body, Controller, Delete, Get, HttpCode, Patch, Put, Query, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { DeleteMeRequest, ErrorCode, SetTracksRequest, UpdateMeRequest, type MeResponse } from '@cs-daily/contracts';
import { ConflictError } from '../../../shared/domain/domain-error';
import { localDateOf } from '../../../shared/domain/local-date';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { CurrentUser, type AuthUser } from '../../../shared/presentation/current-user.decorator';
import { clearAuthCookies } from '../../../shared/presentation/auth-cookies';
import { ZodBody } from '../../../shared/presentation/zod-body.pipe';
import { GetCalendarQuery } from '../../progression/application/queries/calendar.handler';
import { DeleteAccountCommand } from '../application/delete-account.handler';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * /me — 프로필·통계·오늘 활동을 한 번에 돌려주는 홈 상단 데이터.
 * 여러 컨텍스트의 테이블을 읽기만 하는 조합 읽기 모델이라 Identity의 presentation에 둔다.
 */
@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser): Promise<MeResponse> {
    const db = this.uow.client;
    const now = new Date();
    // sortOrder 음수 = 콘텐츠에서 빠진 퇴역 행(seed.ts 참고) — 트랙별 유닛·레슨 수에서 제외한다
    // 계정을 지운 뒤 아직 만료되지 않은 액세스 토큰이 오면 500이 아니라 401로 돌려보낸다
    const user = await db.user.findUnique({
      where: { id: auth.id },
      include: {
        stats: true,
        userTracks: {
          include: {
            track: { include: { units: { where: { sortOrder: { gt: 0 } }, select: { _count: { select: { lessons: { where: { sortOrder: { gt: 0 } } } } } } } } },
          },
          orderBy: { track: { sortOrder: 'asc' } },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    const today = localDateOf(now, user.timezone);
    const [activity, dueReviewCount] = await Promise.all([
      db.dailyActivity.findUnique({ where: { userId_activityDate: { userId: auth.id, activityDate: new Date(`${today}T00:00:00Z`) } } }),
      db.reviewItem.count({ where: { userId: auth.id, dueAt: { lte: now } } }),
    ]);
    const stats = user.stats;
    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        dailyGoal: user.dailyGoal,
        reminderAt: user.reminderAt,
        codeLanguage: user.codeLanguage,
        discoverable: user.discoverable,
        role: user.role,
      },
      stats: {
        totalXp: Number(stats?.totalXp ?? 0),
        currentStreak: stats?.currentStreak ?? 0,
        longestStreak: stats?.longestStreak ?? 0,
        freezeCount: stats?.freezeCount ?? 0,
        lastActiveDate: stats?.lastActiveDate?.toISOString().slice(0, 10) ?? null,
      },
      today: {
        date: today,
        xp: activity?.xp ?? 0,
        lessonsCompleted: activity?.lessonsCompleted ?? 0,
        goalAchieved: (activity?.lessonsCompleted ?? 0) >= user.dailyGoal,
      },
      tracks: user.userTracks.map(({ track: t }) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        unitCount: t.units.length,
        lessonCount: t.units.reduce((n, u) => n + u._count.lessons, 0),
      })),
      dueReviewCount,
    };
  }

  @Patch()
  async update(@CurrentUser() auth: AuthUser, @Body(new ZodBody(UpdateMeRequest)) body: UpdateMeRequest) {
    if (body.nickname) {
      const taken = await this.uow.client.user.findFirst({ where: { nickname: body.nickname, NOT: { id: auth.id } }, select: { id: true } });
      if (taken) throw new ConflictError(ErrorCode.NICKNAME_TAKEN, '이미 사용 중인 닉네임입니다');
    }
    return this.uow.client.user.update({
      where: { id: auth.id },
      data: body,
      select: { id: true, nickname: true, timezone: true, dailyGoal: true, reminderAt: true, codeLanguage: true, discoverable: true },
    });
  }

  /** 계정 삭제: 닉네임이 맞아야(422 NICKNAME_MISMATCH) 모든 기록을 지우고 쿠키를 비운다 */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthUser, @Body(new ZodBody(DeleteMeRequest)) body: DeleteMeRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.commandBus.execute(new DeleteAccountCommand(auth.id, body.nickname));
    clearAuthCookies(res);
  }

  /** 선택 트랙 교체 (최소 1개). 기존 진행도는 유지된다 */
  @Put('tracks')
  async setTracks(@CurrentUser() auth: AuthUser, @Body(new ZodBody(SetTracksRequest)) body: z.infer<typeof SetTracksRequest>) {
    await this.uow.run(async () => {
      const db = this.uow.client;
      await db.userTrack.deleteMany({ where: { userId: auth.id, trackId: { notIn: body.trackIds } } });
      await db.userTrack.createMany({ data: body.trackIds.map((trackId) => ({ userId: auth.id, trackId })), skipDuplicates: true });
    });
    return this.uow.client.userTrack.findMany({ where: { userId: auth.id }, select: { trackId: true, addedAt: true } });
  }

  @Get('stats/calendar')
  calendar(@CurrentUser() auth: AuthUser, @Query('month') month: string) {
    return this.queryBus.execute(new GetCalendarQuery(auth.id, z.string().regex(/^\d{4}-\d{2}$/).parse(month)));
  }
}
