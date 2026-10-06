import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from './shared/infrastructure/prisma.service';

/** Cloud Run 헬스체크·Supabase 일시정지 방지용 가벼운 DB 핑 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, at: new Date().toISOString() };
  }
}
