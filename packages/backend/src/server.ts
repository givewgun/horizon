import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { loadConfig } from './config.js';
import { registerStubRoutes } from './routes/stubs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  const cfg = loadConfig();

  const app = Fastify({
    logger: { level: cfg.NODE_ENV === 'production' ? 'info' : 'debug' },
    disableRequestLogging: cfg.NODE_ENV === 'production',
  });

  // ---- API stubs (Phase 0). Phase 1+ replaces these one by one. ----
  await app.register(async (scope) => {
    registerStubRoutes(scope);
  });

  // ---- Frontend static (built SPA copied into image at /app/public). ----
  // Resolve both inside the container (../public relative to dist/) and dev (../../frontend/dist).
  const candidates = [
    resolve(__dirname, '../public'),
    resolve(__dirname, '../../frontend/dist'),
  ];
  const frontendRoot = candidates.find((p) => existsSync(p));
  if (frontendRoot) {
    await app.register(fastifyStatic, {
      root: frontendRoot,
      prefix: '/',
      wildcard: false,
    });
    // SPA fallback: any GET that isn't /api/* and didn't match a file -> index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ ok: false, error: 'not found' });
    });
  } else {
    app.log.warn({ candidates }, 'frontend build not found; serving API only');
  }

  // ---- Telegram bot (Phase 3) — feature-flagged on creds. ----
  if (cfg.features.telegramBot) {
    app.log.info('telegram bot creds present; bot wiring deferred to Phase 3');
  } else {
    app.log.info('telegram bot disabled (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing)');
  }

  try {
    await app.listen({ host: '0.0.0.0', port: cfg.PORT });
    app.log.info(
      { port: cfg.PORT, ll2: cfg.LL2_BASE, features: cfg.features },
      'horizon up',
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
