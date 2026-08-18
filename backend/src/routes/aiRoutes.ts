import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { isAiEnabled } from '../config/env.js';
import { isAssistantAvailable, streamChat, type ChatMessage } from '../services/aiAssistantService.js';
import { AppError } from '../utils/appError.js';
import { ok } from '../utils/apiResponse.js';

export const aiRoutes = Router();

aiRoutes.use(requireAuth);

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(8000)
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40)
});

aiRoutes.get('/status', (_req, res) => {
  return ok(res, { available: isAssistantAvailable(), enabled: isAiEnabled() });
});

aiRoutes.post('/chat', async (req, res) => {
  if (!isAssistantAvailable()) {
    throw new AppError(503, 'AI_DISABLED', 'Chức năng AI chưa được bật. Vui lòng cấu hình OPENAI_API_KEY trong .env');
  }
  const body = chatRequestSchema.parse(req.body);
  const messages: ChatMessage[] = body.messages.map((m) => ({ role: m.role, content: m.content }));
  await streamChat(messages, res);
});
