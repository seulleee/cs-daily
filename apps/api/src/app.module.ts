import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SharedModule } from './shared/infrastructure/shared.module';
import { DomainExceptionFilter } from './shared/presentation/domain-exception.filter';
import { IdentityModule } from './modules/identity/identity.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { LearningModule } from './modules/learning/learning.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { ReviewModule } from './modules/review/review.module';
import { NotificationModule } from './modules/notification/notification.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    // MVP: 인스턴스별 인메모리 레이트 리밋. 2단계에 Redis 스토리지로 교체
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    SharedModule,
    IdentityModule,
    CurriculumModule,
    LearningModule,
    ProgressionModule,
    ReviewModule,
    NotificationModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
