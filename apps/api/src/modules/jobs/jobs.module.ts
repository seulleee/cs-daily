import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationModule } from '../notification/notification.module';
import { ProgressionModule } from '../progression/progression.module';
import { JobsController } from './jobs.controller';

@Module({
  imports: [ConfigModule, ProgressionModule, NotificationModule],
  controllers: [JobsController],
})
export class JobsModule {}
