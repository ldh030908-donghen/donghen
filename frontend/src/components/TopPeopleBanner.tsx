"use client";

import { useEffect, useState } from "react";

export type BannerItem = {
  name: string;
  dept: string;
  division: string;
  rankTitle: string;
  metricLabel: string;
  metricSub?: string;
};

export default function TopPeopleBanner({
  heading,
  subheading,
  icon,
  items,
  tone = "accent",
  onItemClick,
}: {
  heading: string;
  subheading?: string;
  icon: React.ReactNode;
  items: BannerItem[] | null;
  tone?: "accent" | "critical";
  /** 현재 보여지는 인물을 클릭했을 때(예: 상세 히스토리 모달을 열 때) 순위(index)를 넘겨준다. */
  onItemClick?: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  useEffect(() => {
    if (!items || items.length <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 3200);
    return () => clearInterval(t);
  }, [items, paused]);

  const toneColor = tone === "critical" ? "var(--status-critical)" : "var(--accent)";
  const toneSoft = tone === "critical" ? "var(--status-critical-soft)" : "var(--accent-soft)";

  if (!items || items.length === 0) {
    return null;
  }

  const current = items[index];
  const isTop = index === 0;

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 transition-colors"
      style={{
        background: "var(--surface)",
        border: isTop ? "1px solid var(--status-warning)" : "1px solid var(--border)",
        boxShadow: isTop ? "0 0 0 3px var(--status-warning-soft)" : "var(--shadow-sm)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: toneSoft, color: toneColor }}
      >
        {icon}
      </div>

      <div className="min-w-0 shrink-0">
        <div className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>
          {heading}
        </div>
        {subheading && (
          <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            {subheading}
          </div>
        )}
      </div>

      <div className="w-px self-stretch shrink-0" style={{ background: "var(--border)" }} />

      <div
        className="flex-1 min-w-0 flex items-center gap-3"
        onClick={onItemClick ? () => onItemClick(index) : undefined}
        style={{ cursor: onItemClick ? "pointer" : "default" }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
          style={
            isTop
              ? { background: "var(--status-warning-soft)", color: "var(--status-warning)" }
              : { background: toneSoft, color: toneColor }
          }
        >
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">
            {current.name}
            <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-faint)" }}>
              {current.rankTitle} · {current.division} · {current.dept}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-sm font-bold tabular-nums"
            style={{ color: isTop ? "var(--status-warning)" : toneColor, fontVariantNumeric: "tabular-nums" }}
          >
            {current.metricLabel}
          </div>
          {current.metricSub && (
            <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              {current.metricSub}
            </div>
          )}
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
              width: i === index ? 14 : 6,
              height: 6,
              background: i === index ? toneColor : "var(--border-strong)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
