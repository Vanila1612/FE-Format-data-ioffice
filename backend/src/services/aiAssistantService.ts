import type { Response } from 'express';
import OpenAI from 'openai';
import { env, isAiEnabled } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { chatTools, executeTool } from './aiTools.js';
import { recordTurn, type ToolEvent, type TurnUsage } from './aiHistoryService.js';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessage = {
  role: ChatRole;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

export type StreamEvent =
  | { type: 'start'; model: string; sessionId: string | null }
  | { type: 'token'; delta: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'done'; totalSteps: number; usage?: TurnUsage; sessionId: string | null; turnId: string | null }
  | { type: 'error'; code: string; message: string };

const SYSTEM_PROMPT = `Bạn là trợ lý phân tích dữ liệu của hệ thống iOffice — công cụ rà soát văn bản đi nội bộ.
Bạn CHỈ trả lời dựa trên kết quả từ các tool được cung cấp; tuyệt đối không bịa số liệu.
Khi cần dữ liệu, hãy gọi tool. Có thể gọi nhiều tool liên tiếp để trả lời câu hỏi phức tạp.

Quy ước dữ liệu:
- "Văn bản đã ký/xử lý xong" nghĩa là có giá trị trong trường 'Văn bản ký số' (signedDocument).
- 3 nhóm văn bản: REPORT_PROPOSAL = "Báo cáo / Tờ trình", LETTER_AUTHORIZATION = "Công văn / Ủy quyền", WORK_LETTER = "Thư công tác".
- "Đơn vị" ưu tiên dùng normalizedUnit (đã chuẩn hoá). issuingUnit là tên gốc.

Khi trả lời:
- Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc rõ ràng.
- Trích dẫn số liệu cụ thể (đơn vị, con số, tỷ lệ phần trăm) kèm thứ hạng nếu có.
- Nếu dữ liệu rỗng, nói rõ "Hệ thống chưa có dữ liệu" thay vì suy đoán.
- Không cần lặp lại toàn bộ JSON của tool; hãy tóm tắt và chọn thông tin đáng chú ý.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!isAiEnabled()) {
    throw new AppError(503, 'AI_DISABLED', 'Chức năng AI chưa được bật. Vui lòng cấu hình OPENAI_API_KEY trong .env');
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });
  }
  return client;
}

function sendEvent(res: Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function isAssistantAvailable(): boolean {
  return isAiEnabled();
}

export async function streamChat(messages: ChatMessage[], userId: string, sessionId: string | null, res: Response): Promise<void> {
  const openai = getClient();
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`retry: 5000\n\n`);

  const capturedToolEvents: ToolEvent[] = [];
  let finalAssistantContent = '';
  let lastUserPrompt = '';
  for (const message of messages) {
    if (message.role === 'user' && typeof message.content === 'string') lastUserPrompt = message.content;
  }
  let currentSessionId: string | null = sessionId;
  let savedTurnId: string | null = null;

  let model = env.OPENAI_MODEL;
  sendEvent(res, { type: 'start', model, sessionId: currentSessionId });

  const history: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
  let totalSteps = 0;
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    while (totalSteps < env.AI_MAX_STEPS) {
      totalSteps += 1;
      const stream = await openai.chat.completions.create({
        model,
        stream: true,
        messages: history as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: chatTools as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
        tool_choice: 'auto'
      });

      let stepContent = '';
      const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
      const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          stepContent += delta.content;
          sendEvent(res, { type: 'token', delta: delta.content });
        }

        if (delta?.tool_calls) {
          for (const call of delta.tool_calls) {
            const index = call.index ?? 0;
            if (!toolCallBuffers.has(index)) {
              toolCallBuffers.set(index, { id: call.id ?? `call_${index}_${Date.now()}`, name: '', args: '' });
            }
            const buffer = toolCallBuffers.get(index)!;
            if (call.id) buffer.id = call.id;
            if (call.function?.name) buffer.name += call.function.name;
            if (call.function?.arguments) buffer.args += call.function.arguments;
          }
        }

        if (chunk.usage) {
          totalUsage.promptTokens += chunk.usage.prompt_tokens ?? 0;
          totalUsage.completionTokens += chunk.usage.completion_tokens ?? 0;
          totalUsage.totalTokens += chunk.usage.total_tokens ?? 0;
        }
      }

      for (const [, buffer] of toolCallBuffers) {
        toolCalls.push({ id: buffer.id, type: 'function', function: { name: buffer.name, arguments: buffer.args } });
      }

      if (stepContent) finalAssistantContent += stepContent;
      if (toolCalls.length === 0) {
        if (stepContent) {
          history.push({ role: 'assistant', content: stepContent });
        }
        break;
      }

      history.push({ role: 'assistant', content: stepContent || null, tool_calls: toolCalls });

      for (const call of toolCalls) {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid tool arguments';
          sendEvent(res, { type: 'error', code: 'INVALID_TOOL_ARGS', message: `${call.function.name}: ${message}` });
          history.push({ role: 'tool', name: call.function.name, tool_call_id: call.id, content: JSON.stringify({ error: message }) });
          continue;
        }

        sendEvent(res, { type: 'tool_call', name: call.function.name, args: parsedArgs });
        capturedToolEvents.push({ type: 'tool_call', name: call.function.name, args: parsedArgs, at: new Date().toISOString() });

        try {
          const result = await executeTool(call.function.name, parsedArgs);
          sendEvent(res, { type: 'tool_result', name: call.function.name, result });
          capturedToolEvents.push({ type: 'tool_result', name: call.function.name, result, at: new Date().toISOString() });
          history.push({
            role: 'tool',
            name: call.function.name,
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });
        } catch (error) {
          const code = error instanceof AppError ? error.code : 'TOOL_EXECUTION_ERROR';
          const message = error instanceof AppError ? error.message : (error instanceof Error ? error.message : 'Tool execution failed');
          sendEvent(res, { type: 'error', code, message });
          capturedToolEvents.push({ type: 'error', name: call.function.name, code, message, at: new Date().toISOString() });
          history.push({
            role: 'tool',
            name: call.function.name,
            tool_call_id: call.id,
            content: JSON.stringify({ error: code, message })
          });
        }
      }
    }

    if (lastUserPrompt && finalAssistantContent && !savedTurnId) {
      try {
        const saved = await recordTurn({
          userId,
          sessionId: currentSessionId,
          prompt: lastUserPrompt,
          response: finalAssistantContent,
          model,
          toolEvents: capturedToolEvents,
          usage: { ...totalUsage, totalSteps }
        });
        currentSessionId = saved.sessionId;
        savedTurnId = saved.turnId;
      } catch (persistError) {
        console.error('Failed to persist assistant turn:', persistError);
      }
    }
    if (currentSessionId && savedTurnId) {
      sendEvent(res, { type: 'done', totalSteps, usage: { ...totalUsage, totalSteps }, sessionId: currentSessionId, turnId: savedTurnId });
    } else {
      sendEvent(res, { type: 'done', totalSteps, usage: { ...totalUsage, totalSteps }, sessionId: currentSessionId, turnId: null });
    }
    res.end();
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'AI_REQUEST_FAILED';
    const message = error instanceof AppError
      ? error.message
      : (error instanceof Error ? error.message : 'AI request failed');
    if (lastUserPrompt && finalAssistantContent && !savedTurnId) {
      try {
        const saved = await recordTurn({
          userId,
          sessionId: currentSessionId,
          prompt: lastUserPrompt,
          response: finalAssistantContent,
          model,
          toolEvents: capturedToolEvents,
          usage: { ...totalUsage, totalSteps }
        });
        currentSessionId = saved.sessionId;
        savedTurnId = saved.turnId;
      } catch (persistError) {
        console.error('Failed to persist assistant turn:', persistError);
      }
    }
    sendEvent(res, { type: 'error', code, message });
    if (currentSessionId && savedTurnId) {
      sendEvent(res, { type: 'done', totalSteps, usage: { ...totalUsage, totalSteps }, sessionId: currentSessionId, turnId: savedTurnId });
    } else {
      sendEvent(res, { type: 'done', totalSteps, usage: { ...totalUsage, totalSteps }, sessionId: currentSessionId, turnId: null });
    }
    res.end();
  }
}
