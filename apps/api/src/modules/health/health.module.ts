import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.module';
import { RedisService } from '../common/redis.module';

@Controller('health')
class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    let db: 'up' | 'down' = 'down';
    let cache: 'up' | 'down' = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    try {
      const pong = await this.redis.client.ping();
      cache = pong === 'PONG' ? 'up' : 'down';
    } catch {
      cache = 'down';
    }

    const ok = db === 'up';
    return {
      status: ok ? 'ok' : 'degraded',
      service: 'livra-api',
      version: '0.1.0',
      checks: { db, cache },
      ts: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
