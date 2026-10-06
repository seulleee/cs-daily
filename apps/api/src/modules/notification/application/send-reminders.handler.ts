import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { localDateOf, localTimeOf } from '../../../shared/domain/local-date';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import { MAILER, type Mailer } from '../domain/mailer.port';

export class SendRemindersCommand {
  constructor(readonly now: Date) {}
}

/** Resend 무료 100통/일 한도를 넘지 않도록 한 슬롯당 상한 */
const PER_RUN_LIMIT = 80;

/**
 * 매시 슬롯: reminder_at의 "시" 자리가 사용자 로컬 현재 시와 같고, 오늘 목표를 아직 못 채운 사용자에게 이메일.
 * notification_log(user, kind, slot) UNIQUE로 같은 날 중복 발송 방지.
 */
@CommandHandler(SendRemindersCommand)
export class SendRemindersHandler implements ICommandHandler<SendRemindersCommand, { sent: number; skipped: number }> {
  private readonly logger = new Logger(SendRemindersHandler.name);
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async execute({ now }: SendRemindersCommand) {
    const db = this.uow.client;
    const users = await db.user.findMany({ where: { reminderAt: { not: null } }, select: { id: true, email: true, nickname: true, timezone: true, reminderAt: true, dailyGoal: true, stats: { select: { currentStreak: true } } } });
    let sent = 0;
    let skipped = 0;
    for (const u of users) {
      if (sent >= PER_RUN_LIMIT) break;
      const localHour = localTimeOf(now, u.timezone).slice(0, 2);
      if (!u.reminderAt || u.reminderAt.slice(0, 2) !== localHour) continue;
      const today = localDateOf(now, u.timezone);
      const activity = await db.dailyActivity.findUnique({ where: { userId_activityDate: { userId: u.id, activityDate: new Date(`${today}T00:00:00Z`) } } });
      if ((activity?.lessonsCompleted ?? 0) >= u.dailyGoal) {
        skipped += 1;
        continue;
      }
      const slot = `reminder:${today}`;
      const already = await db.notificationLog.findUnique({ where: { userId_kind_slot: { userId: u.id, kind: 'reminder', slot } } });
      if (already) {
        skipped += 1;
        continue;
      }
      try {
        await this.mailer.send({
          to: u.email,
          subject: u.stats?.currentStreak ? `🔥 ${u.stats.currentStreak}일 스트릭이 오늘 끝날 수 있어요` : '오늘의 CS 한 레슨, 5분이면 충분해요',
          text: `${u.nickname}님, 오늘 아직 레슨을 풀지 않았어요. ${process.env.WEB_BASE_URL ?? ''}/learn 에서 한 레슨만 풀어도 스트릭이 이어집니다.`,
        });
        await db.notificationLog.create({ data: { userId: u.id, kind: 'reminder', slot } });
        sent += 1;
      } catch (err) {
        this.logger.warn(`reminder failed user=${u.id}: ${(err as Error).message}`);
      }
    }
    return { sent, skipped };
  }
}
