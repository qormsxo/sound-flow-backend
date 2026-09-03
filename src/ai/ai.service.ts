import { Inject, Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Sound } from '../sounds/entities/sound.entity';
import { SoundsService } from '../sounds/sounds.service';
import { ChatDto } from './dto/chat.dto';
import { RecommendDto } from './dto/recommend.dto';
import { AI_PROVIDER, AiChatMessage, AiProvider } from './providers/ai-provider.interface';

/** 뮤팟(Mupat) AI 캐릭터 페르소나 정의 (PoC용 샘플 2종) */
const CHARACTER_PERSONAS: Record<string, string> = {
  muffin:
    '너는 "머핀"이라는 이름의 발랄하고 다정한 뮤팟(Mupat) AI 캐릭터야. ' +
    '사용자와 음악, 하루 일과에 대해 친근한 반말 톤으로 대화하며, 필요하면 BGM을 추천해줘.',
  'dj-nova':
    '너는 "DJ 노바"라는 이름의 쿨하고 전문적인 뮤팟(Mupat) AI 캐릭터야. ' +
    '음악 큐레이션과 BGM/장르/BPM 추천에 특화되어 있고, 간결하고 세련된 톤으로 답해.',
};
const DEFAULT_PERSONA =
  '너는 뮤팟(Mupat)의 친절한 AI 어시스턴트야. 사용자의 음악 취향에 맞춰 대화하고 추천해줘.';

interface RankedSound {
  sound: Sound;
  score: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly soundsService: SoundsService,
  ) {
    this.logger.log(`AI Provider: ${this.provider.name}`);
  }

  /**
   * AI 캐릭터 챗 스트리밍 응답.
   * SSE 이벤트 타입: start -> token(N회) -> done | error
   */
  chatStream(dto: ChatDto): Observable<MessageEvent> {
    const messages = this.buildChatMessages(dto);

    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      (async () => {
        try {
          subscriber.next({
            type: 'start',
            data: JSON.stringify({ characterId: dto.characterId }),
          });

          let fullText = '';
          for await (const token of this.provider.streamCompletion(messages)) {
            if (closed) return;
            fullText += token;
            subscriber.next({ type: 'token', data: token });
          }

          subscriber.next({
            type: 'done',
            data: JSON.stringify({ characterId: dto.characterId, fullText }),
          });
          subscriber.complete();
        } catch (err) {
          this.logger.error(`chatStream 실패: ${(err as Error).message}`);
          subscriber.next({
            type: 'error',
            data: JSON.stringify({ message: (err as Error).message }),
          });
          subscriber.complete();
        }
      })();

      return () => {
        closed = true;
      };
    });
  }

  /**
   * AI 음원 추천 스트리밍 응답.
   * 1) SoundsService.search()로 후보군 조회 (Redis Look-Aside 캐시 재사용)
   * 2) 태그/장르/무드 매칭 기반으로 결정론적 랭킹 산출
   * 3) AI Provider는 추천 사유에 대한 코멘터리를 스트리밍 생성 (LLM의 창의적 설명 담당)
   * 4) 최종적으로 랭킹 결과(JSON)를 'result' 이벤트로 전송
   *
   * SSE 이벤트 타입: candidates -> commentary(N회) -> result | error
   */
  recommendStream(dto: RecommendDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      (async () => {
        try {
          const candidates = await this.loadCandidates(dto);
          subscriber.next({
            type: 'candidates',
            data: JSON.stringify({ count: candidates.length }),
          });

          const ranked = this.rankCandidates(candidates, dto).slice(0, dto.limit ?? 5);
          const messages = this.buildRecommendMessages(dto, ranked);

          let commentary = '';
          for await (const token of this.provider.streamCompletion(messages)) {
            if (closed) return;
            commentary += token;
            subscriber.next({ type: 'commentary', data: token });
          }

          subscriber.next({
            type: 'result',
            data: JSON.stringify({
              recommendations: ranked.map(({ sound, score }) => ({
                id: sound.id,
                title: sound.title,
                genre: sound.genre,
                bpm: sound.bpm,
                tags: sound.tags,
                score: Number(score.toFixed(2)),
              })),
              commentary,
            }),
          });
          subscriber.complete();
        } catch (err) {
          this.logger.error(`recommendStream 실패: ${(err as Error).message}`);
          subscriber.next({
            type: 'error',
            data: JSON.stringify({ message: (err as Error).message }),
          });
          subscriber.complete();
        }
      })();

      return () => {
        closed = true;
      };
    });
  }

  private buildChatMessages(dto: ChatDto): AiChatMessage[] {
    const persona = CHARACTER_PERSONAS[dto.characterId] ?? DEFAULT_PERSONA;
    const history: AiChatMessage[] = (dto.history ?? []).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    return [
      { role: 'system', content: persona },
      ...history,
      { role: 'user', content: dto.message },
    ];
  }

  private buildRecommendMessages(
    dto: RecommendDto,
    ranked: RankedSound[],
  ): AiChatMessage[] {
    const candidateList = ranked
      .map(
        (r, idx) =>
          `${idx + 1}. "${r.sound.title}" (장르: ${r.sound.genre}, BPM: ${r.sound.bpm}, 태그: ${r.sound.tags.join(', ')})`,
      )
      .join('\n');

    const conditionText = [
      dto.mood && `무드: ${dto.mood}`,
      dto.activity && `상황/활동: ${dto.activity}`,
      dto.genre && `선호 장르: ${dto.genre}`,
    ]
      .filter(Boolean)
      .join(', ');

    return [
      {
        role: 'system',
        content:
          '너는 뮤팟(Mupat)의 BGM 추천 큐레이터야. 주어진 후보 음원 목록 중에서 사용자 상황에 맞는 곡들을 ' +
          '친근한 톤으로 짧게 설명해줘. 이미 순위는 정해져 있으니, 왜 이 곡들이 잘 어울리는지 코멘터리만 생성하면 돼.',
      },
      {
        role: 'user',
        content:
          `사용자 조건: ${conditionText || '특별한 조건 없음'}\n\n` +
          `후보 음원 목록:\n${candidateList || '(후보 없음)'}\n\n` +
          '위 목록에 대한 추천 코멘트를 2~3문장으로 작성해줘.',
      },
    ];
  }

  private async loadCandidates(dto: RecommendDto): Promise<Sound[]> {
    // 검색 API와 동일한 SoundsService.search()를 재사용 -> Redis Look-Aside 캐시 혜택을 그대로 받는다.
    const { items } = await this.soundsService.search({
      genre: dto.genre,
      page: 1,
      limit: 50,
    });
    return items;
  }

  private rankCandidates(sounds: Sound[], dto: RecommendDto): RankedSound[] {
    const mood = dto.mood?.toLowerCase().trim();
    const activity = dto.activity?.toLowerCase().trim();

    return sounds
      .map((sound) => {
        let score = 0;
        const tagsLower = sound.tags.map((t) => t.toLowerCase());

        if (dto.genre && sound.genre.toLowerCase() === dto.genre.toLowerCase()) {
          score += 3;
        }
        if (mood && tagsLower.some((t) => t.includes(mood) || mood.includes(t))) {
          score += 2;
        }
        if (activity && tagsLower.some((t) => t.includes(activity) || activity.includes(t))) {
          score += 2;
        }
        // 완전 동률 방지를 위한 미세한 tie-breaker
        score += Math.random() * 0.1;

        return { sound, score };
      })
      .sort((a, b) => b.score - a.score);
  }
}
