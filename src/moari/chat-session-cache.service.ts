import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { ChatMessageRole } from './entities/chat-message.entity';

export interface CachedChatMessage {
  role: ChatMessageRole;
  content: string;
}

const SESSION_KEY_PREFIX = 'chat:session:';
/** OpenAI 호출 시 컨텍스트로 사용할 최근 대화 최대 건수 */
export const MAX_CONTEXT_MESSAGES = 10;
/** 장시간 미사용 세션 캐시 자동 만료(6시간) */
const SESSION_TTL_SECONDS = 60 * 60 * 6;

/**
 * 사용자별 최근 대화 컨텍스트를 Redis List(`chat:session:{userId}`)에 캐싱한다.
 *
 * - 매 대화(user/assistant 메시지)마다 RPUSH로 추가하고, LTRIM으로 최근
 *   {@link MAX_CONTEXT_MESSAGES}건만 유지한다.
 * - OpenAI 호출 시 이 캐시를 그대로 messages 배열 컨텍스트로 사용하므로,
 *   매 요청마다 PostgreSQL 전체 대화 이력을 조회할 필요가 없어 DB I/O가 최적화된다.
 */
@Injectable()
export class ChatSessionCacheService {
  private readonly logger = new Logger(ChatSessionCacheService.name);

  constructor(private readonly redisService: RedisService) {}

  private key(userId: string): string {
    return `${SESSION_KEY_PREFIX}${userId}`;
  }

  /** 대화 메시지 1건을 세션 캐시에 추가하고, 최근 N건으로 트리밍한다. */
  async appendMessage(userId: string, message: CachedChatMessage): Promise<void> {
    const client = this.redisService.getClient();
    const key = this.key(userId);

    const pipeline = client.pipeline();
    pipeline.rpush(key, JSON.stringify(message));
    // 음수 인덱스는 리스트 끝 기준 -> 최근 MAX_CONTEXT_MESSAGES건만 유지
    pipeline.ltrim(key, -MAX_CONTEXT_MESSAGES, -1);
    pipeline.expire(key, SESSION_TTL_SECONDS);
    await pipeline.exec();
  }

  /** 최근 대화 컨텍스트를 오래된 순서대로 반환한다 (OpenAI messages 배열 순서와 동일). */
  async getRecentMessages(userId: string): Promise<CachedChatMessage[]> {
    const raw = await this.redisService.getClient().lrange(this.key(userId), 0, -1);

    return raw
      .map((item) => this.safeParse(item))
      .filter((message): message is CachedChatMessage => message !== null);
  }

  /** 세션 컨텍스트를 초기화한다 (예: 사용자가 "새 대화 시작"을 요청한 경우). */
  async clearSession(userId: string): Promise<void> {
    await this.redisService.getClient().del(this.key(userId));
  }

  private safeParse(raw: string): CachedChatMessage | null {
    try {
      return JSON.parse(raw) as CachedChatMessage;
    } catch (err) {
      this.logger.warn(`세션 캐시 메시지 파싱 실패: ${(err as Error).message}`);
      return null;
    }
  }
}
