import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * AI 캐릭터(예: '모아리') 메타데이터.
 * personaPrompt는 OpenAI Chat Completions 호출 시 system 메시지로 사용되어
 * 캐릭터의 역할/말투/응답 가이드라인을 결정한다.
 */
@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @Column('text')
  personaPrompt: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
