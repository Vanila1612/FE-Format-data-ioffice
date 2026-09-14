import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis as IORedis, type Redis } from 'ioredis';
import { env } from '../config/env.js';

export const IMPORT_QUEUE_NAME = 'imports';

export type ImportJobData = {
  importId: string;
  uploadedById: string;
};

export function buildConnection(): ConnectionOptions {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not set. Configure Redis in .env before running the import worker.');
  }
  return {
    // BullMQ chấp nhận URL trực tiếp
    url: env.REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export function buildRedisClient(): Redis {
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not set.');
  }
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __iofficeImportQueue: Queue<ImportJobData> | undefined;
}

export function getImportQueue(): Queue<ImportJobData> {
  if (!globalThis.__iofficeImportQueue) {
    globalThis.__iofficeImportQueue = new Queue<ImportJobData>(IMPORT_QUEUE_NAME, {
      connection: buildConnection(),
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
