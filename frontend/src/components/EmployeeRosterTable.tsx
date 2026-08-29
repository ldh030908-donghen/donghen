"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRoster, type RosterItem } from "@/lib/api";
import { formatHoursMinutes } from "@/lib/hours";
import { SEVERITY_STYLE, severityTier } from "@/lib/severity";
import OrgFilter from "./OrgFilter";
import { ruleLabel } from "./RuleCountChart";

const PAGE_SIZE = 20;

type SortKey = "anomaly_total" | "avg_hours" | "candidate_total" | "성명";
type SortDir = "asc" | "desc";

const SEARCH_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" strokeLinecap="round" />
  </svg>
);

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`font-medium px-4 py-3 whitespace-nowrap cursor-pointer select-none ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onClick(sortKey)}
      style={{ color: active ? "var(--accent-strong)" : "var(--text-faint)" }}
    >
      {label} {active ? (dir === "desc" ? "↓" : "↑") : ""}
    </th>
  );
}

export default function EmployeeRosterTable({
  month,
  onSelectEmployee,
}: {
  month: string | null;
  onSelectEmployee: (item: RosterItem) => void;
}) {
  const [division, setDivision] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<RosterItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("anomaly_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!month) return;
    setItems(null);
    setError(null);
    fetchRoster({ month, division: division ?? undefined, department: department ?? undefined })
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "명단을 불러오지 못했습니다."));
  }, [month, division, department]);

  useEffect(() => {
    setPage(1);
  }, [search, division, department, sortKey, sortDir]);

  function handleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim();
    const base = q ? items.filter((it) => it.사번.includes(q) || it.성명.includes(q)) : items;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [items, search, sortKey, sortDir]);

  const maxAnomaly = items ? Math.max(...items.map((i) => i.anomaly_total), 1) : 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center gap-3 p-4 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="text-sm font-semibold mr-1">전체 인원 명단</div>
        <OrgFilter
          division={division}
          department={department}
          onDivisionChange={(v) => {
            setDivision(v);
            setDepartment(null);
          }}
          onDepartmentChange={setDepartment}
        />
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
            {SEARCH_ICON}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="사번 / 성명 검색"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
        </div>
        <div className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
          {month ? `${month} 기준` : ""} · 총 {filtered.length.toLocaleString()}명
        </div>
      </div>

      {error && (
        <div className="p-6 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {!error && !items && (
        <div className="p-4 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg" style={{ background: "var(--bg-elevated)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }} />
          ))}
        </div>
      )}

      {!error && items && (
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
              <tr style={{ color: "var(--text-faint)" }} className="text-xs">
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">사업부</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">부서명</th>
                <SortHeader label="성명" sortKey="성명" active={sortKey === "성명"} dir={sortDir} onClick={handleSort} align="left" />
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">직급</th>
                <SortHeader label="평균근로시간" sortKey="avg_hours" active={sortKey === "avg_hours"} dir={sortDir} onClick={handleSort} />
                <SortHeader label="특이건" sortKey="anomaly_total" active={sortKey === "anomaly_total"} dir={sortDir} onClick={handleSort} />
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">최다유형</th>
                <SortHeader label="확인대상" sortKey="candidate_total" active={sortKey === "candidate_total"} dir={sortDir} onClick={handleSort} />
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">처리현황</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((it) => {
                const tier = severityTier(it.anomaly_total, maxAnomaly);
                const sv = SEVERITY_STYLE[tier];
                const unconfirmed = it.status_summary["unconfirmed"] ?? 0;
                return (
                  <tr
                    key={it.사번}
                    onClick={() => onSelectEmployee(it)}
                    className="cursor-pointer hover:bg-[var(--bg-elevated)]"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {it.사업부}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {it.부서명}
                    </td>
                    <td className="px-4 py-3">
                      {it.성명}
                      <span className="ml-1.5 text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
                        {it.사번}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {it.직급 || "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatHoursMinutes(it.avg_hours)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {it.anomaly_total > 0 ? (
                        <span
                          className="inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
                          style={{ background: sv.bg, color: sv.fg, fontVariantNumeric: "tabular-nums" }}
                        >
                          {it.anomaly_total.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {it.top_rule ? (
                        <span
                          className="inline-block px-2 py-1 rounded-md text-xs font-medium"
                          style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                        >
                          {ruleLabel(it.top_rule)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {it.candidate_total > 0 ? it.candidate_total.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {unconfirmed > 0 ? (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: "var(--status-warning-soft)", color: "var(--status-warning)" }}
                        >
                          미확인 {unconfirmed}
                        </span>
                      ) : it.anomaly_total > 0 ? (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: "#16a34a1a", color: "#16a34a" }}
                        >
                          처리 완료
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
                    조건에 맞는 인원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {items && totalPages > 1 && (
        <div className="p-4 flex items-center justify-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-40"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
          >
            이전
          </button>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-40"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
