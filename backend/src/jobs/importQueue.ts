import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis as IORedis, type Redis } from 'ioredis';
import { env } from '../config/env.js';

export const IMPORT_QUEUE_NAME = 'imports';

export type ImportJobData = {
  importId: string;
  uploadedById: string;
};

export function hasRedis(): boolean {
  return Boolean(env.REDIS_URL && env.REDIS_URL.trim().length > 0);
}

export function buildConnectionOptions(): ConnectionOptions {
  if (!hasRedis()) {
    throw new Error('REDIS_URL is not set. Configure Redis in .env before running the import worker.');
  }
  return {
    url: env.REDIS_URL!,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export function buildRedisClient(): Redis {
  if (!hasRedis()) {
    throw new Error('REDIS_URL is not set.');
  }
  return new IORedis(env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __iofficeImportQueue: Queue<ImportJobData> | undefined;
}

export function getImportQueue(): Queue<ImportJobData> {
  if (!hasRedis()) {
    throw new Error('REDIS_URL is not set. Set REDIS_URL in env to use background imports.');
  }
  if (!globalThis.__iofficeImportQueue) {
    globalThis.__iofficeImportQueue = new Queue<ImportJobData>(IMPORT_QUEUE_NAME, {
      connection: buildConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 60 * 60, count: 100 },
        removeOnFail: { age: 24 * 60 * 60 }
      }
    });
  }
  return globalThis.__iofficeImportQueue;
}
