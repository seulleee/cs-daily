import { Module } from '@nestjs/common';
import { RecordSessionCompletionHandler } from './application/commands/record-session-completion.handler';
import { ApplyMissedDaysHandler, RefillFreezesHandler } from './application/commands/streak-batch.handlers';
import { GetCalendarHandler } from './application/queries/calendar.handler';

/** Progression 컨텍스트: XP 원장·일별 활동·스트릭·레슨 진행도. 리그는 2단계 */
@Module({
  providers: [RecordSessionCompletionHandler, ApplyMissedDaysHandler, RefillFreezesHandler, GetCalendarHandler],
})
export class ProgressionModule {}
