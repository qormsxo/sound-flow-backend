import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SoundType } from '../sounds/entities/sound.entity';
import { SoundsService } from '../sounds/sounds.service';

/**
 * 검색/캐싱/AI 추천 데모를 위한 샘플 음원 데이터 시드 스크립트.
 * 실행: npm run seed
 */
const SAMPLE_SOUNDS = [
  { title: 'Rainy Study Desk', genre: 'lofi', bpm: 78, tags: ['chill', 'study', 'rain'], durationSec: 180 },
  { title: 'Morning Focus Loop', genre: 'lofi', bpm: 85, tags: ['chill', 'study', 'morning'], durationSec: 210 },
  { title: 'Neon City Run', genre: 'synthwave', bpm: 128, tags: ['energetic', 'workout', 'night'], durationSec: 200 },
  { title: 'Starlight Drift', genre: 'ambient', bpm: 60, tags: ['sleep', 'calm', 'dreamy'], durationSec: 300 },
  { title: 'Power Sprint', genre: 'edm', bpm: 140, tags: ['energetic', 'workout', 'gym'], durationSec: 190 },
  { title: 'Cafe Afternoon', genre: 'jazz', bpm: 95, tags: ['chill', 'cafe', 'relax'], durationSec: 220 },
  { title: 'Deep Focus Pulse', genre: 'lofi', bpm: 90, tags: ['study', 'focus', 'chill'], durationSec: 240 },
  { title: 'Victory Fanfare', genre: 'orchestral', bpm: 110, tags: ['epic', 'game', 'win'], durationSec: 20, type: SoundType.SFX },
  { title: 'UI Click Soft', genre: 'sfx', bpm: 0, tags: ['ui', 'click'], durationSec: 1, type: SoundType.SFX },
  { title: 'Midnight Lo-fi Rain', genre: 'lofi', bpm: 72, tags: ['sleep', 'rain', 'chill'], durationSec: 260 },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const soundsService = app.get(SoundsService);

  for (const sample of SAMPLE_SOUNDS) {
    const created = await soundsService.create({
      title: sample.title,
      genre: sample.genre,
      bpm: sample.bpm,
      tags: sample.tags,
      durationSec: sample.durationSec,
      type: sample.type ?? SoundType.BGM,
      fileUrl: `https://cdn.mupat.example.com/sounds/${encodeURIComponent(sample.title)}.mp3`,
    });
    // eslint-disable-next-line no-console
    console.log(`Seeded: ${created.title} (${created.id})`);
  }

  await app.close();
  // eslint-disable-next-line no-console
  console.log('Seed 완료 ✅');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed 실패:', err);
  process.exit(1);
});
