import { Body, Controller, Delete, Get, HttpCode, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ErrorCode, PremiumInterestRequest, SetTracksRequest, UpdateMeRequest, type MeResponse, type PremiumInterestState } from '@cs-daily/contracts';
import { ConflictError } from '../../../shared/domain/domain-error';
import { localDateOf } from '../../../shared/domain/local-date';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { CurrentUser, type AuthUser } from '../../../shared/presentation/current-user.decorator';
import { ZodBody } from '../../../shared/presentation/zod-body.pipe';
import { GetCalendarQuery } from '../../progression/application/queries/calendar.handler';
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
  ) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser): Promise<MeResponse> {
    const db = this.uow.client;
    const now = new Date();
    // sortOrder 음수 = 콘텐츠에서 빠진 퇴역 행(seed.ts 참고) — 트랙별 유닛·레슨 수에서 제외한다
    const user = await db.user.findUniqueOrThrow({
      where: { id: auth.id },
      include: {
        stats: true,
        premiumInterest: true,
        userTracks: {
          include: {
            track: { include: { units: { where: { sortOrder: { gt: 0 } }, select: { _count: { select: { lessons: { where: { sortOrder: { gt: 0 } } } } } } } } },
          },
          orderBy: { track: { sortOrder: 'asc' } },
        },
      },
    });
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
      premiumInterest: user.premiumInterest ? toPremiumState(user.premiumInterest) : null,
    };
  }

  /**
   * 프리미엄 사전 신청(수요 검증, 결제 없음) — 사용자당 1건 upsert.
   * 알림 동의는 요청이 명시적으로 true일 때만 저장된다(기본 꺼짐).
   */
  @Put('premium-interest')
  async putPremiumInterest(@CurrentUser() auth: AuthUser, @Body(new ZodBody(PremiumInterestRequest)) body: PremiumInterestRequest): Promise<PremiumInterestState> {
    const data = { interests: body.interests, priceBand: body.priceBand, notifyConsent: body.notifyConsent === true };
    const row = await this.uow.client.premiumInterest.upsert({ where: { userId: auth.id }, create: { userId: auth.id, ...data }, update: data });
    return toPremiumState(row);
  }

  /** 신청 취소 — 행을 삭제한다(없어도 204) */
  @Delete('premium-interest')
  @HttpCode(204)
  async deletePremiumInterest(@CurrentUser() auth: AuthUser): Promise<void> {
    await this.uow.client.premiumInterest.deleteMany({ where: { userId: auth.id } });
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
      select: { id: true, nickname: true, timezone: true, dailyGoal: true, reminderAt: true, codeLanguage: true },
    });
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

function toPremiumState(row: { interests: string[]; priceBand: PremiumInterestState['priceBand']; notifyConsent: boolean; updatedAt: Date }): PremiumInterestState {
  return { interests: row.interests as PremiumInterestState['interests'], priceBand: row.priceBand, notifyConsent: row.notifyConsent, updatedAt: row.updatedAt.toISOString() };
}
