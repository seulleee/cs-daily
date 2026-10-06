import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SendRemindersHandler } from './application/send-reminders.handler';
import { MAILER } from './domain/mailer.port';
import { ResendMailer } from './infrastructure/resend.mailer';

/** Notification 컨텍스트: 리마인더 이메일(MVP), 웹 푸시(2단계) */
@Module({
  imports: [ConfigModule],
  providers: [{ provide: MAILER, useClass: ResendMailer }, SendRemindersHandler],
})
export class NotificationModule {}
