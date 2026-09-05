import { Body, Controller, MessageEvent, Post, Sse } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { SendMessageDto } from './dto/send-message.dto';
import { MoariChatService } from './moari-chat.service';

@ApiTags('moari')
@Controller('moari')
export class MoariChatController {
  constructor(private readonly moariChatService: MoariChatService) {}

  /**
   * 모아리 AI 캐릭터 실시간 챗 (SSE, 실제 OpenAI API 연동).
   *
   * 클라이언트 예시 (POST 바디가 필요해 EventSource 대신 fetch + ReadableStream 사용):
   *   const res = await fetch('/moari/chat/stream', { method: 'POST', body: JSON.stringify({ userId, message }) });
   *   const reader = res.body.getReader();
   *
   * 테스트용 웹 UI: http://localhost:3000/chat.html
   */
  @ApiOperation({
    summary: '모아리 AI 캐릭터 실시간 챗 (SSE, 실제 OpenAI API 연동)',
    description:
      'OpenAI Chat Completions API(stream: true)를 사용해 글자 단위로 실시간 응답을 전송합니다. ' +
      'Redis(chat:session:{userId})에 캐싱된 최근 대화 10건이 컨텍스트로 함께 전달되며, ' +
      '대화 내역은 PostgreSQL(chat_messages)에도 영구 저장됩니다. ' +
      'SSE 이벤트 타입: start -> token(N회) -> done | error.',
  })
  @ApiProduces('text/event-stream')
  @Post('chat/stream')
  @Sse()
  chatStream(@Body() dto: SendMessageDto): Observable<MessageEvent> {
    return this.moariChatService.chatStream(dto);
  }
}
