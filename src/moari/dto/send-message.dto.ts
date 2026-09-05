import { IsString, MinLength } from 'class-validator';

/**
 * 모아리 챗 스트리밍 요청 바디.
 * POST /moari/chat/stream
 */
export class SendMessageDto {
  /** 대화 컨텍스트(Redis 세션 캐시)를 구분하는 사용자 식별자 */
  @IsString()
  @MinLength(1)
  userId: string;

  @IsString()
  @MinLength(1)
  message: string;
}
