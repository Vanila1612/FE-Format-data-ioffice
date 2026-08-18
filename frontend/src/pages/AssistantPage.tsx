import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bot, Send, Sparkles, StopCircle, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import {
  streamAssistantChat,
  getAssistantStatus,
  type AssistantMessage,
  type AssistantToolEvent
} from '../services/assistant';

const suggestions = [
  'Top 10 đơn vị xử lý xong văn bản nhiều nhất?',
  'Tỷ lệ ký văn bản theo từng nhóm?',
  'Đơn vị nào phát hành nhiều văn bản nhất trong tháng vừa rồi?',
  'Liệt kê 5 văn bản mới nhất của đơn vị ALCO'
];

function newId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatToolSummary(event: AssistantToolEvent): string {
  if (event.type === 'tool_call') return `Gọi ${event.name}`;
  if (event.type === 'tool_result') return `Kết quả ${event.name}`;
  return `Lỗi ${event.code}`;
}

export function AssistantPage() {
  const [status, setStatus] = useState<{ available: boolean; enabled: boolean } | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getAssistantStatus().then(setStatus).catch(() => setStatus({ available: false, enabled: false }));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const placeholder = useMemo(() => {
    if (!status) return 'Đang kiểm tra trạng thái trợ lý...';
    if (!status.available) return 'Trợ lý AI chưa được cấu hình (thiếu OPENAI_API_KEY).';
    return 'Hỏi bất kỳ điều gì về dữ liệu văn bản. Ví dụ: "Top 10 đơn vị xử lý xong văn bản"';
  }, [status]);

  function appendToolEvent(messageId: string, event: AssistantToolEvent) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, toolEvents: [...(m.toolEvents ?? []), event] } : m)));
  }

  async function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || streaming) return;
    if (!status?.available) {
      toast.error('Trợ lý AI chưa được cấu hình trên máy chủ.');
      return;
    }

    const userMessage: AssistantMessage = { id: newId(), role: 'user', content: trimmed };
    const assistantId = newId();
    const assistantMessage: AssistantMessage = { id: assistantId, role: 'assistant', content: '', pending: true };
    const history = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAssistantChat(
        history,
        {
          onToken: (delta) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)));
          },
          onToolCall: (event) => appendToolEvent(assistantId, { type: 'tool_call', name: event.name, args: event.args }),
          onToolResult: (event) => appendToolEvent(assistantId, { type: 'tool_result', name: event.name, result: event.result }),
          onError: (event) => appendToolEvent(assistantId, { type: 'error', code: event.code, message: event.message }),
          onDone: () => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)));
          }
        },
        controller.signal
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Yêu cầu thất bại';
      toast.error(message);
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content || `⚠️ ${message}`, pending: false } : m)));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    setMessages([]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return <section className="page-stack assistant-page">
    <div className="panel">
      <div className="panel-head">
        <div className="assistant-title">
          <Sparkles size={20} />
          <div>
            <h2>Trợ lý AI iOffice</h2>
            <p>{status?.available ? 'Hỏi bằng tiếng Việt về dữ liệu văn bản. Câu trả lời dựa trên dữ liệu thật trong database.' : 'Chưa có OPENAI_API_KEY — liên hệ admin để bật.'}</p>
          </div>
        </div>
        <div className="assistant-actions">
          <button className="secondary" type="button" onClick={clear} disabled={!messages.length}><Trash2 size={16} />Xóa hội thoại</button>
        </div>
      </div>

      <div className="chat-window" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <Bot size={42} />
            <strong>Bắt đầu hội thoại</strong>
            <p>Bạn có thể hỏi về top đơn vị, tỷ lệ ký văn bản, tra cứu văn bản cụ thể, hoặc phân tích theo khoảng thời gian.</p>
            <div className="suggestion-row">
              {suggestions.map((text) => (
                <button key={text} type="button" className="secondary" onClick={() => void send(text)} disabled={!status?.available || streaming}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`chat-bubble ${message.role}`}>
            <header>{message.role === 'user' ? 'Bạn' : 'Trợ lý'}</header>
            {message.toolEvents && message.toolEvents.length > 0 && (
              <ul className="tool-trace">
                {message.toolEvents.map((event, index) => (
                  <li key={index}>
                    <Wrench size={12} />
                    <span>{formatToolSummary(event)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="chat-content">
              {message.content || (message.pending ? <span className="typing">Đang suy ngh�...</span> : '')}
            </div>
          </article>
        ))}
      </div>

      <form className="chat-input" onSubmit={submit}>
        <textarea
          rows={2}
          placeholder={placeholder}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          disabled={!status?.available || streaming}
        />
        {streaming
          ? <button type="button" className="danger" onClick={stop}><StopCircle size={16} />Dừng</button>
          : <button type="submit" disabled={!status?.available || !input.trim()}><Send size={16} />Gửi</button>}
      </form>
    </div>
  </section>;
}
