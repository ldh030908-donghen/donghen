"use client";

import { useState } from "react";

type Point = { label: string; value: number };

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / step;
  const niceStep = (normalized <= 2 ? 0.5 : normalized <= 5 ? 1 : 2) * step;
  const top = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += niceStep) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export default function MonthlyTrendChart({
  title,
  points,
  valueFormatter = (v) => v.toLocaleString(),
  emptyHint,
}: {
  title: string;
  points: Point[];
  valueFormatter?: (v: number) => string;
  emptyHint?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>
          {title}
        </div>
        <div className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
          {emptyHint ?? "아직 데이터가 없습니다."}
        </div>
      </div>
    );
  }

  const W = 720;
  const H = 200;
  const padL = 40;
  const padR = 24;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const ticks = niceTicks(maxVal);
  const yMax = ticks[ticks.length - 1] || 1;

  const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-xs font-medium mb-3" style={{ color: "var(--text-faint)" }}>
        {title}
      </div>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--text-faint)">
                {t.toLocaleString()}
              </text>
            </g>
          ))}

          {points.length > 1 && (
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}

          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={5}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth={2}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                style={{ cursor: "pointer" }}
              />
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-faint)">
                {p.label}
              </text>
            </g>
          ))}

          {/* 마지막 지점 직접 라벨 */}
          <text
            x={x(points.length - 1)}
            y={y(last.value) - 12}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--text)"
          >
            {valueFormatter(last.value)}
          </text>
        </svg>

        {hover !== null && (
          <div
            className="absolute px-2 py-1 rounded-md text-xs pointer-events-none"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              top: `${(y(points[hover].value) / H) * 100}%`,
              transform: "translate(-50%, -130%)",
              background: "var(--text)",
              color: "var(--bg)",
              whiteSpace: "nowrap",
            }}
          >
            {points[hover].label} · {valueFormatter(points[hover].value)}
          </div>
        )}
      </div>
    </div>
  );
}
