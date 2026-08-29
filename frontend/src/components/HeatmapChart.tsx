"use client";

import { useState } from "react";
import { ruleLabel } from "./RuleCountChart";

export type HeatmapCell = { rowKey: string; colKey: string; value: number };

/** 부서 x 규칙 히트맵: 어느 부서에 어떤 유형의 특이건이 몰려있는지 색 농도로 한눈에 보여준다.
 * rowKeys는 이미 정렬·상위 N개로 잘려서 들어온다고 가정(전체 부서를 다 그리면 표가 너무 길어짐). */
export default function HeatmapChart({
  title,
  rowKeys,
  colKeys,
  cells,
  rowLabel = (k) => k,
  emptyHint,
}: {
  title: string;
  rowKeys: string[];
  colKeys: string[];
  cells: HeatmapCell[];
  rowLabel?: (key: string) => string;
  emptyHint?: string;
}) {
  const [hover, setHover] = useState<{ row: string; col: string } | null>(null);
  const lookup = new Map<string, number>();
  for (const c of cells) lookup.set(`${c.rowKey}::${c.colKey}`, c.value);
  const max = Math.max(...cells.map((c) => c.value), 1);

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="text-xs font-medium mb-4" style={{ color: "var(--text-faint)" }}>
        {title}
      </div>
      {rowKeys.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
          {emptyHint ?? "아직 데이터가 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: 4 }}>
            <thead>
              <tr>
                <th className="text-left font-medium pr-2 pb-1 whitespace-nowrap" style={{ color: "var(--text-faint)" }} />
                {colKeys.map((col) => (
                  <th
                    key={col}
                    className="font-medium pb-1 whitespace-nowrap"
                    style={{ color: "var(--text-faint)", writingMode: "horizontal-tb" }}
                    title={ruleLabel(col)}
                  >
                    <span className="inline-block max-w-[64px] truncate align-bottom">{ruleLabel(col).slice(0, 4)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((row) => (
                <tr key={row}>
                  <td className="pr-2 whitespace-nowrap text-right" style={{ color: "var(--text-muted)" }}>
                    {rowLabel(row)}
                  </td>
                  {colKeys.map((col) => {
                    const v = lookup.get(`${row}::${col}`) ?? 0;
                    const intensity = v / max;
                    const isHover = hover?.row === row && hover?.col === col;
                    return (
                      <td key={col} className="p-0">
                        <div
                          onMouseEnter={() => setHover({ row, col })}
                          onMouseLeave={() => setHover((h) => (h && h.row === row && h.col === col ? null : h))}
                          className="w-9 h-7 rounded-md flex items-center justify-center transition-transform"
                          style={{
                            background: v === 0 ? "var(--bg-elevated)" : `color-mix(in srgb, var(--accent) ${Math.max(12, intensity * 100)}%, var(--surface))`,
                            color: intensity > 0.55 ? "#fff" : "var(--text-muted)",
                            fontWeight: v > 0 ? 600 : 400,
                            transform: isHover ? "scale(1.08)" : "scale(1)",
                            outline: isHover ? "2px solid var(--accent-strong)" : "none",
                          }}
                          title={`${rowLabel(row)} · ${ruleLabel(col)} · ${v}건`}
                        >
                          {v > 0 ? v : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
