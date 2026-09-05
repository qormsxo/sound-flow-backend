import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

const SWAGGER_PATH = 'api-docs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // public/ 폴더를 정적 파일로 서빙 (모아리 챗 테스트용 웹 UI: /chat.html)
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const configService = app.get(ConfigService<AppConfig, true>);
  const port = configService.get('port', { infer: true });

  setupSwagger(app);

  await app.listen(port);
  Logger.log(`🚀 sound-flow-backend listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📘 Swagger UI: http://localhost:${port}/${SWAGGER_PATH}`, 'Bootstrap');
  Logger.log(`💬 모아리 챗 테스트 UI: http://localhost:${port}/chat.html`, 'Bootstrap');
}

/**
 * Swagger(OpenAPI) 문서 설정.
 * - DTO의 @ApiProperty는 nest-cli.json의 "@nestjs/swagger" 컴파일러 플러그인이
 *   class-validator 데코레이터 + TS 타입을 기반으로 자동 생성해준다 (수동 어노테이션 최소화).
 * - AI 챗/추천 API는 SSE(text/event-stream) 스트리밍이라 Swagger UI의 "Try it out"으로는
 *   완전히 확인하기 어려우니, 요청/응답 스키마 확인용으로만 참고하고 실제 테스트는 curl/fetch를 권장.
 */
function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Sound Flow Backend API')
    .setDescription(
      'Mupat(뮤팟) 대용량 AI BGM 검색 & AI 캐릭터 챗/메타데이터 처리 PoC API 문서.\n' +
        '- sounds: 장르/BPM/태그 검색(Redis Look-Aside 캐싱), 재생/다운로드 카운트\n' +
        '- ai: AI 캐릭터 챗 / AI 음원 추천 (SSE 스트리밍)\n' +
        '- health: PostgreSQL / Redis 연결 상태 점검',
    )
    .setVersion('0.1.0')
    .addTag('sounds', '음원/효과음 검색 및 재생·다운로드 카운트')
    .addTag('ai', 'AI 캐릭터 챗 / AI 음원 추천 (SSE 스트리밍)')
    .addTag('health', '헬스체크')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}

bootstrap();
