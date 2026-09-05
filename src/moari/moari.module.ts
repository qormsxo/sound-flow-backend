import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSessionCacheService } from './chat-session-cache.service';
import { Character } from './entities/character.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { MoariChatController } from './moari-chat.controller';
import { MoariChatService } from './moari-chat.service';

@Module({
  imports: [TypeOrmModule.forFeature([Character, ChatMessage])],
  controllers: [MoariChatController],
  providers: [ChatSessionCacheService, MoariChatService],
  exports: [MoariChatService],
})
export class MoariModule {}
