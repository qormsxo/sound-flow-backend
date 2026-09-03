import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

/**
 * `npm run migration:generate` / `migration:run` 등 TypeORM CLI 전용 DataSource.
 * NestJS 런타임(AppModule)과는 별개로 동작합니다.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_DATABASE ?? 'sound_flow',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
