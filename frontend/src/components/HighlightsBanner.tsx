"use client";

import { useEffect, useState } from "react";
import { fetchHighlights, type AnomalyItem } from "@/lib/api";

const FLAG_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 22V15" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function HighlightsBanner() {
  const [items, setItems] = useState<AnomalyItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetchHighlights(8)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!items || items.length <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [items, paused]);

  return (
    <div
      className="rounded-2xl p-3 h-full flex flex-col gap-2 overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center gap-1.5 shrink-0" style={{ color: "var(--text-faint)" }}>
        <span style={{ color: "var(--status-critical)" }}>{FLAG_ICON}</span>
        <span className="text-xs font-medium">세부 확인 필요</span>
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium ml-auto"
          style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
        >
          확인대상
        </span>
      </div>

      {!items && (
        <div className="flex-1 flex items-center text-[11px]" style={{ color: "var(--text-faint)" }}>
          불러오는 중...
        </div>
      )}

      {items && items.length === 0 && (
        <div className="flex-1 flex items-center text-[11px]" style={{ color: "var(--text-faint)" }}>
          이번 달엔 특별히 확인이 필요한 건이 없습니다.
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="flex-1 min-h-0 flex flex-col justify-center gap-1">
            <div className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>
              {items[index].case_name}
            </div>
            <div className="text-xs truncate" style={{ color: "var(--text)" }}>
              {items[index].성명}
              <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--text-faint)" }}>
                {items[index].직급} · {items[index].사업부} · {items[index].부서명}
              </span>
            </div>
            <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              발생 {items[index].occurrence_count.toLocaleString()}회
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}번째`}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 12 : 5,
                  height: 5,
                  background: i === index ? "var(--status-critical)" : "var(--border-strong)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
