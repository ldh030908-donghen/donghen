"use client";

import { useState } from "react";

export type DonutSlice = { key: string; label: string; value: number; color: string };

export default function DonutChart({
  slices,
  centerLabel,
  activeKey,
  onSelect,
  emptyHint,
}: {
  slices: DonutSlice[];
  /** 도넛 가운데에 표시할 총합 라벨 (예: "89건"). */
  centerLabel?: string;
  /** 선택된 조각(필터링 등에 사용). */
  activeKey?: string | null;
  onSelect?: (key: string | null) => void;
  emptyHint?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    return (
      <div className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
        {emptyHint ?? "아직 데이터가 없습니다."}
      </div>
    );
  }

  const R = 40;
  const STROKE = 16;
  const CIRC = 2 * Math.PI * R;

  const segments = slices
    .filter((s) => s.value > 0)
    .reduce<{ list: (DonutSlice & { dash: number; offset: number; pct: number })[]; sum: number }>(
      (state, s) => {
        const frac = s.value / total;
        const dash = frac * CIRC;
        const offset = -((state.sum / total) * CIRC);
        return { list: [...state.list, { ...s, dash, offset, pct: frac * 100 }], sum: state.sum + s.value };
      },
      { list: [], sum: 0 }
    ).list;

  const highlighted = hover ?? activeKey ?? null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: 176, height: 176 }}>
        <svg viewBox="0 0 100 100" width={176} height={176}>
          <g transform="rotate(-90 50 50)">
            <circle cx={50} cy={50} r={R} fill="none" stroke="var(--bg-elevated)" strokeWidth={STROKE} />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={50}
                cy={50}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={highlighted === s.key ? STROKE + 4 : STROKE}
                strokeDasharray={`${s.dash} ${CIRC - s.dash}`}
                strokeDashoffset={s.offset}
                opacity={highlighted && highlighted !== s.key ? 0.35 : 1}
                style={{ cursor: onSelect ? "pointer" : "default", transition: "stroke-width 0.15s, opacity 0.15s" }}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover((h) => (h === s.key ? null : h))}
                onClick={() => onSelect?.(activeKey === s.key ? null : s.key)}
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hover ? (
            <>
              <div className="text-lg font-bold tabular-nums" style={{ color: "var(--text)" }}>
                {slices.find((s) => s.key === hover)?.value.toLocaleString()}
              </div>
              <div className="text-[10px] text-center px-4 truncate max-w-[110px]" style={{ color: "var(--text-faint)" }}>
                {slices.find((s) => s.key === hover)?.label}
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold tabular-nums" style={{ color: "var(--text)" }}>
                {total.toLocaleString()}
              </div>
              {centerLabel && (
                <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                  {centerLabel}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
        {segments
          .slice()
          .sort((a, b) => b.value - a.value)
          .map((s) => (
            <button
              key={s.key}
              onClick={() => onSelect?.(activeKey === s.key ? null : s.key)}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover((h) => (h === s.key ? null : h))}
              className="flex items-center gap-2 text-left rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-[var(--bg)]"
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span
                className="text-xs flex-1 truncate"
                style={{ color: highlighted === s.key ? "var(--text)" : "var(--text-muted)" }}
              >
                {s.label}
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                {s.value.toLocaleString()}
              </span>
              <span className="text-[11px] w-10 text-right shrink-0" style={{ color: "var(--text-faint)" }}>
                {s.pct.toFixed(0)}%
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
