import { Body, Controller, Post, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { RecommendDto } from './dto/recommend.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * AI 캐릭터 챗 스트리밍.
   * Server-Sent Events(text/event-stream)로 토큰 단위 응답을 전송한다.
   *
   * 클라이언트 예시 (fetch + ReadableStream, POST 바디가 필요해 EventSource 대신 fetch 사용):
   *   const res = await fetch('/ai/chat/stream', { method: 'POST', body: JSON.stringify({...}) });
   *   const reader = res.body.getReader();
   */
  @Post('chat/stream')
  @Sse()
  chatStream(@Body() dto: ChatDto): Observable<MessageEvent> {
    return this.aiService.chatStream(dto);
  }

  /**
   * AI 음원 추천 스트리밍.
   * 후보 음원 수 -> AI 코멘터리(토큰 단위) -> 최종 추천 결과(JSON) 순으로 이벤트를 전송한다.
   */
  @Post('recommend/stream')
  @Sse()
  recommendStream(@Body() dto: RecommendDto): Observable<MessageEvent> {
    return this.aiService.recommendStream(dto);
  }
}
