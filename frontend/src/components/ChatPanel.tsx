"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildExportUrl,
  sendChatMessage,
  type ChatExport,
  type ChatMessage,
  type ChatResult,
  type ChatStep,
} from "@/lib/api";

type DisplayMessage = ChatMessage & {
  result?: ChatResult;
  export?: ChatExport;
};

export type ChatStatus = {
  loading: boolean;
  steps: ChatStep[];
  reference: string | null;
  hasStarted: boolean;
};

function ResultPreview({ items }: { items: Record<string, unknown>[] }) {
  if (items.length === 0) return null;
  const cols = Object.keys(items[0])
    .filter((c) => c !== "detail")
    .slice(0, 5);
  return (
    <div
      className="rounded-lg overflow-hidden text-xs"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              {cols.map((c) => (
                <th
                  key={c}
                  className="text-left font-medium px-2 py-1.5 whitespace-nowrap"
                  style={{ color: "var(--text-faint)" }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 5).map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1.5 truncate max-w-[130px] whitespace-nowrap">
                    {String(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 5 && (
        <div
          className="px-2 py-1.5 text-center"
          style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border)" }}
        >
          외 {items.length - 5}건 · 전체는 엑셀로 확인
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ onStatusChange }: { onStatusChange?: (status: ChatStatus) => void }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const history: ChatMessage[] = messages.map(({ role, content }) => ({ role, content }));
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    onStatusChange?.({ loading: true, steps: [], reference: null, hasStarted: true });
    try {
      const res = await sendChatMessage(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, result: res.result, export: res.export },
      ]);
      onStatusChange?.({ loading: false, steps: res.steps, reference: res.reference, hasStarted: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 중 오류가 발생했습니다.");
      onStatusChange?.({ loading: false, steps: [], reference: null, hasStarted: true });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 한글/일본어 등 IME로 글자를 조합하는 중에 Enter를 누르면 그 Enter는 "조합 완료" 입력이지
    // 전송 의도가 아니다 — 이때 그냥 보내면 조합 중이던 마지막 글자가 남는다.
    if (isComposing || e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, #4a89f5 100%)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold">AI 어시스턴트</div>
          <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            근무시간 · 특이건 질의응답
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-xs leading-relaxed flex flex-col gap-1" style={{ color: "var(--text-faint)" }}>
            <div>예) &quot;26년 3월 실근로시간 상위 부서 5개 알려줘&quot;</div>
            <div>예) &quot;영업사업부 근태 특이건 정리해줘&quot;</div>
            <div>예) &quot;연장근로 한도가 법적으로 어떻게 되지?&quot;</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[92%] flex flex-col gap-2">
              <div
                className="rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
                style={
                  m.role === "user"
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--bg-elevated)", color: "var(--text)" }
                }
              >
                {m.content}
              </div>
              {m.result?.items && m.result.items.length > 0 && <ResultPreview items={m.result.items} />}
              {m.export && (
                <a
                  href={buildExportUrl(m.export)}
                  className="self-start text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  엑셀로 다운로드
                </a>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--bg-elevated)" }}>
              <span className="inline-flex gap-1">
                {[0, 0.15, 0.3].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--text-faint)", animation: `skeleton-pulse 1s ease-in-out ${delay}s infinite` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs p-2 rounded-lg" style={{ color: "var(--danger)", background: "#dc262612" }}>
            {error}
          </div>
        )}
      </div>

      <div className="p-3 flex items-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="질문을 입력하세요..."
          rows={1}
          className="flex-1 resize-none px-3 py-2 rounded-lg text-sm outline-none max-h-24"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg text-sm font-medium shrink-0 disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          전송
        </button>
      </div>
    </div>
  );
}
