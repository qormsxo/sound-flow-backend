import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * AI 음원 추천 스트리밍 요청 바디.
 * POST /ai/recommend/stream
 */
export class RecommendDto {
  /** 예: "차분한", "신나는", "몽환적인" */
  @IsOptional()
  @IsString()
  mood?: string;

  /** 예: "공부", "운동", "수면" */
  @IsOptional()
  @IsString()
  activity?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}
