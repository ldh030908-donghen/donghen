"use client";

const CASE_LABELS: Record<string, string> = {
  R1_MONTHLY_MAX: "월 최대근로시간 초과",
  R2_CHECKIN_GAP: "입문-변경시작 괴리",
  R3_EXCLUDE_EXCESS: "제외시간 과다 사용",
  R4_CORE_TIME: "코어타임 미준수",
  R5_MONTHEND_EXCLUDE: "월말 제외시간 일괄입력",
  R6_BADGE_INTEGRITY: "데이터 정합성 오류",
  R7_CONSECUTIVE_LONG_STAY: "연속 장시간 근무",
};

export function ruleLabel(code: string): string {
  return CASE_LABELS[code] ?? code;
}

export default function RuleCountChart({
  byRule,
  activeRule,
  onSelect,
}: {
  byRule: Record<string, number>;
  activeRule: string | null;
  onSelect: (rule: string | null) => void;
}) {
  const entries = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-xs font-medium mb-4" style={{ color: "var(--text-faint)" }}>
        규칙별 특이건 수 · 막대를 클릭해 필터링
      </div>
      <div className="flex flex-col gap-2.5">
        {entries.map(([rule, count]) => {
          const pct = (count / max) * 100;
          const active = activeRule === rule;
          return (
            <button
              key={rule}
              onClick={() => onSelect(active ? null : rule)}
              className="group flex items-center gap-3 text-left"
            >
              <div className="w-40 shrink-0 text-xs truncate" style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>
                {ruleLabel(rule)}
              </div>
              <div className="flex-1 h-[18px] relative rounded" style={{ background: "var(--bg-elevated)" }}>
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: active ? "var(--accent-strong)" : "var(--accent)",
                    opacity: active || activeRule === null ? 1 : 0.35,
                  }}
                />
              </div>
              <div
                className="w-12 shrink-0 text-xs text-right tabular-nums"
                style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
              >
                {count.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
