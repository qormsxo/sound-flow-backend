import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfig } from './configuration';

/**
 * ConfigModule과 연동되는 TypeORM 옵션 팩토리.
 * NestJS 애플리케이션 부트스트랩(AppModule) 시 사용됩니다.
 */
export const typeOrmConfigFactory = (
  configService: ConfigService<AppConfig, true>,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('db.host', { infer: true }),
  port: configService.get('db.port', { infer: true }),
  username: configService.get('db.username', { infer: true }),
  password: configService.get('db.password', { infer: true }),
  database: configService.get('db.database', { infer: true }),
  autoLoadEntities: true,
  // PoC 편의를 위해 기본 true. 운영 환경에서는 반드시 false + 마이그레이션 사용 권장.
  synchronize: configService.get('db.synchronize', { infer: true }),
  logging: configService.get('nodeEnv', { infer: true }) === 'development',
});
