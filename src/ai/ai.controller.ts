import { Body, Controller, Post, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { RecommendDto } from './dto/recommend.dto';

@ApiTags('ai')
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
  @ApiOperation({
    summary: 'AI 캐릭터 챗 스트리밍 (SSE)',
    description:
      'text/event-stream 으로 `start` → `token`(N회, 토큰 단위) → `done`|`error` 이벤트가 순차 전송됩니다. ' +
      'Swagger UI "Try it out"은 스트리밍 응답을 온전히 보여주지 못하므로, 실제 확인은 curl -N 또는 fetch + ' +
      'ReadableStream을 권장합니다. (예: curl -N -X POST /ai/chat/stream -d \'{"characterId":"muffin","message":"안녕"}\')',
  })
  @ApiProduces('text/event-stream')
  @Post('chat/stream')
  @Sse()
  chatStream(@Body() dto: ChatDto): Observable<MessageEvent> {
    return this.aiService.chatStream(dto);
  }

  /**
   * AI 음원 추천 스트리밍.
   * 후보 음원 수 -> AI 코멘터리(토큰 단위) -> 최종 추천 결과(JSON) 순으로 이벤트를 전송한다.
   */
  @ApiOperation({
    summary: 'AI 음원 추천 스트리밍 (SSE)',
    description:
      '`candidates`(후보 수) → `commentary`(AI 코멘터리 토큰 스트림) → `result`(최종 추천 JSON) 순으로 ' +
      '이벤트가 전송됩니다. 후보군은 /sounds 검색 API와 동일한 Redis Look-Aside 캐시를 재사용합니다.',
  })
  @ApiProduces('text/event-stream')
  @Post('recommend/stream')
  @Sse()
  recommendStream(@Body() dto: RecommendDto): Observable<MessageEvent> {
    return this.aiService.recommendStream(dto);
  }
}
