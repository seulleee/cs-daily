import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from './prisma.service';
import { UnitOfWork } from './unit-of-work';

/** 모든 컨텍스트 모듈이 공유하는 인프라: Prisma, UnitOfWork, CQRS 버스 */
@Global()
@Module({
  imports: [CqrsModule],
  providers: [PrismaService, UnitOfWork],
  exports: [PrismaService, UnitOfWork, CqrsModule],
})
export class SharedModule {}
