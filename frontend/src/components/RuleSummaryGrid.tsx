"use client";

import { ruleColor, ruleLabel } from "./RuleCountChart";

const RULE_CODES = [
  "R1_MONTHLY_MAX",
  "R2_CHECKIN_GAP",
  "R3_EXCLUDE_EXCESS",
  "R4_CORE_TIME",
  "R5_MONTHEND_EXCLUDE",
  "R6_BADGE_INTEGRITY",
  "R7_CONSECUTIVE_LONG_STAY",
];

/** 규칙(R1~R7)별 현황 카드 그리드 — "특이건별 현황"을 한눈에 보여주고, 클릭하면 근태 특이건
 * 조회 탭으로 이동해 그 규칙으로 바로 필터링된 상세 목록을 보여준다. */
export default function RuleSummaryGrid({
  byRule,
  onSelectRule,
}: {
  byRule: Record<string, number>;
  onSelectRule: (ruleCode: string) => void;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="text-xs font-medium mb-4" style={{ color: "var(--text-faint)" }}>
        규칙별(R1~R7) 특이건 현황 · 카드를 클릭하면 해당 규칙 상세로 이동
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {RULE_CODES.map((code, i) => {
          const count = byRule[code] ?? 0;
          const color = ruleColor(code, i);
          return (
            <button
              key={code}
              onClick={() => onSelectRule(code)}
              className="text-left rounded-xl p-3 flex flex-col gap-2 transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${color}1a`, color }}
                >
                  {code.split("_")[0]}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: color, opacity: count > 0 ? 1 : 0.25 }}
                />
              </div>
              <div className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
                {ruleLabel(code)}
              </div>
              <div className="text-xl font-bold tabular-nums" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {count.toLocaleString()}
                <span className="text-xs font-medium ml-0.5" style={{ color: "var(--text-faint)" }}>
                  건
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
