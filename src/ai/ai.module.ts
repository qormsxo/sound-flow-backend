import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SoundsModule } from '../sounds/sounds.module';
import { AppConfig } from '../config/configuration';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { MockAiProvider } from './providers/mock-ai.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

@Module({
  imports: [SoundsModule],
  controllers: [AiController],
  providers: [
    AiService,
    MockAiProvider,
    OpenAiCompatibleProvider,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, MockAiProvider, OpenAiCompatibleProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        mockProvider: MockAiProvider,
        openAiProvider: OpenAiCompatibleProvider,
      ) => {
        const apiKey = configService.get('ai.apiKey', { infer: true });
        // API 키가 설정된 경우에만 실제 OpenAI 호환 엔드포인트를 사용하고,
        // 그렇지 않으면 데모/PoC용 Mock Provider로 자동 폴백한다.
        return apiKey ? openAiProvider : mockProvider;
      },
    },
  ],
})
export class AiModule {}
