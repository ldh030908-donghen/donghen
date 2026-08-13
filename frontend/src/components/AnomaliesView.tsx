"use client";

import { useMemo, useState } from "react";
import type { AnomaliesResponse } from "@/lib/api";
import RuleCountChart, { ruleLabel } from "./RuleCountChart";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
        {label}
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export default function AnomaliesView({ data }: { data: AnomaliesResponse }) {
  const [activeRule, setActiveRule] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return data.items.filter((item) => {
      if (activeRule && item.rule_code !== activeRule) return false;
      if (search) {
        const q = search.trim();
        if (!item.사번.includes(q) && !item.성명.includes(q) && !item.부서명.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [data.items, activeRule, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="총 특이건" value={data.total.toLocaleString()} />
        <StatTile label="특이 인원(중복 제외)" value={data.affected_employees.toLocaleString()} />
        <StatTile label="탐지 규칙 수" value={String(Object.keys(data.by_rule).length)} />
        <StatTile
          label="가장 많은 유형"
          value={
            Object.entries(data.by_rule).sort((a, b) => b[1] - a[1])[0]
              ? ruleLabel(Object.entries(data.by_rule).sort((a, b) => b[1] - a[1])[0][0])
              : "-"
          }
        />
      </div>

      <RuleCountChart byRule={data.by_rule} activeRule={activeRule} onSelect={setActiveRule} />

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="사번 / 성명 / 부서명 검색"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          {activeRule && (
            <button
              onClick={() => setActiveRule(null)}
              className="text-xs px-3 py-2 rounded-lg shrink-0"
              style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
            >
              {ruleLabel(activeRule)} 필터 해제
            </button>
          )}
          <div className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
            {filtered.length.toLocaleString()}건
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
              <tr style={{ color: "var(--text-faint)" }} className="text-xs">
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">사번</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">부서명</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">성명</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">직급</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">특이사례 케이스</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">상세</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr
                  key={`${item.사번}-${item.rule_code}-${i}`}
                  style={{ borderTop: "1px solid var(--border)" }}
                  className="hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {item.사번}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                    {item.부서명}
                  </td>
                  <td className="px-4 py-3">{item.성명}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                    {item.직급}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-1 rounded-md text-xs font-medium"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                    >
                      {ruleLabel(item.rule_code)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {item.detail}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
                    조건에 맞는 특이건이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
