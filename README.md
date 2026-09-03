# sound-flow-backend

Mupat(뮤팟)의 백엔드/풀스택 지원을 위한 **대용량 AI BGM 검색 & AI 캐릭터 챗/메타데이터 처리 PoC**입니다.

## 기술 스택

- **Backend**: NestJS (TypeScript)
- **DB**: PostgreSQL + TypeORM
- **Caching**: Redis (ioredis, Look-Aside 패턴)
- **Infra**: Docker Compose (PostgreSQL, Redis, Redis Commander)
- **Streaming**: Server-Sent Events (SSE) 기반 AI 챗/추천 응답

## 폴더 구조

```
sound-flow-backend/
├─ docker-compose.yml          # PostgreSQL + Redis (+ Redis Commander)
├─ .env.example                # 환경변수 템플릿
├─ src/
│  ├─ main.ts                  # 부트스트랩 (ValidationPipe, CORS)
│  ├─ app.module.ts            # 루트 모듈 (Config/TypeORM/Redis/Schedule 조립)
│  ├─ config/
│  │  ├─ configuration.ts      # 환경변수 -> 타입 안전 Config 매핑
│  │  ├─ typeorm.config.ts     # NestJS 런타임용 TypeORM 옵션 팩토리
│  │  └─ typeorm.datasource.ts # TypeORM CLI(마이그레이션)용 DataSource
│  ├─ common/redis/
│  │  ├─ redis.module.ts       # ioredis 클라이언트 전역(Global) 프로바이더
│  │  └─ redis.service.ts      # Look-Aside 캐시 헬퍼 + 카운터 원자 연산
│  ├─ sounds/                  # [요구사항 1, 3] 음원 검색 + 재생/다운로드 카운트
│  │  ├─ entities/sound.entity.ts
│  │  ├─ dto/{search-sound,create-sound}.dto.ts
│  │  ├─ sounds.service.ts     # 검색(Look-Aside 캐싱) + 카운터 증가 로직
│  │  ├─ sounds.controller.ts  # GET/POST /sounds, /sounds/:id/{play,download}
│  │  ├─ counters/counter-flush.service.ts # Redis -> PostgreSQL 배치 반영
│  │  └─ sounds.module.ts
│  ├─ ai/                      # [요구사항 2] AI 캐릭터 챗 / 추천 스트리밍
│  │  ├─ providers/            # Mock / OpenAI 호환 스트리밍 provider
│  │  ├─ dto/{chat,recommend}.dto.ts
│  │  ├─ ai.service.ts
│  │  ├─ ai.controller.ts      # POST /ai/chat/stream, /ai/recommend/stream (SSE)
│  │  └─ ai.module.ts
│  ├─ health/                  # GET /health (Postgres/Redis 상태 점검)
│  └─ database/seed.ts         # 샘플 음원 데이터 시드 스크립트
```

## 1) 인프라 실행 (Docker Compose)

```bash
cp .env.example .env
docker compose up -d
```

- PostgreSQL: `localhost:5432` (db=`sound_flow`, user=`mupat`)
- Redis: `localhost:6379`
- Redis Commander(선택, 캐시 눈으로 확인): http://localhost:8081

## 2) 의존성 설치 & 앱 실행

```bash
npm install
npm run start:dev
```

앱은 기본적으로 `http://localhost:3000`에서 기동됩니다. (`synchronize: true`로 최초 기동 시 `sounds` 테이블이 자동 생성됩니다 — PoC 편의 목적이며 운영 환경에서는 마이그레이션 사용을 권장합니다.)

### Swagger(OpenAPI) 문서

기동 후 아래 주소에서 API 문서를 확인할 수 있습니다.

```
http://localhost:3000/api-docs
```

- `nest-cli.json`의 `@nestjs/swagger` 컴파일러 플러그인이 DTO/엔티티의 class-validator 데코레이터와 TS 타입을
  분석해 `@ApiProperty`를 자동 생성하므로, 대부분의 요청/응답 스키마는 별도 수정 없이 문서에 반영됩니다.
- `AI 캐릭터 챗 / 추천` API는 SSE(text/event-stream) 스트리밍이라 Swagger UI의 "Try it out"으로는 스트리밍
  응답을 온전히 확인하기 어렵습니다. 스키마 참고용으로만 사용하고, 실제 스트리밍 테스트는 `curl -N` 또는
  `fetch` + `ReadableStream`을 사용하세요.

샘플 데이터 시드:

```bash
npm run seed
```

## 3) 요구사항별 구현 매핑

### [PostgreSQL & Redis 캐싱] 장르/BPM/태그 검색 + Look-Aside 캐싱

```
GET /sounds?genre=lofi&bpmMin=70&bpmMax=95&tags=chill,study&page=1&limit=20
```

- `SoundsService.search()`가 요청 조건을 정규화해 캐시 키(`cache:sounds:search:{...}`)를 만들고,
  1. **Redis GET** → 있으면 즉시 반환 (`cached: true`, DB 접근 없음)
  2. **MISS** 시 TypeORM `QueryBuilder`로 PostgreSQL 조회 → 결과를 `SET ... EX <TTL>`로 캐싱 후 반환
- TTL은 `SEARCH_CACHE_TTL`(기본 60초) 환경변수로 조정.
- `POST /sounds`로 신규 음원 등록 시 `SCAN`으로 관련 검색 캐시를 무효화하여 stale 데이터를 방지합니다.

### [재생/다운로드 카운트 최적화] Redis Counter + Batch Update

```
POST /sounds/:id/play        # 202 Accepted, Redis INCR만 수행 (DB 즉시 UPDATE 없음)
POST /sounds/:id/download    # 202 Accepted
```

- `RedisService.incrementCounter()`가 `INCR counter:play:{id}` + `SADD dirty:sounds:play {id}`를 파이프라인으로 원자 처리.
- `CounterFlushService`가 `COUNTER_FLUSH_INTERVAL_MS`(기본 10초)마다 dirty-set을 순회하며
  `GETSET counter:play:{id} 0`으로 누적치를 읽고 `sounds.playCount`에 배치 반영(`repository.increment`).
- 트래픽이 아무리 많아도 재생/다운로드 요청 자체는 Redis In-Memory 연산 1~2회로 끝나므로 PostgreSQL 부하가 없습니다.

### [AI 연동 & 스트리밍 응답] AI 캐릭터 챗 / AI 음원 추천

```
POST /ai/chat/stream
Content-Type: application/json

{ "characterId": "muffin", "message": "오늘 좀 우울한데 위로가 되는 노래 있을까?" }
```

- SSE(`text/event-stream`)로 `start` → `token`(N회, 토큰 단위) → `done` 이벤트가 순차 전송됩니다.
- `AI_PROVIDER_API_KEY`가 설정되어 있으면 OpenAI 호환 `/chat/completions`(`stream: true`)를 그대로 프록시하고,
  없으면 `MockAiProvider`가 데모용 캐릭터 답변을 토큰 단위로 스트리밍합니다(네트워크/키 없이도 동작 확인 가능).

```
POST /ai/recommend/stream
Content-Type: application/json

{ "mood": "차분한", "activity": "공부", "genre": "lofi", "limit": 3 }
```

- `candidates`(후보 수) → `commentary`(AI 코멘터리 토큰 스트림) → `result`(최종 추천 JSON) 순으로 이벤트 전송.
- 후보군은 `SoundsService.search()`를 재사용하므로 **위의 Redis Look-Aside 캐시 혜택을 그대로 받습니다.**
- 랭킹 자체는 태그/장르/무드 매칭 기반의 결정론적 스코어링으로 계산하고, AI는 그 위에 자연어 코멘터리만 생성합니다
  (LLM 출력 파싱 실패로 추천 결과가 깨지는 것을 방지하기 위한 설계).

> SSE는 POST 바디가 필요하므로 브라우저 `EventSource` 대신 `fetch` + `ReadableStream`으로 소비합니다.
> curl로 확인하려면 `curl -N -X POST http://localhost:3000/ai/chat/stream -H "Content-Type: application/json" -d '{"characterId":"muffin","message":"안녕"}'`

### 헬스체크

```
GET /health   # { status, postgres: 'up'|'down', redis: 'up'|'down' }
```

## 환경 변수 (.env)

`.env.example` 참고. 주요 항목:

| 변수 | 설명 | 기본값 |
|---|---|---|
| `SEARCH_CACHE_TTL` | 검색 결과 Redis 캐시 TTL(초) | 60 |
| `COUNTER_FLUSH_INTERVAL_MS` | 재생/다운로드 카운터 배치 반영 주기(ms) | 10000 |
| `AI_PROVIDER_API_KEY` | 미설정 시 Mock AI Provider로 자동 폴백 | (없음) |
| `DB_SYNCHRONIZE` | TypeORM 스키마 자동 동기화 (PoC 편의용) | true |

## 알려진 한계 (PoC 수준 트레이드오프)

- 카운터 배치 플러시는 `GETSET` + `SREM` 사이에 미세한 race window가 있습니다. 카운터 키 자체는 삭제되지 않으므로
  데이터 유실 없이 다음 배치 사이클로 이월되는 정도이며, 완전한 원자성이 필요하면 Lua 스크립트(EVAL)로 묶는 것을 권장합니다.
- `DB_SYNCHRONIZE=true`는 데모 편의용이며, 운영 전환 시 `typeorm.datasource.ts` 기반 마이그레이션으로 전환해야 합니다.
- AI Provider는 OpenAI 호환 `/chat/completions` 스펙을 기준으로 구현되어 있어, Azure OpenAI/vLLM/Ollama 등 호환 엔드포인트로 `AI_PROVIDER_BASE_URL`만 바꿔 확장할 수 있습니다.
