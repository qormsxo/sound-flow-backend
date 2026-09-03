import { Global, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

/**
 * ioredis 클라이언트를 애플리케이션 전역에서 하나만 생성해 공유하는 모듈.
 * @Global 데코레이터로 다른 모듈에서 별도 import 없이 RedisService를 주입받을 수 있습니다.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const logger = new Logger('RedisClient');
        const client = new Redis({
          host: configService.get('redis.host', { infer: true }),
          port: configService.get('redis.port', { infer: true }),
          password: configService.get('redis.password', { infer: true }),
          lazyConnect: false,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });

        client.on('connect', () => logger.log('Redis 연결 성공'));
        client.on('error', (err) => logger.error(`Redis 연결 에러: ${err.message}`));

        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly redisService: RedisService) {}

  async onModuleDestroy() {
    await this.redisService.getClient().quit();
  }
}
