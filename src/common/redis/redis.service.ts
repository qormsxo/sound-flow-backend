import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * ioredis 클라이언트를 감싸는 얇은 서비스 레이어.
 * - Look-Aside 캐싱(JSON get/set)
 * - 재생/다운로드 카운트 집계를 위한 원자적 INCR + dirty-set 관리
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  getClient(): Redis {
    return this.client;
  }

  // ---------------------------------------------------------------------
  // Look-Aside 캐싱 헬퍼 (JSON 직렬화)
  // ---------------------------------------------------------------------

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`캐시 파싱 실패 (key=${key}): ${(err as Error).message}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  /** 패턴에 해당하는 캐시 키들을 무효화한다 (예: 신규 음원 등록 시 검색 캐시 초기화). */
  async invalidateByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      if (keys.length) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }

  // ---------------------------------------------------------------------
  // 재생/다운로드 카운트 집계 (In-Memory Counter -> Batch Update)
  // ---------------------------------------------------------------------

  /**
   * 카운터를 원자적으로 증가시키고, 배치 플러시 대상에 등록(dirty-set)한다.
   * INCR + SADD 두 커맨드를 파이프라인으로 묶어 왕복(RTT)을 최소화한다.
   */
  async incrementCounter(counterKey: string, dirtySetKey: string, member: string): Promise<number> {
    const pipeline = this.client.pipeline();
    pipeline.incr(counterKey);
    pipeline.sadd(dirtySetKey, member);
    const results = await pipeline.exec();
    const incrResult = results?.[0];
    if (!incrResult || incrResult[0]) {
      throw incrResult?.[0] ?? new Error('Redis INCR 실패');
    }
    return incrResult[1] as number;
  }

  async getDirtyMembers(dirtySetKey: string): Promise<string[]> {
    return this.client.smembers(dirtySetKey);
  }

  /**
   * 카운터 값을 원자적으로 읽고 0으로 초기화한다 (GETSET 사용).
   * 반환값은 "지금까지 누적된, 아직 DB에 반영되지 않은 증가분"이다.
   */
  async takeCounterDelta(counterKey: string): Promise<number> {
    const previous = await this.client.getset(counterKey, '0');
    return parseInt(previous ?? '0', 10) || 0;
  }

  async removeFromDirtySet(dirtySetKey: string, member: string): Promise<void> {
    await this.client.srem(dirtySetKey, member);
  }
}
