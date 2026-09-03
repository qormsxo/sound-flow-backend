import { Injectable, Logger } from '@nestjs/common';
import { AiChatMessage, AiProvider } from './ai-provider.interface';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * AI_PROVIDER_API_KEY가 설정되지 않았을 때 사용되는 데모용 Mock 스트리밍 provider.
 * 실제 LLM 호출 없이도 SSE 스트리밍 응답 구조(토큰 단위 전송)를 그대로 검증할 수 있다.
 */
@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAiProvider.name);

  constructor() {
    this.logger.warn(
      'AI_PROVIDER_API_KEY가 설정되지 않아 Mock AI Provider로 동작합니다 (데모/PoC 전용).',
    );
  }

  async *streamCompletion(messages: AiChatMessage[]): AsyncIterable<string> {
    const userMessage = [...messages].reverse().find((m) => m.role === 'user');
    const systemMessage = messages.find((m) => m.role === 'system');

    const reply = this.buildCannedReply(systemMessage?.content, userMessage?.content);
    const tokens = reply.split(/(?<=[\s,.!?])/); // 공백/구두점 기준으로 토큰 분할하여 타이핑 효과 연출

    for (const token of tokens) {
      await sleep(35);
      yield token;
    }
  }

  private buildCannedReply(systemPrompt?: string, userMessage?: string): string {
    const persona = systemPrompt?.includes('DJ') ? 'DJ 노바' : '머핀';
    const topic = userMessage?.trim() || '오늘 하루';

    return (
      `안녕! 나는 ${persona}야. "${topic}"에 대해 이야기해줘서 고마워. ` +
      `지금 기분에 어울리는 BGM을 같이 찾아볼까? ` +
      `Lo-fi나 Chill 계열의 잔잔한 트랙부터, 텐션을 올려줄 신나는 트랙까지 다양하게 추천해줄 수 있어. ` +
      `원하는 장르나 BPM 범위를 알려주면 더 정확하게 골라줄게! (이 응답은 Mock AI Provider가 생성한 데모용 답변입니다)`
    );
  }
}
