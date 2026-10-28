import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SharedModule } from './shared/infrastructure/shared.module';
import { IpThrottlerGuard, USER_SEARCH_THROTTLER } from './shared/presentation/user-throttler.guard';
import { DomainExceptionFilter } from './shared/presentation/domain-exception.filter';
import { IdentityModule } from './modules/identity/identity.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { LearningModule } from './modules/learning/learning.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { ReviewModule } from './modules/review/review.module';
import { NotificationModule } from './modules/notification/notification.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { QuestsModule } from './modules/quests/quests.module';
import { SocialModule } from './modules/social/social.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    // MVP: 인스턴스별 인메모리 레이트 리밋. 2단계에 Redis 스토리지로 교체
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      // 닉네임 검색: 사용자당 분당 30회. UserThrottlerGuard만 센다(전역 IP 가드는 제외)
      { name: USER_SEARCH_THROTTLER, ttl: 60_000, limit: 30 },
    ]),
    SharedModule,
    IdentityModule,
    CurriculumModule,
    LearningModule,
    ProgressionModule,
    ReviewModule,
    NotificationModule,
    JobsModule,
    QuestsModule,
    SocialModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
  ],
})
export class AppModule {}
