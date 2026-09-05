import { Injectable, Logger, MessageEvent, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { ChatSessionCacheService } from './chat-session-cache.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Character } from './entities/character.entity';
import { ChatMessage, ChatMessageRole } from './entities/chat-message.entity';
import { MOARI_CHARACTER_NAME, MOARI_PERSONA_PROMPT } from './moari.persona';

/**
 * '모아리' AI 캐릭터 챗의 핵심 로직.
 *
 * 흐름:
 *   1) Redis 세션 캐시(ChatSessionCacheService)에서 최근 대화 컨텍스트 로드
 *   2) 사용자 메시지를 PostgreSQL(영구 저장) + Redis(컨텍스트 캐시)에 즉시 반영
 *   3) 실제 OpenAI Chat Completions API를 stream: true로 호출 -> 델타 토큰을 SSE로 실시간 전송
 *   4) 스트리밍 종료 후 모아리의 최종 답변을 PostgreSQL + Redis에 반영
 */
@Injectable()
export class MoariChatService implements OnModuleInit {
  private readonly logger = new Logger(MoariChatService.name);
  private readonly openai: OpenAI;
  private readonly model: string;
  private moariCharacterId: string;

  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    private readonly sessionCache: ChatSessionCacheService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    const apiKey = this.configService.get('openai.apiKey', { infer: true });
    this.model = this.configService.get('openai.model', { infer: true });

    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY가 설정되지 않았습니다. /moari/chat/stream 호출 시 인증 오류가 발생합니다.',
      );
    }
    this.openai = new OpenAI({ apiKey: apiKey || 'sk-not-configured' });
  }

  /** 앱 기동 시 '모아리' 캐릭터가 없으면 기본 페르소나로 자동 생성(upsert)한다. */
  async onModuleInit(): Promise<void> {
    const existing = await this.characterRepository.findOne({
      where: { name: MOARI_CHARACTER_NAME },
    });

    if (existing) {
      this.moariCharacterId = existing.id;
      return;
    }

    const created = await this.characterRepository.save(
      this.characterRepository.create({
        name: MOARI_CHARACTER_NAME,
        personaPrompt: MOARI_PERSONA_PROMPT,
      }),
    );
    this.moariCharacterId = created.id;
    this.logger.log(`'${MOARI_CHARACTER_NAME}' 캐릭터 기본 페르소나 생성 완료 (id=${created.id})`);
  }

  /**
   * 모아리와의 실시간 SSE 대화 스트리밍.
   * SSE 이벤트 타입: start -> token(N회, 글자/토큰 단위) -> done | error
   */
  chatStream(dto: SendMessageDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;

      (async () => {
        try {
          // 1) Redis 세션 캐시에서 최근 대화 컨텍스트(최대 10건) 로드
          const recentContext = await this.sessionCache.getRecentMessages(dto.userId);

          // 2) 사용자 메시지를 DB + Redis에 즉시 반영
          await this.persistAndCache(dto.userId, ChatMessageRole.USER, dto.message);

          const contextMessages: OpenAI.ChatCompletionMessageParam[] = recentContext.map(
            (m) => ({ role: m.role as 'user' | 'assistant', content: m.content }),
          );

          const messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: MOARI_PERSONA_PROMPT },
            ...contextMessages,
            { role: 'user', content: dto.message },
          ];

          subscriber.next({
            type: 'start',
            data: JSON.stringify({ character: MOARI_CHARACTER_NAME }),
          });

          // 3) OpenAI Chat Completions 스트리밍 호출
          const stream = await this.openai.chat.completions.create({
            model: this.model,
            messages,
            stream: true,
            temperature: 0.8,
          });

          let fullText = '';
          for await (const chunk of stream) {
            if (closed) return;
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              subscriber.next({ type: 'token', data: delta });
            }
          }

          // 4) 모아리의 최종 답변을 DB + Redis에 반영
          await this.persistAndCache(dto.userId, ChatMessageRole.ASSISTANT, fullText);

          subscriber.next({ type: 'done', data: JSON.stringify({ fullText }) });
          subscriber.complete();
        } catch (err) {
          this.logger.error(`모아리 챗 스트리밍 실패: ${(err as Error).message}`);
          subscriber.next({
            type: 'error',
            data: JSON.stringify({ message: (err as Error).message }),
          });
          subscriber.complete();
        }
      })();

      return () => {
        closed = true;
      };
    });
  }

  private async persistAndCache(
    userId: string,
    role: ChatMessageRole,
    content: string,
  ): Promise<void> {
    if (!content) return;

    await Promise.all([
      this.chatMessageRepository.save(
        this.chatMessageRepository.create({
          characterId: this.moariCharacterId,
          userId,
          role,
          content,
        }),
      ),
      this.sessionCache.appendMessage(userId, { role, content }),
    ]);
  }
}
