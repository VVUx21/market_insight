import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const RECOMMENDATIONS = [
  {
    icon: "📊",
    title: "Market Signals",
    text: "Analyze the Indian stock market with today's key signals",
  },
  {
    icon: "🧭",
    title: "Market Segments",
    text: "Analyse conditions of Large, Mid and Small Cap in Indian Market",
  },
  {
    icon: "📰",
    title: "Market Events",
    text: "Track major stock market events shaping investor sentiment",
  },
  {
    icon: "🌍",
    title: "Global Impact",
    text: "How global news connects with Indian market movements",
  },
];

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /*
   * Generate a thread ID for the current conversation.
   * This allows your LangGraph MemorySaver/backend
   * to maintain conversation context.
   */
  const threadIdRef = useRef(
    `market-insight-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`
  );

  // Automatically scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Auto resize textarea
  const resizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  };

  const sendMessage = useCallback(
    async (messageText?: string) => {
      const text = (messageText ?? input).trim();

      if (!text || loading) return;

      const userMessage: Message = {
        id: createId(),
        role: "user",
        content: text,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const response = await fetch(
          "http://localhost:8000/api/chat",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
            prompt: {
              content: text,
              id: createId(),
              role: "user",
            },
            threadId: threadIdRef.current,
            responseId: createId(),
          }),
          }
        );

        if (!response.ok) {
        const errorText = await response.text();

        console.error(
          "Backend error:",
          response.status,
          errorText
        );

        throw new Error(
          `Backend returned ${response.status}: ${errorText}`
        );
      }

        const data = await response.json();

        /*
         * Supports a few common backend response formats.
         */
        const assistantText =
          data.response ??
          data.message ??
          data.output ??
          data.content ??
          "I couldn't generate a response.";

        const assistantMessage: Message = {
          id: createId(),
          role: "assistant",
          content:
            typeof assistantText === "string"
              ? assistantText
              : JSON.stringify(assistantText),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Chat error:", error);

        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content:
              "Sorry, I couldn't connect to the Market Insight server. Please make sure the backend is running on port 8000.",
          },
        ]);
      } finally {
        setLoading(false);

        setTimeout(() => {
          textareaRef.current?.focus();
        }, 50);
      }
    },
    [input, loading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleRecommendation = (text: string) => {
    setSidebarOpen(false);
    sendMessage(text);
  };

  const createNewChat = () => {
    setMessages([]);

    threadIdRef.current = `market-insight-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    setInput("");
    setSidebarOpen(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="app">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= SIDEBAR ================= */}

      <aside
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-logo">
              <img
                src="/icon.png"
                alt="Market Insight"
              />
            </div>

            <div>
              <div className="brand-name">
                Market Insight
              </div>

              <div className="brand-subtitle">
                AI Market Intelligence
              </div>
            </div>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={createNewChat}
        >
          <span className="new-chat-icon">＋</span>
          <span>New Chat</span>
        </button>

        <div className="sidebar-divider" />

        <div className="sidebar-info">
          <div className="info-title">
            Market Insight AI
          </div>

          <p>
            Your intelligent assistant for Indian
            financial markets, stocks and investment
            research.
          </p>
        </div>

        <div className="sidebar-footer">
          <div className="status-dot" />
          <span>Market Intelligence Online</span>
        </div>
      </aside>

      {/* ================= MAIN ================= */}

      <main className="main">
        {/* Header */}

        <header className="header">
          <div className="header-left">
            <button
              className="menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="mobile-brand">
              <img
                src="/icon.png"
                alt="Market Insight"
              />

              <span>Market Insight</span>
            </div>
          </div>

          <div className="header-status">
            <span className="live-dot" />
            <span>AI Market Analyst</span>
          </div>
        </header>

        {/* ================= CHAT ================= */}

        <div className="chat-area">
          {!hasMessages ? (
            <div className="welcome">
              <div className="welcome-icon">
                <img
                  src="/icon.png"
                  alt="Market Insight"
                />
              </div>

              <h1>
                Your Market Intelligence
                <span> Assistant</span>
              </h1>

              <p>
                Analyze stocks, understand market
                movements and explore financial insights
                with AI-powered research.
              </p>

              {/* Recommendations */}

              <div className="recommendations">
                {RECOMMENDATIONS.map((recommendation) => (
                  <button
                    key={recommendation.text}
                    className="recommendation-card"
                    onClick={() =>
                      handleRecommendation(
                        recommendation.text
                      )
                    }
                    disabled={loading}
                  >
                    <div className="recommendation-icon">
                      {recommendation.icon}
                    </div>

                    <div className="recommendation-content">
                      <div className="recommendation-title">
                        {recommendation.title}
                      </div>

                      <div className="recommendation-text">
                        {recommendation.text}
                      </div>
                    </div>

                    <div className="recommendation-arrow">
                      →
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message-row ${message.role}`}
                >
                  {message.role === "assistant" && (
                    <div className="avatar assistant-avatar">
                      <img
                        src="/icon.png"
                        alt="AI"
                      />
                    </div>
                  )}

                  <div
                    className={`message ${
                      message.role === "user"
                        ? "user-message"
                        : "assistant-message"
                    }`}
                  >
                    <div className="message-label">
                      {message.role === "user"
                        ? "You"
                        : "Market Insight"}
                    </div>

                    <div className="message-content">
                      {message.content}
                    </div>
                  </div>

                  {message.role === "user" && (
                    <div className="avatar user-avatar">
                      U
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="message-row assistant">
                  <div className="avatar assistant-avatar">
                    <img
                      src="/icon.png"
                      alt="AI"
                    />
                  </div>

                  <div className="message assistant-message">
                    <div className="message-label">
                      Market Insight
                    </div>

                    <div className="typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ================= INPUT ================= */}

        <div className="input-section">
          <form
            className="input-wrapper"
            onSubmit={handleSubmit}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                resizeTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about stocks, markets, companies or financial trends..."
              rows={1}
              disabled={loading}
            />

            <button
              type="submit"
              className={`send-button ${
                input.trim() && !loading
                  ? "send-active"
                  : ""
              }`}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <span>↑</span>
              )}
            </button>
          </form>

          <div className="input-hint">
            Market Insight can analyze market data,
            financial statements and news.
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;