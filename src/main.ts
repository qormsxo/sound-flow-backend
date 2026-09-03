import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const configService = app.get(ConfigService<AppConfig, true>);
  const port = configService.get('port', { infer: true });

  await app.listen(port);
  Logger.log(`🚀 sound-flow-backend listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
