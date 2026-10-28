import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MeQuestsResponse } from '@cs-daily/contracts';
import { JwtAuthGuard } from '../../identity/presentation/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../shared/presentation/current-user.decorator';
import { GetMyQuestsQuery } from '../application/commands';

/** 컨트롤러는 DTO → 쿼리 변환만 한다. `GET /me`는 identity의 MeController, 여기는 `/me/quests`만 맡는다 */
@ApiTags('quests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class QuestsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('quests')
  quests(@CurrentUser() user: AuthUser): Promise<MeQuestsResponse> {
    return this.queryBus.execute(new GetMyQuestsQuery(user.id, new Date()));
  }
}
