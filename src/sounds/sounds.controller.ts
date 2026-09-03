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
import { CreateSoundDto } from './dto/create-sound.dto';
import { SearchSoundDto } from './dto/search-sound.dto';
import { SoundsService } from './sounds.service';

@Controller('sounds')
export class SoundsController {
  constructor(private readonly soundsService: SoundsService) {}

  /**
   * 장르 / BPM / 태그 기반 검색.
   * 예) GET /sounds?genre=lofi&bpmMin=80&bpmMax=100&tags=chill,study
   * Redis Look-Aside 캐시가 적용되어, 동일 조건 재요청 시 DB 부하 없이 응답한다.
   */
  @Get()
  search(@Query() dto: SearchSoundDto) {
    return this.soundsService.search(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.soundsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSoundDto) {
    return this.soundsService.create(dto);
  }

  /** 재생 이벤트: Redis 카운터만 증가시키고 즉시 응답 (DB는 배치로 나중에 반영). */
  @Post(':id/play')
  @HttpCode(HttpStatus.ACCEPTED)
  registerPlay(@Param('id', ParseUUIDPipe) id: string) {
    return this.soundsService.registerPlay(id);
  }

  /** 다운로드 이벤트: 재생과 동일한 방식의 카운터 최적화 적용. */
  @Post(':id/download')
  @HttpCode(HttpStatus.ACCEPTED)
  registerDownload(@Param('id', ParseUUIDPipe) id: string) {
    return this.soundsService.registerDownload(id);
  }
}
