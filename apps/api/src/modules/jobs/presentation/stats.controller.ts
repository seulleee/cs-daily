import { Controller, Get, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { GetUsageStatsQuery, type UsageStats } from '../application/get-usage-stats.handler';
import { assertInternalAuth } from './internal-auth';

/** 운영자 전용 사용 지표. /internal/jobs/tick과 같은 JOBS_SECRET Bearer 인증. 응답은 집계뿐이다 */
@ApiTags('internal')
@Controller('internal/stats')
export class StatsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly config: ConfigService,
  ) {}

  @Get()
  stats(@Headers('authorization') authorization?: string): Promise<UsageStats> {
    assertInternalAuth(this.config.get<string>('JOBS_SECRET'), authorization, 'stats');
    return this.queryBus.execute(new GetUsageStatsQuery(new Date()));
  }
}
