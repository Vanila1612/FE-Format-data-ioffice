import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { isAiEnabled } from '../config/env.js';
import { isAssistantAvailable, streamChat, type ChatMessage } from '../services/aiAssistantService.js';
import {
  deleteSession,
  getSession,
  listSessions,
  renameSession
} from '../services/aiHistoryService.js';
import { AppError } from '../utils/appError.js';
import { ok } from '../utils/apiResponse.js';

export const aiRoutes = Router();

aiRoutes.use(requireAuth);

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(8000)
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  sessionId: z.string().optional()
});

const renameSchema = z.object({
  title: z.string().min(1).max(200)
});

aiRoutes.get('/status', (_req, res) => {
  return ok(res, { available: isAssistantAvailable(), enabled: isAiEnabled() });
});

aiRoutes.post('/chat', async (req, res) => {
  if (!isAssistantAvailable()) {
    throw new AppError(503, 'AI_DISABLED', 'Chức năng AI chưa được bật. Vui lòng cấu hình OPENAI_API_KEY trong .env');
  }
  const body = chatRequestSchema.parse(req.body);
  const headerSession = typeof req.headers['x-assistant-session'] === 'string' ? req.headers['x-assistant-session'] : null;
  const sessionId = body.sessionId ?? headerSession ?? null;
  const messages: ChatMessage[] = body.messages.map((m) => ({ role: m.role, content: m.content }));
  await streamChat(messages, req.user!.id, sessionId, res);
});

aiRoutes.get('/sessions', async (req, res) => {
  return ok(res, await listSessions(req.user!.id));
});

aiRoutes.get('/sessions/:id', async (req, res) => {
  return ok(res, await getSession(req.params.id, req.user!.id));
});

aiRoutes.patch('/sessions/:id', async (req, res) => {
  const body = renameSchema.parse(req.body);
  return ok(res, await renameSession(req.params.id, req.user!.id, body.title));
});

aiRoutes.delete('/sessions/:id', async (req, res) => {
  return ok(res, await deleteSession(req.params.id, req.user!.id));
});
