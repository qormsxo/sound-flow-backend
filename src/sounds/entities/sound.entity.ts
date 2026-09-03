import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SoundType {
  BGM = 'BGM',
  SFX = 'SFX',
}

/**
 * 음원/효과음 메타데이터.
 * genre / bpm / tags 조합으로 검색되며, 해당 검색 결과는 Redis에 Look-Aside 방식으로 캐싱된다.
 */
@Entity('sounds')
@Index(['genre'])
@Index(['bpm'])
export class Sound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 120, nullable: true })
  artist?: string;

  @Column({ type: 'enum', enum: SoundType, default: SoundType.BGM })
  type: SoundType;

  @Column({ length: 60 })
  genre: string;

  @Column({ type: 'int' })
  bpm: number;

  /** PostgreSQL text[] 컬럼. 예: ['lofi', 'chill', 'study'] */
  @Column('text', { array: true, default: () => "'{}'" })
  tags: string[];

  @Column({ type: 'int', default: 0 })
  durationSec: number;

  @Column({ length: 500 })
  fileUrl: string;

  @Column({ type: 'bigint', default: 0 })
  playCount: number;

  @Column({ type: 'bigint', default: 0 })
  downloadCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
