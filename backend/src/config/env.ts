import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(12).default('change-me-in-development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('../storage/uploads'),
  EXPORT_DIR: z.string().default('../storage/exports'),
  SNAPSHOT_DIR: z.string().default('../storage/snapshots'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('admin123456'),
  ADMIN_DISPLAY_NAME: z.string().default('System Admin')
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
