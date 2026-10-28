import { Module } from '@nestjs/common';
import { XP_LEDGER_PORT } from '../quests/domain/ports';
import { RecordSessionCompletionHandler } from './application/commands/record-session-completion.handler';
import { ApplyMissedDaysHandler, RefillFreezesHandler } from './application/commands/streak-batch.handlers';
import { GetCalendarHandler } from './application/queries/calendar.handler';
import { XpLedgerAdapter } from './infrastructure/xp-ledger.adapter';

/** Progression 컨텍스트: XP 원장·일별 활동·스트릭·레슨 진행도. Quests에 XpLedgerPort 제공. 리그는 2단계 */
@Module({
  providers: [RecordSessionCompletionHandler, ApplyMissedDaysHandler, RefillFreezesHandler, GetCalendarHandler, XpLedgerAdapter, { provide: XP_LEDGER_PORT, useExisting: XpLedgerAdapter }],
  exports: [XP_LEDGER_PORT],
})
export class ProgressionModule {}
