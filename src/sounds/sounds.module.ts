import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CounterFlushService } from './counters/counter-flush.service';
import { Sound } from './entities/sound.entity';
import { SoundsController } from './sounds.controller';
import { SoundsService } from './sounds.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sound])],
  controllers: [SoundsController],
  providers: [SoundsService, CounterFlushService],
  exports: [SoundsService],
})
export class SoundsModule {}
