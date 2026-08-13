import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/authRoutes.js';
import { documentRoutes } from './routes/documentRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { importRoutes } from './routes/importRoutes.js';
import { reportRoutes } from './routes/reportRoutes.js';
import { ruleRoutes } from './routes/ruleRoutes.js';
import { snapshotRoutes } from './routes/snapshotRoutes.js';
import { unitMappingRoutes } from './routes/unitMappingRoutes.js';
import { fail } from './utils/apiResponse.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 20 }), authRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/imports', importRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/rules', ruleRoutes);
  app.use('/api/unit-mappings', unitMappingRoutes);
  app.use('/api/snapshots', snapshotRoutes);
  app.use('/api/reports', reportRoutes);
  app.use((_req, res) => fail(res, 404, 'NOT_FOUND', 'Route not found'));
  app.use(errorHandler);
  return app;
}
