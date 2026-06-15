'use client';
import { useState, useRef, useEffect } from 'react';
import { aiApi } from '@/lib/api';

interface Message {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
  toolResults?: any[];
}

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  "Who are my top spending customers?",
  "Find women aged 25-35 in Mumbai",
  "Show me lapsed buyers from last 90 days",
  "Which campaign had the best click rate?",
  "Draft a win-back SMS for inactive users",
];

export default function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      parts: [{ text: "Hi! I'm your ReachIQ AI assistant 👋\n\nI can help you:\n• Find and segment customers\n• Draft campaign messages\n• Analyse performance data\n• Suggest the best channel\n\nWhat would you like to do today?" }],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const apiHistory = messages.map(m => ({ role: m.role, parts: m.parts }));

  async function send(text?: string) {
    const userText = text || input.trim();
    if (!userText || loading) return;

    setInput('');
    const userMsg: Message = { role: 'user', parts: [{ text: userText }] };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await aiApi.chat(userText, apiHistory);
      const aiMsg: Message = {
        role: 'model',
        parts: [{ text: result.reply }],
        toolResults: result.toolResults,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: `Sorry, I ran into an error: ${e.message}` }],
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={`ai-chat-panel ${open ? 'open' : ''}`}>
      <div className="chat-header">
        <div className="ai-avatar">🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>AI Assistant</div>
          <div style={{ fontSize: '11px', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="status-dot live" />
            Powered by Gemini
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 8 }}>Try asking:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', fontSize: '12px', textAlign: 'left' }}
                onClick={() => send(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
            {msg.role === 'model' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, flexShrink: 0
              }}>🤖</div>
            )}
            <div className="chat-bubble">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                {msg.parts[0].text}
              </pre>
              {msg.toolResults && msg.toolResults.some(t => t.tool === 'query_customers' && t.result.customers) && (
                <div style={{ marginTop: 8, padding: '8px', background: 'var(--bg-base)', borderRadius: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
                  📊 Found <strong style={{ color: 'var(--accent-light)' }}>{msg.toolResults.find(t => t.tool === 'query_customers')?.result.total}</strong> matching customers
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-msg ai">
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--violet))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, flexShrink: 0
            }}>🤖</div>
            <div className="chat-bubble">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Ask anything about your customers..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="btn btn-primary btn-icon"
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{ height: 38, width: 38 }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
