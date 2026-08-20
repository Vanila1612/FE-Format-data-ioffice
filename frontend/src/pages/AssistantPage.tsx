import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bot, MessageSquarePlus, Pencil, Send, Sparkles, StopCircle, Trash2, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteAssistantSession,
  getAssistantSession,
  getAssistantStatus,
  listAssistantSessions,
  renameAssistantSession,
  streamAssistantChat,
  type AssistantMessage,
  type AssistantToolEvent,
  type SavedSessionSummary,
  type SavedTurn
} from '../services/assistant';

const suggestions = [
  'Top 10 đơn vị phát hành nhiều văn bản nhất (tính trên tổng số)?',
  'Top 10 đơn vị có tỷ lệ ký văn bản cao nhất?',
  'Tỷ lệ ký văn bản theo 3 nhóm (Báo cáo/Tờ trình, Công văn/Ủy quyền, Thư công tác)?',
  'Tóm tắt tổng quan: tổng văn bản, đã ký, chưa ký, tỷ lệ ký?',
  'Xu hướng ký văn bản theo tháng trong 6 tháng gần nhất?',
  'Đơn vị nào phát hành nhiều văn bản nhất trong tháng vừa rồi?',
  'Liệt kê 5 văn bản mới nhất của đơn vị ALCO',
  'Tìm văn bản có trích yếu chứa "báo cáo kết quả" trong 30 ngày gần nhất',
  'Liệt kê 10 văn bản gần đây nhất của đơn vị Hội sở',
  'Top 10 đơn vị xử lý xong nhiều nhất trong quý này (tính theo tổng số)?',
  'Tỷ lệ ký văn bản cao nhất tuần này của các đơn vị?',
  'Văn bản nào của đơn vị Chi nhánh Cần Thơ phát hành trong tháng 8?'
];

function newId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatToolSummary(event: AssistantToolEvent): string {
  if (event.type === 'tool_call') return `Gọi ${event.name}`;
  if (event.type === 'tool_result') return `Kết quả ${event.name}`;
  return `Lỗi ${event.code}`;
}

function turnsToMessages(turns: SavedTurn[]): AssistantMessage[] {
  const out: AssistantMessage[] = [];
  for (const turn of turns) {
    out.push({ id: `t_${turn.id}_u`, role: 'user', content: turn.prompt });
    out.push({
      id: `t_${turn.id}_a`,
      role: 'assistant',
      content: turn.response,
      toolEvents: turn.toolEvents ?? []
    });
  }
  return out;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'vừa xong';
  if (diff < hour) return `${Math.floor(diff / minute)} phút trước`;
  if (diff < day) return `${Math.floor(diff / hour)} giờ trước`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

export function AssistantPage() {
  const [status, setStatus] = useState<{ available: boolean; enabled: boolean } | null>(null);
  const [sessions, setSessions] = useState<SavedSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function refreshSessions() {
    try {
      const list = await listAssistantSessions();
      setSessions(list);
    } catch {
      // ignore — sidebar just won't show sessions
    }
  }

  useEffect(() => {
    listAssistantSessions()
      .then((list) => setSessions(list))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!status) {
      getAssistantStatus().then(setStatus).catch(() => setStatus({ available: false, enabled: false }));
    }
  }, [status]);

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

  async function openSession(id: string) {
    setActiveSessionId(id);
    setLoadingSessionId(id);
    try {
      const detail = await getAssistantSession(id);
      setMessages(turnsToMessages(detail.turns));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được phiên');
      setActiveSessionId(null);
      setMessages([]);
    } finally {
      setLoadingSessionId(null);
    }
  }

  function startNewSession() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
  }

  async function removeSession(id: string, event?: React.MouseEvent) {
    event?.stopPropagation();
    if (!confirm('Xoá phiên hội thoại này?')) return;
    try {
      await deleteAssistantSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) startNewSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không xoá được phiên');
    }
  }

  async function commitRename(id: string) {
    const title = renameValue.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    try {
      const updated = await renameAssistantSession(id, title);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: updated.title } : s)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đổi được tiêu đề');
    } finally {
      setRenamingId(null);
      setRenameValue('');
    }
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

    // Optimistic: hiện session ngay trong sidebar khi bắt đầu gửi câu hỏi,
    // sẽ được thay bằng id thật khi backend trả về qua event 'start' hoặc 'done'.
    let stubId: string | null = null;
    if (!activeSessionId) {
      stubId = `stub_${newId()}`;
      const nowIso = new Date().toISOString();
      const stub: SavedSessionSummary = {
        id: stubId,
        title: trimmed,
        createdAt: nowIso,
        updatedAt: nowIso,
        turnCount: 1
      };
      setActiveSessionId(stubId);
      setSessions((prev) => [stub, ...prev]);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAssistantChat(
        history,
        {
          onSessionStart: ({ sessionId }) => {
            if (sessionId && stubId) {
              const realId = sessionId;
              setActiveSessionId(realId);
              setSessions((prev) => prev.map((s) => (s.id === stubId ? { ...s, id: realId } : s)));
              stubId = realId;
            } else if (sessionId && !activeSessionId) {
              setActiveSessionId(sessionId);
            }
          },
          onToken: (delta) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)));
          },
          onToolCall: (event) => appendToolEvent(assistantId, { type: 'tool_call', name: event.name, args: event.args }),
          onToolResult: (event) => appendToolEvent(assistantId, { type: 'tool_result', name: event.name, result: event.result }),
          onError: (event) => appendToolEvent(assistantId, { type: 'error', code: event.code, message: event.message }),
          onDone: (info) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)));
            if (info.sessionId) {
              setActiveSessionId(info.sessionId);
              if (stubId && stubId !== info.sessionId) {
                setSessions((prev) => prev.map((s) => (s.id === stubId ? { ...s, id: info.sessionId! } : s)));
              }
              void refreshSessions();
            }
          }
        },
        { sessionId: activeSessionId, signal: controller.signal }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Yêu cầu thất bại';
      toast.error(message);
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content || `⚠️ ${message}`, pending: false } : m)));
      if (stubId) {
        setSessions((prev) => prev.filter((s) => s.id !== stubId));
        if (activeSessionId === stubId) setActiveSessionId(null);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    setActiveSessionId(null);
    setMessages([]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return <section className="assistant-page">
    <aside className="assistant-sidebar">
      <div className="assistant-sidebar-head">
        <strong>Lịch sử</strong>
        <button type="button" className="secondary" onClick={startNewSession}><MessageSquarePlus size={14} />Mới</button>
      </div>
      {sessions.length === 0 && <div className="assistant-sidebar-empty">Chưa có phiên nào.</div>}
      <ul className="assistant-session-list">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={session.id === activeSessionId ? 'active' : ''}
            onClick={() => void openSession(session.id)}
          >
            {renamingId === session.id ? (
              <input
                autoFocus
                defaultValue={session.title}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => void commitRename(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename(session.id);
                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                }}
              />
            ) : (
              <>
                <div className="assistant-session-title">{session.title}</div>
                <div className="assistant-session-meta">
                  <span>{session.turnCount} turn</span>
                  <span>{formatRelativeTime(session.updatedAt)}</span>
                </div>
              </>
            )}
            <div className="assistant-session-actions" onClick={(e) => e.stopPropagation()}>
              {loadingSessionId === session.id ? (
                <span className="assistant-session-loading" />
              ) : (
                <>
                  <button type="button" aria-label="Đổi tên" onClick={() => { setRenamingId(session.id); setRenameValue(session.title); }}>
                    <Pencil size={12} />
                  </button>
                  <button type="button" aria-label="Xoá" onClick={(e) => void removeSession(session.id, e)}>
                    <X size={12} />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>

    <div className="panel assistant-main">
      <div className="panel-head">
        <div className="assistant-title">
          <Sparkles size={20} />
          <div>
            <h2>Trợ lý AI iOffice</h2>
            <p>{status?.available ? 'Hỏi bằng tiếng Việt về dữ liệu văn bản. Câu trả lời dựa trên dữ liệu thật trong database.' : 'Chưa có OPENAI_API_KEY — liên hệ admin để bật.'}</p>
          </div>
        </div>
        <div className="assistant-actions">
          <button className="secondary" type="button" onClick={clear} disabled={!messages.length}><Trash2 size={16} />Xoá hội thoại</button>
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
              {message.content || (message.pending ? <span className="typing">Đang suy nghĩ...</span> : '')}
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
