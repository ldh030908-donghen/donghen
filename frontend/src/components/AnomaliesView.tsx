"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAnomalies,
  fetchAnomaliesTrend,
  fetchMonths,
  type AnomalyTrendItem,
  type AnomaliesResponse,
  type EmployeeMatch,
} from "@/lib/api";
import RuleCountChart, { ruleLabel } from "./RuleCountChart";
import OrgFilter from "./OrgFilter";
import EmployeePicker from "./EmployeePicker";
import RulesMetaModal from "./RulesMetaModal";
import MonthlyTrendChart from "./MonthlyTrendChart";

function StatTile({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="rounded-2xl p-5 text-left w-full"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="text-xs mb-2 flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
        {label}
        {onClick && <span style={{ color: "var(--accent)" }}>↗</span>}
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
    </Comp>
  );
}

const PAGE_SIZE = 30;

export default function AnomaliesView() {
  const [division, setDivision] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeMatch | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeRule, setActiveRule] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [trend, setTrend] = useState<AnomalyTrendItem[] | null>(null);

  useEffect(() => {
    fetchMonths().then(setMonths);
  }, []);

  // 조회 중인 월의 연도를 기준으로 그 해 월별 추이를 가져온다.
  useEffect(() => {
    const year = (month ?? months[months.length - 1] ?? "").slice(0, 4);
    if (!year) return;
    fetchAnomaliesTrend(year).then(setTrend);
  }, [month, months]);

  useEffect(() => {
    setData(null);
    setError(null);
    fetchAnomalies({
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
        if (activeRule && item.rule_code !== activeRule) return false;
        if (search) {
          const q = search.trim();
          if (!item.사번.includes(q) && !item.성명.includes(q) && !item.부서명.includes(q)) {
            return false;
          }
        }
        return true;
      })
      // 심각도(발생 횟수) 높은 순 — "상위 N건"이 실제로 가장 눈여겨봐야 할 케이스가 되도록.
      .sort((a, b) => b.occurrence_count - a.occurrence_count);
  }, [data, activeRule, search]);

  // 필터가 바뀌면 다시 요약(상위 30건)부터 보여준다.
  useEffect(() => {
    setShowAll(false);
  }, [activeRule, search, month, division, department, employee?.사번]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const hasMore = filtered.length > PAGE_SIZE;

  const breadcrumb = [division, department, employee?.성명].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {months.length > 1 && (
            <select
              value={month ?? ""}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
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

      {trend && (
        <MonthlyTrendChart
          title={`${(month ?? "").slice(0, 4)}년 월별 특이건 추이`}
          points={trend.map((t) => ({ label: `${Number(t.month.slice(5, 7))}월`, value: t.total }))}
          emptyHint="이번 해에 업로드된 데이터가 아직 없습니다."
        />
      )}

      {error && (
        <div className="text-sm p-4 rounded-xl" style={{ color: "var(--danger)", background: "#dc262612" }}>
          {error}
        </div>
      )}

      {!error && !data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl"
              style={{ background: "var(--surface)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }}
            />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile label={`총 특이건 (${data.month ?? "-"})`} value={data.total.toLocaleString()} />
            <StatTile label="특이 인원(중복 제외)" value={data.affected_employees.toLocaleString()} />
            <StatTile
              label="탐지 규칙 수"
              value={String(Object.keys(data.by_rule).length || 7)}
              onClick={() => setShowRulesModal(true)}
            />
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
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
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
                {showAll || !hasMore
                  ? `${filtered.length.toLocaleString()}건`
                  : `상위 ${PAGE_SIZE}건 표시 중 · 전체 ${filtered.length.toLocaleString()}건`}
              </div>
            </div>

            <div className={showAll ? "overflow-x-auto max-h-[560px] overflow-y-auto" : "overflow-x-auto"}>
              <table className="w-full text-sm">
                <thead className={showAll ? "sticky top-0" : ""} style={{ background: "var(--surface)" }}>
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
                  {visible.map((item, i) => (
                    <tr
                      key={`${item.사번}-${item.rule_code}-${i}`}
                      style={{ borderTop: "1px solid var(--border)" }}
                      className="hover:bg-[var(--bg-elevated)]"
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

            {hasMore && (
              <div className="p-4 text-center" style={{ borderTop: "1px solid var(--border)" }}>
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-sm font-medium px-4 py-2 rounded-lg"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  {showAll ? "상위 30건만 보기" : `전체 ${filtered.length.toLocaleString()}건 보기`}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showRulesModal && <RulesMetaModal onClose={() => setShowRulesModal(false)} />}
    </div>
  );
}
