import path from 'node:path';
import dotenv from 'dotenv';

// Match docker-compose cwd (/app/backend). Repo root is one level up.
for (const candidate of ['.env.prod', '.env']) {
  dotenv.config({ path: path.resolve(process.cwd(), '..', candidate) });
}

const { startImportWorker, stopImportWorker } = await import('../src/jobs/importProcessor.js');

async function main() {
  console.log('[worker] starting…');
  startImportWorker();

  const shutdown = async (signal: string) => {
    console.log(`[worker] received ${signal}, draining…`);
    await stopImportWorker();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[worker] fatal:', error);
  process.exit(1);
});
