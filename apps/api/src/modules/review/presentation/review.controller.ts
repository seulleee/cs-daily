import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/presentation/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../shared/presentation/current-user.decorator';
import { GetReviewDueQuery } from '../application/queries/queries';

@ApiTags('review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('due')
  due(@CurrentUser() user: AuthUser) {
    return this.queryBus.execute(new GetReviewDueQuery(user.id, new Date()));
  }
}
