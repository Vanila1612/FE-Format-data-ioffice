import { api } from './api';

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

export type StreamHandlers = {
  onToken: (delta: string) => void;
  onToolCall?: (event: { name: string; args: unknown }) => void;
  onToolResult?: (event: { name: string; result: unknown }) => void;
  onError?: (event: { code: string; message: string }) => void;
  onDone?: (info: { totalSteps: number; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }) => void;
};

export async function getAssistantStatus(): Promise<AssistantStatus> {
  const response = await api.get<{ success: true; data: AssistantStatus }>('/ai/status');
  return response.data.data;
}

export async function streamAssistantChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const token = localStorage.getItem('ioffice.token');
  const response = await fetch(`${api.defaults.baseURL || '/api'}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ messages }),
    signal
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
          | { type: 'token'; delta: string }
          | { type: 'tool_call'; name: string; args: unknown }
          | { type: 'tool_result'; name: string; result: unknown }
          | { type: 'error'; code: string; message: string }
          | { type: 'done'; totalSteps: number; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }
          | { type: 'start'; model: string };
        if (event.type === 'token') handlers.onToken(event.delta);
        else if (event.type === 'tool_call') handlers.onToolCall?.(event);
        else if (event.type === 'tool_result') handlers.onToolResult?.(event);
        else if (event.type === 'error') handlers.onError?.(event);
        else if (event.type === 'done') handlers.onDone?.({ totalSteps: event.totalSteps, usage: event.usage });
      } catch {
        // skip malformed event
      }
    }
  }
}
