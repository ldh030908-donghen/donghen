"use client";

import { useEffect, useState } from "react";
import { fetchHrNews, type HrNewsItem } from "@/lib/api";

const NEWS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M10 6h6M10 10h6M10 14h4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function NewsBanner() {
  const [items, setItems] = useState<HrNewsItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetchHrNews()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!items || items.length <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 4500);
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
        <span style={{ color: "var(--accent)" }}>{NEWS_ICON}</span>
        <span className="text-xs font-medium">근로시간 · HR 뉴스</span>
      </div>

      {!items && (
        <div className="flex-1 flex items-center text-[11px]" style={{ color: "var(--text-faint)" }}>
          뉴스를 불러오는 중...
        </div>
      )}

      {items && items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-1">
          <span style={{ color: "var(--accent)", opacity: 0.5 }}>{NEWS_ICON}</span>
          <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            지금은 표시할 뉴스가 없어요
          </div>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <a
            href={items[index].url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-0 flex flex-col justify-center gap-1 group"
          >
            <div
              className="text-xs leading-snug line-clamp-3 group-hover:underline"
              style={{ color: "var(--text)" }}
            >
              {items[index].title}
            </div>
            {items[index].source && (
              <div className="text-[10px] truncate" style={{ color: "var(--text-faint)" }}>
                {items[index].source}
              </div>
            )}
          </a>
          <div className="flex items-center gap-1 shrink-0">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}번째 뉴스`}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 12 : 5,
                  height: 5,
                  background: i === index ? "var(--accent)" : "var(--border-strong)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
