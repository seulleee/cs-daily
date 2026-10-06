import { Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { UnitOfWork } from '../../shared/infrastructure/unit-of-work';
import { SendRemindersCommand } from '../notification/application/send-reminders.handler';
import { ApplyMissedDaysCommand, RefillFreezesCommand } from '../progression/application/commands/commands';

/**
 * 배치 tick (기획서 11절). Cloud Scheduler가 매시 정각에 POST /internal/jobs/tick 호출.
 * 하나의 잡이 현재 UTC 시각으로 슬롯을 정해 커맨드를 분기하고, job_runs(job, slot) UNIQUE로 멱등성을 보장한다.
 *
 * 인증: 로컬·staging은 Authorization: Bearer {JOBS_SECRET}.
 * Cloud Run 배포 시에는 Scheduler의 서비스 계정에 Cloud Run Invoker 권한을 주고, --no-allow-unauthenticated로 두면
 * Cloud Run 앞단에서 OIDC를 검증하므로 애플리케이션은 JOBS_SECRET 체크만 남겨도 된다(이중 방어).
 */
@ApiTags('internal')
@Controller('internal/jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);
  constructor(
    private readonly commandBus: CommandBus,
    private readonly uow: UnitOfWork,
    private readonly config: ConfigService,
  ) {}

  @Post('tick')
  async tick(@Headers('authorization') authorization?: string) {
    this.authorize(authorization);
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.toISOString().slice(0, 10);
    const results: Record<string, unknown> = {};

    // 매시: 리마인더
    results.reminders = await this.runOnce('reminders', `${day}T${String(hour).padStart(2, '0')}`, () => this.commandBus.execute(new SendRemindersCommand(now)));

    // 03:00 UTC: 스트릭 프리즈·리셋 (한국 12:00. 대부분 사용자의 "어제"가 확정된 뒤)
    if (hour === 3) results.missedDays = await this.runOnce('missed-days', day, () => this.commandBus.execute(new ApplyMissedDaysCommand(now)));

    // 매월 1일 00:00 UTC: 프리즈 충전
    if (hour === 0 && now.getUTCDate() === 1) results.refill = await this.runOnce('refill-freezes', day.slice(0, 7), () => this.commandBus.execute(new RefillFreezesCommand(now)));

    return { at: now.toISOString(), results };
  }

  private authorize(authorization?: string) {
    const secret = this.config.get<string>('JOBS_SECRET');
    if (!secret || authorization !== `Bearer ${secret}`) throw new UnauthorizedException('jobs: invalid credential');
  }

  /** job_runs에 (job, slot)을 먼저 INSERT — 이미 있으면 skip. 실패하면 error를 남기고 다음 tick에서 재시도 가능하게 행을 지운다 */
  private async runOnce<T>(job: string, slot: string, fn: () => Promise<T>): Promise<T | { skipped: true }> {
    const db = this.uow.client;
    try {
      await db.jobRun.create({ data: { job, slot } });
    } catch {
      return { skipped: true };
    }
    try {
      const result = await fn();
      await db.jobRun.update({ where: { job_slot: { job, slot } }, data: { finishedAt: new Date() } });
      return result;
    } catch (err) {
      this.logger.error(`job ${job}@${slot} failed: ${(err as Error).message}`);
      await db.jobRun.delete({ where: { job_slot: { job, slot } } }).catch(() => undefined);
      throw err;
    }
  }
}
