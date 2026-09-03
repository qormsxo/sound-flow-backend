import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { AiChatMessage, AiProvider } from './ai-provider.interface';

/**
 * OpenAI Chat Completions API(및 호환 엔드포인트: Azure OpenAI, vLLM, Ollama 등)를
 * `stream: true` 옵션으로 호출하여 토큰 단위 응답을 그대로 흘려보내는 provider.
 *
 * Node 18+ 내장 fetch + ReadableStream을 사용하며, 별도 SDK 의존성이 없다.
 */
@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai-compatible';
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async *streamCompletion(messages: AiChatMessage[]): AsyncIterable<string> {
    const baseUrl = this.configService.get('ai.baseUrl', { infer: true });
    const apiKey = this.configService.get('ai.apiKey', { infer: true });
    const model = this.configService.get('ai.model', { infer: true });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.8,
      }),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `AI Provider 호출 실패 (status=${response.status}): ${errorBody.slice(0, 300)}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // OpenAI SSE 포맷은 "data: {...}\n\n" 단위로 이벤트가 구분된다.
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data:')) continue;

        const payload = line.slice('data:'.length).trim();
        if (payload === '[DONE]') return;

        try {
          const parsed = JSON.parse(payload);
          const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch (err) {
          this.logger.warn(`SSE payload 파싱 실패: ${(err as Error).message}`);
        }
      }
    }
  }
}
