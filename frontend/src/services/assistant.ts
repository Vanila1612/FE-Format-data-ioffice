import { api, unwrap } from './api';

export type AssistantStatus = { available: boolean; enabled: boolean };

export type AssistantMessageRole = 'user' | 'assistant';

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  content: string;
  pending?: boolean;
  toolEvents?: AssistantToolEvent[];
};

export type AssistantToolEvent =
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'error'; code: string; message: string };

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
  toolEvents: AssistantToolEvent[] | null;
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

export type StreamHandlers = {
  onToken: (delta: string) => void;
  onToolCall?: (event: { name: string; args: unknown }) => void;
  onToolResult?: (event: { name: string; result: unknown }) => void;
  onError?: (event: { code: string; message: string }) => void;
  onDone?: (info: { totalSteps: number; usage?: TurnUsage; sessionId: string | null; turnId: string | null }) => void;
  onSessionStart?: (info: { sessionId: string | null; model: string }) => void;
};

export async function getAssistantStatus(): Promise<AssistantStatus> {
  return unwrap<AssistantStatus>(await api.get('/ai/status'));
}

export async function listAssistantSessions(): Promise<SavedSessionSummary[]> {
  return unwrap<SavedSessionSummary[]>(await api.get('/ai/sessions'));
}

export async function getAssistantSession(id: string): Promise<SavedSessionDetail> {
  return unwrap<SavedSessionDetail>(await api.get(`/ai/sessions/${id}`));
}

export async function deleteAssistantSession(id: string): Promise<{ deleted: boolean }> {
  return unwrap<{ deleted: boolean }>(await api.delete(`/ai/sessions/${id}`));
}

export async function renameAssistantSession(id: string, title: string): Promise<{ id: string; title: string; updatedAt: string }> {
  return unwrap<{ id: string; title: string; updatedAt: string }>(await api.patch(`/ai/sessions/${id}`, { title }));
}

export async function streamAssistantChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  handlers: StreamHandlers,
  options?: { sessionId?: string | null; signal?: AbortSignal }
): Promise<void> {
  const token = localStorage.getItem('ioffice.token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options?.sessionId) headers['X-Assistant-Session'] = options.sessionId;

  const response = await fetch(`${api.defaults.baseURL || '/api'}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, sessionId: options?.sessionId ?? undefined }),
    signal: options?.signal
  });

  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status})`;
    try {
      const body = await response.json();
      if (body && !body.success && body.error?.message) message = body.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Trình duyệt không hỗ trợ streaming response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');

      const lines = rawEvent.split('\n');
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('data:')) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;

      try {
        const event = JSON.parse(dataLine) as
          | { type: 'start'; model: string; sessionId: string | null }
          | { type: 'token'; delta: string }
          | { type: 'tool_call'; name: string; args: unknown }
          | { type: 'tool_result'; name: string; result: unknown }
          | { type: 'error'; code: string; message: string }
          | { type: 'done'; totalSteps: number; usage?: TurnUsage; sessionId: string | null; turnId: string | null };
        if (event.type === 'start') handlers.onSessionStart?.({ sessionId: event.sessionId, model: event.model });
        else if (event.type === 'token') handlers.onToken(event.delta);
        else if (event.type === 'tool_call') handlers.onToolCall?.(event);
        else if (event.type === 'tool_result') handlers.onToolResult?.(event);
        else if (event.type === 'error') handlers.onError?.(event);
        else if (event.type === 'done') handlers.onDone?.({ totalSteps: event.totalSteps, usage: event.usage, sessionId: event.sessionId, turnId: event.turnId });
      } catch {
        // skip malformed event
      }
    }
  }
}
