import path from 'node:path';
import dotenv from 'dotenv';

// Load env from project root regardless of cwd so REDIS_URL/JWT_SECRET/etc.
// are available in production containers where CWD != repo root.
for (const candidate of ['.env.prod', '.env']) {
  const filePath = path.resolve(process.cwd(), '..', candidate);
  dotenv.config({ path: filePath });
}

const { env } = await import('./config/env.js');
const { createApp } = await import('./app.js');

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`iOffice API listening on http://localhost:${env.PORT}`);
});

server.requestTimeout = 0;
server.headersTimeout = 0;

async function bootstrap() {
  if (!env.REDIS_URL) {
    console.warn('[api] REDIS_URL not set — import will run inline (may timeout on large files).');
    return;
  }
  try {
    const { startImportWorker, stopImportWorker } = await import('./jobs/importProcessor.js');
    if (!env.WORKER_ONLY) {
      startImportWorker();
    }
    const shutdown = async (signal: string) => {
      console.log(`[api] received ${signal}, draining worker…`);
      await stopImportWorker();
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    console.error('[api] failed to start import worker:', error);
  }
}

bootstrap();
