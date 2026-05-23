import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  LL2_BASE: z.string().url().default('https://lldev.thespacedevs.com/2.3.0'),

  OPENWEATHER_KEY: z.string().optional().default(''),
  WINDY_KEY: z.string().optional().default(''),
  N2YO_KEY: z.string().optional().default(''),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_CHAT_ID: z.string().optional().default(''),

  NOMINATIM_USER_AGENT: z
    .string()
    .min(8)
    .default('horizon/0.1 (contact: aongoong.jp@gmail.com)'),

  DB_PATH: z.string().default('./data/horizon.sqlite'),
});

export type AppConfig = z.infer<typeof EnvSchema> & {
  features: {
    openWeather: boolean;
    windy: boolean;
    telegramBot: boolean;
  };
};

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  const v = parsed.data;
  cached = {
    ...v,
    features: {
      openWeather: v.OPENWEATHER_KEY.length > 0,
      windy: v.WINDY_KEY.length > 0,
      telegramBot: v.TELEGRAM_BOT_TOKEN.length > 0 && v.TELEGRAM_CHAT_ID.length > 0,
    },
  };
  return cached;
}

/** Test helper. Do not call outside tests. */
export function _resetConfigForTests(): void {
  cached = null;
}
