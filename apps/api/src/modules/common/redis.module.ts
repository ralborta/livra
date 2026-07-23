import { Global, Module, OnModuleDestroy, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    this.client.connect().catch(() => {
      // Redis opcional en boot; health lo reporta
    });
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
