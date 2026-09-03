import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { RedisModule } from './common/redis/redis.module';
import configuration, { AppConfig } from './config/configuration';
import { typeOrmConfigFactory } from './config/typeorm.config';
import { HealthModule } from './health/health.module';
import { SoundsModule } from './sounds/sounds.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        typeOrmConfigFactory(configService),
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    SoundsModule,
    AiModule,
    HealthModule,
  ],
})
export class AppModule {}
