export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/**
 * AI 캐릭터 챗 / 음원 추천 코멘터리에 공통으로 사용하는 스트리밍 provider 인터페이스.
 * 구현체를 교체(Mock <-> 실제 OpenAI 호환 API)해도 AiService 로직은 변경되지 않는다.
 */
export interface AiProvider {
  readonly name: string;
  streamCompletion(messages: AiChatMessage[]): AsyncIterable<string>;
}
