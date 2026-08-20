import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/appError.js';

export type ToolEvent = {
  type: 'tool_call' | 'tool_result' | 'error';
  name?: string;
  args?: unknown;
  result?: unknown;
  code?: string;
  message?: string;
  at: string;
};

export type TurnUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  totalSteps?: number;
};

export type SavedTurn = {
  id: string;
  prompt: string;
  response: string;
  model: string;
  toolEvents: ToolEvent[] | null;
  usage: TurnUsage | null;
  createdAt: string;
};

export type SavedSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
};

export type SavedSessionDetail = SavedSessionSummary & {
  turns: SavedTurn[];
};

function summarize(prompt: string, max = 60): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized || 'Hội thoại mới';
  return `${normalized.slice(0, max - 1)}…`;
}

async function ensureSessionForUser(sessionId: string, userId: string) {
  const session = await prisma.assistantSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true }
  });
  if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên hội thoại');
  if (session.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập phiên này');
  return session;
}

export async function listSessions(userId: string, limit = 100): Promise<SavedSessionSummary[]> {
  const sessions = await prisma.assistantSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
    include: { _count: { select: { turns: true } } }
  });
  return sessions.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    turnCount: row._count.turns
  }));
}

export async function getSession(sessionId: string, userId: string): Promise<SavedSessionDetail> {
  await ensureSessionForUser(sessionId, userId);
  const session = await prisma.assistantSession.findUnique({
    where: { id: sessionId },
    include: {
      turns: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên hội thoại');
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    turnCount: session.turns.length,
    turns: session.turns.map((turn) => ({
      id: turn.id,
      prompt: turn.prompt,
      response: turn.response,
      model: turn.model,
      toolEvents: (turn.toolEvents as ToolEvent[] | null) ?? null,
      usage: (turn.usage as TurnUsage | null) ?? null,
      createdAt: turn.createdAt.toISOString()
    }))
  };
}

export async function deleteSession(sessionId: string, userId: string) {
  await ensureSessionForUser(sessionId, userId);
  await prisma.assistantSession.delete({ where: { id: sessionId } });
  return { deleted: true };
}

export async function renameSession(sessionId: string, userId: string, title: string) {
  await ensureSessionForUser(sessionId, userId);
  const trimmed = title.trim();
  if (!trimmed) throw new AppError(400, 'INVALID_TITLE', 'Tiêu đề không được rỗng');
  if (trimmed.length > 200) throw new AppError(400, 'INVALID_TITLE', 'Tiêu đề tối đa 200 ký tự');
  const session = await prisma.assistantSession.update({
    where: { id: sessionId },
    data: { title: trimmed }
  });
  return { id: session.id, title: session.title, updatedAt: session.updatedAt.toISOString() };
}

export async function recordTurn(input: {
  userId: string;
  sessionId: string | null;
  prompt: string;
  response: string;
  model: string;
  toolEvents: ToolEvent[];
  usage: TurnUsage | null;
}): Promise<{ sessionId: string; turnId: string }> {
  let sessionId = input.sessionId;
  if (!sessionId) {
    const created = await prisma.assistantSession.create({
      data: {
        userId: input.userId,
        title: summarize(input.prompt)
      }
    });
    sessionId = created.id;
  } else {
    await ensureSessionForUser(sessionId, input.userId);
    await prisma.assistantSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    });
  }

  const turn = await prisma.assistantTurn.create({
    data: {
      sessionId,
      userId: input.userId,
      prompt: input.prompt,
      response: input.response,
      model: input.model,
      toolEvents: input.toolEvents.length
        ? (input.toolEvents as unknown as Prisma.InputJsonValue)
        : (Prisma.JsonNull as unknown as Prisma.InputJsonValue),
      usage: input.usage ? (input.usage as unknown as Prisma.InputJsonValue) : (Prisma.JsonNull as unknown as Prisma.InputJsonValue)
    }
  });
  return { sessionId, turnId: turn.id };
}
