import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SoundType } from '../entities/sound.entity';

/**
 * 장르 / BPM 범위 / 태그 기반 검색 조건.
 * GET /sounds?genre=lofi&bpmMin=80&bpmMax=100&tags=chill,study&page=1&limit=20
 */
export class SearchSoundDto {
  @IsOptional()
  @IsEnum(SoundType)
  type?: SoundType;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bpmMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(400)
  bpmMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').map((v) => v.trim()).filter(Boolean)
        : value,
  )
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
