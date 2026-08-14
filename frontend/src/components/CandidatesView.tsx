"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchCandidates,
  fetchCandidatesMeta,
  fetchMonths,
  type AnomaliesResponse,
  type CandidateMeta,
  type EmployeeMatch,
} from "@/lib/api";
import AnomalyDetailCell from "./AnomalyDetailCell";
import OrgFilter from "./OrgFilter";
import EmployeePicker from "./EmployeePicker";
import PeriodSelect from "./PeriodSelect";
import { SEVERITY_STYLE, severityTier } from "@/lib/severity";

const SEARCH_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CandidatesView() {
  const [division, setDivision] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeMatch | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<CandidateMeta[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchMonths().then(setMonths);
    fetchCandidatesMeta().then(setMeta);
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    fetchCandidates({
      month: month ?? undefined,
      division: division ?? undefined,
      department: department ?? undefined,
      empId: employee?.사번,
    })
      .then((res) => {
        setData(res);
        if (!month) setMonth(res.month);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, division, department, employee?.사번]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((item) => {
        if (!search) return true;
        const q = search.trim();
        return item.사번.includes(q) || item.성명.includes(q) || item.부서명.includes(q);
      })
      .sort((a, b) => b.occurrence_count - a.occurrence_count);
  }, [data, search]);

  const maxOccurrence = data ? Math.max(...data.items.map((i) => i.occurrence_count), 1) : 1;
  const breadcrumb = [division, department, employee?.성명].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-2xl p-5 flex items-start gap-3"
        style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-100)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-xs leading-relaxed" style={{ color: "var(--accent-strong)" }}>
          <strong>확인대상</strong>은 R1~R7 정식 탐지 규칙이 아닙니다. 검토해볼 만한 패턴 후보를 모아두는 곳으로,
          여기서 계속 눈에 띄는 항목은 검토 후 정식 규칙으로 편입할 수 있습니다.
          {meta.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {meta.map((m) => (
                <li key={m.candidate_code}>
                  · <strong>{m.case_name}</strong> — {m.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {months.length > 1 && (
            <PeriodSelect periods={months} periodKind="month" value={month} onChange={setMonth} label="조회 월" />
          )}
          <OrgFilter
            division={division}
            department={department}
            onDivisionChange={(v) => {
              setDivision(v);
              setEmployee(null);
            }}
            onDepartmentChange={(v) => {
              setDepartment(v);
              setEmployee(null);
            }}
          />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            또는
          </span>
          <EmployeePicker selected={employee} onSelect={setEmployee} />
        </div>
        {breadcrumb.length > 0 && (
          <div className="text-xs flex items-center gap-1.5" style={{ color: "var(--accent-strong)" }}>
            <span style={{ color: "var(--text-faint)" }}>조회 범위:</span>
            전체
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span style={{ color: "var(--text-faint)" }}>→</span>
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm p-4 rounded-xl" style={{ color: "var(--danger)", background: "#dc262612" }}>
          {error}
        </div>
      )}

      {!error && !data && (
        <div className="h-24 rounded-2xl" style={{ background: "var(--surface)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }} />
      )}

      {data && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-faint)" }}>{SEARCH_ICON}</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="사번 / 성명 / 부서명 검색"
              className="flex-1 px-1 py-1 text-sm outline-none bg-transparent"
              style={{ color: "var(--text)" }}
            />
            <div className="text-xs shrink-0" style={{ color: "var(--text-faint)" }}>
              {data.month} 기준 · {filtered.length.toLocaleString()}건 · {data.affected_employees.toLocaleString()}명
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--surface)" }}>
                <tr style={{ color: "var(--text-faint)" }} className="text-xs">
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">사번</th>
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">사업부</th>
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">부서명</th>
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">성명</th>
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">직급</th>
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">후보 유형</th>
                  <th className="text-right font-medium px-4 py-3 whitespace-nowrap">발생</th>
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">상세</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const tier = severityTier(item.occurrence_count, maxOccurrence);
                  const sv = SEVERITY_STYLE[tier];
                  return (
                    <tr
                      key={`${item.사번}-${item.rule_code}-${i}`}
                      style={{ borderTop: "1px solid var(--border)", borderLeft: `3px solid ${sv.fg}` }}
                      className="hover:bg-[var(--bg-elevated)]"
                    >
                      <td className="px-4 py-3 tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {item.사번}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                        {item.사업부}
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
                          {item.case_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
                          style={{ background: sv.bg, color: sv.fg, fontVariantNumeric: "tabular-nums" }}
                        >
                          {item.occurrence_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AnomalyDetailCell detail={item.detail} />
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
                      이번 달에는 확인이 필요한 항목이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
