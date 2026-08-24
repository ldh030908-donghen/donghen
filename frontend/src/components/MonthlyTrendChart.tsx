"use client";

import { useState } from "react";

type Point = { label: string; value: number; key?: string };

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
  onPointClick,
  bare = false,
}: {
  title: string;
  points: Point[];
  valueFormatter?: (v: number) => string;
  emptyHint?: string;
  /** 포인트를 클릭하면 그 지점의 key(없으면 label)로 상세 조회를 하고 싶을 때 사용. */
  onPointClick?: (point: Point) => void;
  /** true면 카드 배경/제목 줄 없이 차트 내용만 그린다 (바깥에서 이미 카드+제목을 그려주는 경우). */
  bare?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const Wrapper = "div";
  const wrapperProps = bare
    ? {}
    : { className: "rounded-2xl p-5", style: { background: "var(--surface)", border: "1px solid var(--border)" } };

  if (points.length === 0) {
    return (
      <Wrapper {...wrapperProps}>
        {!bare && (
          <div className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>
            {title}
          </div>
        )}
        <div className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
          {emptyHint ?? "아직 데이터가 없습니다."}
        </div>
      </Wrapper>
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
  // 여러 달이 같은 최고값을 가지면 가장 최근(마지막) 지점 하나만 강조한다.
  const peakIndex =
    points.length > 1 && maxVal > 0
      ? points.reduce((best, p, i) => (p.value === maxVal ? i : best), -1)
      : -1;
  const ticks = niceTicks(maxVal);
  const yMax = ticks[ticks.length - 1] || 1;

  const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z`;
  const last = points[points.length - 1];
  const gradientId = `trend-fill-${title.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <Wrapper {...wrapperProps}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        {!bare && (
          <div className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>
            {title}
          </div>
        )}
        <div className="flex items-center gap-3 text-[10px] ml-auto" style={{ color: "var(--text-faint)" }}>
          {peakIndex >= 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--status-critical)" }} />
              최고점
            </span>
          )}
          {onPointClick && <span>포인트 클릭 시 상세 조회</span>}
        </div>
      </div>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {points.length > 1 && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
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

          {points.map((p, i) => {
            const isPeak = i === peakIndex;
            return (
              <g key={i}>
                {isPeak && (
                  <circle cx={x(i)} cy={y(p.value)} r={10} fill="var(--status-critical)" opacity={0.18} />
                )}
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r={isPeak ? 6 : 5}
                  fill={isPeak ? "var(--status-critical)" : "var(--accent)"}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                  onClick={() => onPointClick?.(p)}
                  style={{ cursor: onPointClick ? "pointer" : "default" }}
                />
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={isPeak ? "var(--status-critical)" : "var(--text-faint)"} fontWeight={isPeak ? 700 : 400}>
                  {p.label}
                </text>
              </g>
            );
          })}

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
            {hover === peakIndex && " · 최고점"}
          </div>
        )}
      </div>
    </Wrapper>
  );
}
