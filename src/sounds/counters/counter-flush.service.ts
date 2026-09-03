import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';
import { AppConfig } from '../../config/configuration';
import { Sound } from '../entities/sound.entity';
import {
  DOWNLOAD_COUNTER_PREFIX,
  DOWNLOAD_DIRTY_SET,
  PLAY_COUNTER_PREFIX,
  PLAY_DIRTY_SET,
} from '../sounds.service';

/**
 * 재생/다운로드 트래픽 최적화:
 *   - 요청 시점: Redis INCR로만 카운트 (PostgreSQL 부하 없음, O(1) in-memory 연산)
 *   - 주기적 배치: dirty-set에 쌓인 id들을 순회하며 누적분을 PostgreSQL에 UPDATE ... increment
 *
 * 알려진 한계(PoC 수준의 트레이드오프):
 *   GETSET으로 카운터를 읽고 초기화하는 시점과 dirty-set에서 제거하는 시점 사이에
 *   미세한 race window가 존재한다. 다만 카운터 키 자체는 삭제되지 않고 계속 누적되므로
 *   유실 없이 "다음 배치 사이클로 이월"되는 정도이며, 완전한 원자성이 필요하면
 *   Lua 스크립트(EVAL)로 GETSET+SREM을 하나의 커맨드로 묶어 처리할 수 있다.
 */
@Injectable()
export class CounterFlushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CounterFlushService.name);
  private static readonly INTERVAL_NAME = 'sounds-counter-flush';

  constructor(
    @InjectRepository(Sound)
    private readonly soundRepository: Repository<Sound>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const intervalMs = this.configService.get('counter.flushIntervalMs', {
      infer: true,
    });
    const handle = setInterval(() => {
      this.flush().catch((err) =>
        this.logger.error(`카운터 배치 플러시 실패: ${(err as Error).message}`),
      );
    }, intervalMs);
    // @nestjs/schedule의 SchedulerRegistry에 등록해두면 다른 모듈/헬스체크에서도
    // 스케줄 상태를 조회하거나 필요 시 동적으로 제거할 수 있다.
    this.schedulerRegistry.addInterval(CounterFlushService.INTERVAL_NAME, handle);
    this.logger.log(`재생/다운로드 카운터 배치 플러시 시작 (interval=${intervalMs}ms)`);
  }

  onModuleDestroy() {
    if (this.schedulerRegistry.doesExist('interval', CounterFlushService.INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(CounterFlushService.INTERVAL_NAME);
    }
  }

  /** 외부(테스트/수동 트리거 API)에서도 호출할 수 있도록 public 메서드로 노출. */
  async flush(): Promise<{ playFlushed: number; downloadFlushed: number }> {
    const playFlushed = await this.flushCounterGroup(
      PLAY_COUNTER_PREFIX,
      PLAY_DIRTY_SET,
      'playCount',
    );
    const downloadFlushed = await this.flushCounterGroup(
      DOWNLOAD_COUNTER_PREFIX,
      DOWNLOAD_DIRTY_SET,
      'downloadCount',
    );
    return { playFlushed, downloadFlushed };
  }

  private async flushCounterGroup(
    counterPrefix: string,
    dirtySetKey: string,
    column: 'playCount' | 'downloadCount',
  ): Promise<number> {
    const dirtyIds = await this.redisService.getDirtyMembers(dirtySetKey);
    if (dirtyIds.length === 0) return 0;

    let flushedCount = 0;

    // PoC 목적으로 단순 순회 처리. 트래픽이 매우 크다면 청크 단위 Promise.all + 커넥션 풀 크기 고려 필요.
    for (const soundId of dirtyIds) {
      const delta = await this.redisService.takeCounterDelta(
        `${counterPrefix}${soundId}`,
      );
      await this.redisService.removeFromDirtySet(dirtySetKey, soundId);

      if (delta > 0) {
        await this.soundRepository.increment({ id: soundId }, column, delta);
        flushedCount++;
      }
    }

    if (flushedCount > 0) {
      this.logger.log(`[Batch Update] sounds.${column} ${flushedCount}건 반영 완료`);
    }
    return flushedCount;
  }
}
