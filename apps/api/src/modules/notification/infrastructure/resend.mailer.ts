import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Mailer, MailMessage } from '../domain/mailer.port';

/** Resend 어댑터. API 키가 없으면(로컬) 로그로 대체한다 */
@Injectable()
export class ResendMailer implements Mailer {
  private readonly logger = new Logger(ResendMailer.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY');
    // 키가 아직 없으면 Secret Manager에는 'unset' 자리 값이 들어 있다 → dry-run
    this.client = key && key !== 'unset' ? new Resend(key) : null;
    this.from = config.get('MAIL_FROM', 'CS Daily <onboarding@resend.dev>');
  }

  async send(msg: MailMessage): Promise<void> {
    if (!this.client) {
      this.logger.log(`[dry-run] to=${msg.to} subject=${msg.subject}`);
      return;
    }
    const { error } = await this.client.emails.send({ from: this.from, to: msg.to, subject: msg.subject, text: msg.text });
    if (error) throw new Error(error.message);
  }
}
