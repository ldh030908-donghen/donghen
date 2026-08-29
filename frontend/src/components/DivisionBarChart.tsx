"use client";

export type BarSlice = { key: string; label: string; value: number };

/** 사업부별 특이건 수 같은 범주형 막대그래프. RuleCountChart와 같은 시각 언어(단색 그라디언트 바)를
 * 규칙이 아닌 임의의 범주(사업부/부서 등)에 쓸 수 있게 일반화한 버전. */
export default function DivisionBarChart({
  title,
  slices,
  activeKey,
  onSelect,
  emptyHint,
}: {
  title: string;
  slices: BarSlice[];
  activeKey?: string | null;
  onSelect?: (key: string | null) => void;
  emptyHint?: string;
}) {
  const entries = [...slices].sort((a, b) => b.value - a.value).filter((s) => s.value > 0);
  const max = Math.max(...entries.map((s) => s.value), 1);

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="text-xs font-medium mb-4" style={{ color: "var(--text-faint)" }}>
        {title}
      </div>
      {entries.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
          {emptyHint ?? "아직 데이터가 없습니다."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((s, i) => {
            const pct = (s.value / max) * 100;
            const active = activeKey === s.key;
            return (
              <button
                key={s.key}
                onClick={() => onSelect?.(active ? null : s.key)}
                className="group flex items-center gap-3 text-left rounded-lg -mx-2 px-2 py-1 transition-colors hover:bg-[var(--bg)]"
                style={{ cursor: onSelect ? "pointer" : "default" }}
              >
                <div
                  className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: i === 0 ? "var(--accent-soft)" : "var(--bg-elevated)",
                    color: i === 0 ? "var(--accent-strong)" : "var(--text-faint)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="w-28 shrink-0 text-xs truncate" style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>
                  {s.label}
                </div>
                <div className="flex-1 h-[20px] relative rounded-md overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-md transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      background: active
                        ? "var(--accent-strong)"
                        : "linear-gradient(90deg, var(--accent) 0%, #4a89f5 100%)",
                      opacity: active || !activeKey ? 1 : 0.35,
                    }}
                  />
                </div>
                <div
                  className="w-12 shrink-0 text-xs text-right font-semibold tabular-nums"
                  style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
                >
                  {s.value.toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
