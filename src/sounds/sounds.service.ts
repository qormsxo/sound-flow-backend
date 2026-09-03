import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../common/redis/redis.service';
import { AppConfig } from '../config/configuration';
import { CreateSoundDto } from './dto/create-sound.dto';
import { SearchSoundDto } from './dto/search-sound.dto';
import { Sound } from './entities/sound.entity';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  cached: boolean;
}

const SEARCH_CACHE_PREFIX = 'cache:sounds:search:';
const SEARCH_CACHE_INVALIDATE_PATTERN = `${SEARCH_CACHE_PREFIX}*`;

// 재생/다운로드 카운트를 위한 Redis 키
export const PLAY_COUNTER_PREFIX = 'counter:play:';
export const DOWNLOAD_COUNTER_PREFIX = 'counter:download:';
export const PLAY_DIRTY_SET = 'dirty:sounds:play';
export const DOWNLOAD_DIRTY_SET = 'dirty:sounds:download';

@Injectable()
export class SoundsService {
  private readonly logger = new Logger(SoundsService.name);
  private readonly searchTtlSeconds: number;

  constructor(
    @InjectRepository(Sound)
    private readonly soundRepository: Repository<Sound>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.searchTtlSeconds = this.configService.get('cache.searchTtlSeconds', {
      infer: true,
    });
  }

  /**
   * 장르 / BPM 범위 / 태그 조건으로 음원을 검색한다.
   * Redis Look-Aside 캐싱 전략:
   *   1) 캐시 조회 -> HIT 시 즉시 반환 (DB 접근 없음)
   *   2) MISS 시 PostgreSQL 조회 -> 결과를 캐시에 저장 후 반환
   */
  async search(dto: SearchSoundDto): Promise<PaginatedResult<Sound>> {
    const cacheKey = this.buildSearchCacheKey(dto);

    const cached = await this.redisService.getJson<PaginatedResult<Sound>>(cacheKey);
    if (cached) {
      this.logger.debug(`[CACHE HIT] ${cacheKey}`);
      return { ...cached, cached: true };
    }
    this.logger.debug(`[CACHE MISS] ${cacheKey} -> PostgreSQL 조회`);

    const qb = this.soundRepository.createQueryBuilder('sound');

    if (dto.type) {
      qb.andWhere('sound.type = :type', { type: dto.type });
    }
    if (dto.genre) {
      qb.andWhere('sound.genre = :genre', { genre: dto.genre });
    }
    if (dto.bpmMin !== undefined) {
      qb.andWhere('sound.bpm >= :bpmMin', { bpmMin: dto.bpmMin });
    }
    if (dto.bpmMax !== undefined) {
      qb.andWhere('sound.bpm <= :bpmMax', { bpmMax: dto.bpmMax });
    }
    if (dto.tags?.length) {
      // PostgreSQL text[] 컬럼에 대해 "주어진 태그를 모두 포함하는가"를 검사
      qb.andWhere('sound.tags @> :tags', { tags: dto.tags });
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    qb.orderBy('sound.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const result: PaginatedResult<Sound> = { items, total, page, limit, cached: false };

    // Look-Aside: DB 조회 결과를 캐시에 채워넣는다 (TTL 만료 기반 무효화)
    await this.redisService.setJson(cacheKey, result, this.searchTtlSeconds);

    return result;
  }

  async findOne(id: string): Promise<Sound> {
    const sound = await this.soundRepository.findOne({ where: { id } });
    if (!sound) {
      throw new NotFoundException(`Sound(${id})를 찾을 수 없습니다.`);
    }
    return sound;
  }

  async create(dto: CreateSoundDto): Promise<Sound> {
    const sound = this.soundRepository.create({
      ...dto,
      tags: dto.tags ?? [],
    });
    const saved = await this.soundRepository.save(sound);

    // 신규 음원 등록으로 검색 결과 스냅샷이 stale해지므로 관련 캐시를 무효화한다.
    await this.redisService.invalidateByPattern(SEARCH_CACHE_INVALIDATE_PATTERN);

    return saved;
  }

  /**
   * 재생 이벤트 발생 시 PostgreSQL을 직접 UPDATE하지 않고
   * Redis In-Memory Counter를 원자적으로 증가시킨다.
   * 실제 DB 반영은 CounterFlushService의 배치 작업이 담당한다.
   */
  async registerPlay(id: string): Promise<{ id: string; queued: boolean }> {
    await this.findOne(id); // 존재하지 않는 음원이면 404
    await this.redisService.incrementCounter(
      `${PLAY_COUNTER_PREFIX}${id}`,
      PLAY_DIRTY_SET,
      id,
    );
    return { id, queued: true };
  }

  async registerDownload(id: string): Promise<{ id: string; queued: boolean }> {
    await this.findOne(id);
    await this.redisService.incrementCounter(
      `${DOWNLOAD_COUNTER_PREFIX}${id}`,
      DOWNLOAD_DIRTY_SET,
      id,
    );
    return { id, queued: true };
  }

  private buildSearchCacheKey(dto: SearchSoundDto): string {
    const normalized = {
      type: dto.type ?? '',
      genre: dto.genre ?? '',
      bpmMin: dto.bpmMin ?? '',
      bpmMax: dto.bpmMax ?? '',
      tags: [...(dto.tags ?? [])].sort(),
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
    };
    return `${SEARCH_CACHE_PREFIX}${JSON.stringify(normalized)}`;
  }
}
