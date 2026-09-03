export interface AppConfig {
  port: number;
  nodeEnv: string;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  cache: {
    searchTtlSeconds: number;
  };
  counter: {
    flushIntervalMs: number;
  };
  ai: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'mupat',
    password: process.env.DB_PASSWORD ?? 'mupat_password',
    database: process.env.DB_DATABASE ?? 'sound_flow',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  cache: {
    searchTtlSeconds: parseInt(process.env.SEARCH_CACHE_TTL ?? '60', 10),
  },
  counter: {
    flushIntervalMs: parseInt(
      process.env.COUNTER_FLUSH_INTERVAL_MS ?? '10000',
      10,
    ),
  },
  ai: {
    baseUrl: process.env.AI_PROVIDER_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.AI_PROVIDER_API_KEY ?? '',
    model: process.env.AI_PROVIDER_MODEL ?? 'gpt-4o-mini',
  },
});
