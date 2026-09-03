import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sound } from '../sounds/entities/sound.entity';
import { HealthController } from './health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sound])],
  controllers: [HealthController],
})
export class HealthModule {}
