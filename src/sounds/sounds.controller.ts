import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSoundDto } from './dto/create-sound.dto';
import { SearchSoundDto } from './dto/search-sound.dto';
import { Sound } from './entities/sound.entity';
import { SoundsService } from './sounds.service';

@ApiTags('sounds')
@Controller('sounds')
export class SoundsController {
  constructor(private readonly soundsService: SoundsService) {}

  /**
   * 장르 / BPM / 태그 기반 검색.
   * 예) GET /sounds?genre=lofi&bpmMin=80&bpmMax=100&tags=chill,study
   * Redis Look-Aside 캐시가 적용되어, 동일 조건 재요청 시 DB 부하 없이 응답한다.
   */
  @ApiOperation({
    summary: '음원/효과음 검색 (장르 · BPM 범위 · 태그)',
    description:
      'Redis Look-Aside 캐시가 적용됩니다. 동일 조건으로 재요청하면 PostgreSQL 접근 없이 ' +
      '캐시에서 즉시 응답하며, 응답의 `cached` 필드로 캐시 HIT 여부를 확인할 수 있습니다.',
  })
  @ApiOkResponse({ description: '페이지네이션된 검색 결과' })
  @Get()
  search(@Query() dto: SearchSoundDto) {
    return this.soundsService.search(dto);
  }

  @ApiOperation({ summary: '음원 단건 조회' })
  @ApiParam({ name: 'id', description: '음원 UUID' })
  @ApiOkResponse({ type: Sound })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.soundsService.findOne(id);
  }

  @ApiOperation({ summary: '음원/효과음 메타데이터 등록' })
  @ApiCreatedResponse({ type: Sound })
  @Post()
  create(@Body() dto: CreateSoundDto) {
    return this.soundsService.create(dto);
  }

  /** 재생 이벤트: Redis 카운터만 증가시키고 즉시 응답 (DB는 배치로 나중에 반영). */
  @ApiOperation({
    summary: '재생 이벤트 등록',
    description:
      'PostgreSQL을 직접 UPDATE하지 않고 Redis 카운터(INCR)만 증가시킨 뒤 즉시 202로 응답합니다. ' +
      'DB 반영은 CounterFlushService의 주기적 Batch Update가 담당합니다.',
  })
  @ApiParam({ name: 'id', description: '음원 UUID' })
  @ApiAcceptedResponse({ description: 'Redis 카운터에 반영 완료 (PostgreSQL은 배치로 이후 반영)' })
  @Post(':id/play')
  @HttpCode(HttpStatus.ACCEPTED)
  registerPlay(@Param('id', ParseUUIDPipe) id: string) {
    return this.soundsService.registerPlay(id);
  }

  /** 다운로드 이벤트: 재생과 동일한 방식의 카운터 최적화 적용. */
  @ApiOperation({
    summary: '다운로드 이벤트 등록',
    description: '재생 이벤트와 동일한 방식의 Redis 카운터 최적화가 적용됩니다.',
  })
  @ApiParam({ name: 'id', description: '음원 UUID' })
  @ApiAcceptedResponse({ description: 'Redis 카운터에 반영 완료 (PostgreSQL은 배치로 이후 반영)' })
  @Post(':id/download')
  @HttpCode(HttpStatus.ACCEPTED)
  registerDownload(@Param('id', ParseUUIDPipe) id: string) {
    return this.soundsService.registerDownload(id);
  }
}
