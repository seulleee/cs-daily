import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationModule } from '../notification/notification.module';
import { ProgressionModule } from '../progression/progression.module';
import { GetUsageStatsHandler } from './application/get-usage-stats.handler';
import { JobsController } from './jobs.controller';
import { StatsController } from './presentation/stats.controller';

@Module({
  imports: [ConfigModule, ProgressionModule, NotificationModule],
  controllers: [JobsController, StatsController],
  providers: [GetUsageStatsHandler],
})
export class JobsModule {}
