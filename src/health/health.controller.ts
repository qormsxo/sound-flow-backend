import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { RedisService } from '../common/redis/redis.service';
import { Sound } from '../sounds/entities/sound.entity';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectRepository(Sound) private readonly soundRepository: Repository<Sound>,
    private readonly redisService: RedisService,
  ) {}

  @ApiOperation({ summary: 'PostgreSQL / Redis 연결 상태 점검' })
  @ApiOkResponse({ description: 'status: ok | degraded' })
  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);

    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      postgres: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.soundRepository.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redisService.getClient().ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
