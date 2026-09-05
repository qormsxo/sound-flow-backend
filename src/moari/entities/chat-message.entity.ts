import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * 사용자 <-> AI 캐릭터 대화 내역(영구 저장).
 * 실시간 컨텍스트는 Redis(ChatSessionCacheService)의 최근 N건 캐시를 사용하고,
 * 전체 히스토리/감사(audit) 목적으로는 이 PostgreSQL 테이블을 사용한다.
 */
@Entity('chat_messages')
@Index(['characterId', 'userId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  characterId: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: ChatMessageRole })
  role: ChatMessageRole;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
