import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChatHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

/**
 * AI 캐릭터 챗 스트리밍 요청 바디.
 * POST /ai/chat/stream
 */
export class ChatDto {
  @IsString()
  @MinLength(1)
  characterId: string;

  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  history?: ChatHistoryMessageDto[];
}
