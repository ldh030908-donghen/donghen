"use client";

import type { ChatStep } from "@/lib/api";

const FLOW_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="12" r="3" />
    <path d="M6 9v6M9 6h3a3 3 0 0 1 3 3v0M9 18h3a3 3 0 0 0 3-3v0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProcessStatusPanel({
  loading,
  steps,
  reference,
  hasStarted,
}: {
  loading: boolean;
  steps: ChatStep[];
  reference: string | null;
  hasStarted: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-3 h-full flex flex-col gap-2 overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5" style={{ color: "var(--text-faint)" }}>
          <span style={{ color: "var(--accent)" }}>{FLOW_ICON}</span>
          <span className="text-xs font-medium">처리 과정</span>
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={
            loading
              ? { background: "var(--accent-soft)", color: "var(--accent-strong)" }
              : hasStarted
              ? { background: "var(--status-info-soft)", color: "var(--success)" }
              : { background: "var(--bg-elevated)", color: "var(--text-faint)" }
          }
        >
          {loading ? "처리 중" : hasStarted ? "완료" : "대기"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
        {!hasStarted && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 py-2">
            <span style={{ color: "var(--accent)", opacity: 0.5 }}>{FLOW_ICON}</span>
            <div className="text-[11px] leading-relaxed max-w-[180px]" style={{ color: "var(--text-faint)" }}>
              어시스턴트에게 질문하면 조회 단계가 여기 순서대로 표시돼요
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span className="inline-flex gap-1">
              {[0, 0.15, 0.3].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--accent)", animation: `skeleton-pulse 1s ease-in-out ${delay}s infinite` }}
                />
              ))}
            </span>
            데이터 조회 중...
          </div>
        )}

        {!loading &&
          steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold"
                style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
              >
                {i + 1}
              </span>
              <span className="truncate">{s.label}</span>
            </div>
          ))}
      </div>

      {!loading && reference && (
        <div
          className="shrink-0 text-[11px] px-2 py-1 rounded-md inline-flex items-center gap-1 self-start"
          style={{ background: "var(--bg-elevated)", color: "var(--text-faint)" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          참조: {reference}
        </div>
      )}
    </div>
  );
}
