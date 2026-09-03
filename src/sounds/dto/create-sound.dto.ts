import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { SoundType } from '../entities/sound.entity';

export class CreateSoundDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  artist?: string;

  @IsOptional()
  @IsEnum(SoundType)
  type?: SoundType = SoundType.BGM;

  @IsString()
  genre: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(400)
  bpm: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsString()
  fileUrl: string;
}
