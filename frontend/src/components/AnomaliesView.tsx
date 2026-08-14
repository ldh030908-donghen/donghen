"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAnomalies,
  fetchAnomaliesTopPeople,
  fetchAnomaliesTrend,
  fetchMonths,
  type AnomalyItem,
  type AnomalyTopPerson,
  type AnomalyTrendItem,
  type AnomaliesResponse,
  type CaseStatus,
  type EmployeeMatch,
} from "@/lib/api";
import AnomalyDetailCell from "./AnomalyDetailCell";
import RuleCountChart, { ruleLabel } from "./RuleCountChart";
import OrgFilter from "./OrgFilter";
import EmployeePicker from "./EmployeePicker";
import RulesMetaModal from "./RulesMetaModal";
import MonthlyTrendChart from "./MonthlyTrendChart";
import PeriodSelect from "./PeriodSelect";
import TopPeopleBanner, { type BannerItem } from "./TopPeopleBanner";
import CaseStatusToggle from "./CaseStatusToggle";
import { SEVERITY_STYLE, severityTier } from "@/lib/severity";

const WARNING_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3l-8.18-14.14a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function StatTile({
  label,
  value,
  icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "neutral" | "accent" | "critical";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  const iconBg = tone === "critical" ? "var(--status-critical-soft)" : tone === "accent" ? "var(--accent-soft)" : "var(--bg-elevated)";
  const iconFg = tone === "critical" ? "var(--status-critical)" : tone === "accent" ? "var(--accent)" : "var(--text-muted)";
  return (
    <Comp
      onClick={onClick}
      className="rounded-2xl p-5 text-left w-full transition-transform"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: iconBg, color: iconFg }}
        >
          {icon}
        </div>
        {onClick && (
          <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
            자세히 →
          </span>
        )}
      </div>
      <div className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>
        {label}
      </div>
      <div className="text-[28px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </Comp>
  );
}

const ICONS = {
  total: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3l-8.18-14.14a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  people: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  rules: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  top: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

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
  const [topPeople, setTopPeople] = useState<AnomalyTopPerson[] | null>(null);

  useEffect(() => {
    fetchMonths().then(setMonths);
  }, []);

  // 가장 최근 데이터 기준 근태 특이자 상위 5명 — 사업부/부서 필터를 선택하면 그 범위로 좁혀진다.
  useEffect(() => {
    fetchAnomaliesTopPeople({
      division: division ?? undefined,
      department: department ?? undefined,
      limit: 5,
    })
      .then((res) => setTopPeople(res.items))
      .catch(() => setTopPeople(null));
  }, [division, department]);

  // 조회 중인 월의 연도를 기준으로 그 해 월별 추이를 가져온다. 사업부/부서를 선택하면
  // 그 하위 트리 범위로만 집계해서, 필터를 바꾸면 그래프도 같이 좁혀지게 한다.
  useEffect(() => {
    const year = (month ?? months[months.length - 1] ?? "").slice(0, 4);
    if (!year) return;
    fetchAnomaliesTrend({
      year,
      division: division ?? undefined,
      department: department ?? undefined,
    }).then(setTrend);
  }, [month, months, division, department]);

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

  function handleStatusChange(item: AnomalyItem, next: CaseStatus | null) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.사번 === item.사번 && it.rule_code === item.rule_code ? { ...it, status: next ?? "" } : it
            ),
          }
        : prev
    );
  }
  // 심각도 배지 색은 "지금 조회 중인 전체 데이터"(필터 전) 기준으로 고정해서
  // 규칙 필터를 바꿔도 같은 건이 계속 같은 색으로 보이게 한다.
  const maxOccurrence = data ? Math.max(...data.items.map((i) => i.occurrence_count), 1) : 1;

  const breadcrumb = [division, department, employee?.성명].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
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

      <TopPeopleBanner
        heading="근태 특이자 TOP 5"
        subheading="최신 데이터 기준"
        icon={WARNING_ICON}
        tone="critical"
        items={
          topPeople?.map(
            (p): BannerItem => ({
              name: p.성명,
              dept: p.부서명,
              division: p.사업부,
              rankTitle: p.직급,
              metricLabel: `${p.total_occurrences}회`,
              metricSub: `${p.rule_count}개 규칙`,
            })
          ) ?? null
        }
      />

      {trend && (
        <MonthlyTrendChart
          title={`${(month ?? "").slice(0, 4)}년 ${department ?? division ?? "전사"} 월별 특이건 추이`}
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
            <StatTile
              label={`총 특이건 (${data.month ?? "-"})`}
              value={data.total.toLocaleString()}
              icon={ICONS.total}
              tone="critical"
            />
            <StatTile
              label="특이 인원(중복 제외)"
              value={data.affected_employees.toLocaleString()}
              icon={ICONS.people}
              tone="accent"
            />
            <StatTile
              label="탐지 규칙 수"
              value={String(Object.keys(data.by_rule).length || 7)}
              icon={ICONS.rules}
              onClick={() => setShowRulesModal(true)}
            />
            <StatTile
              label="가장 많은 유형"
              value={
                Object.entries(data.by_rule).sort((a, b) => b[1] - a[1])[0]
                  ? ruleLabel(Object.entries(data.by_rule).sort((a, b) => b[1] - a[1])[0][0])
                  : "-"
              }
              icon={ICONS.top}
            />
          </div>

          <RuleCountChart byRule={data.by_rule} activeRule={activeRule} onSelect={setActiveRule} />

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
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

            {/* 심각도 범례 — 왼쪽 색상 띠와 발생 배지가 무엇을 뜻하는지 */}
            <div
              className="flex items-center gap-4 px-4 py-2 text-[11px]"
              style={{ background: "var(--bg)", color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}
            >
              <span>발생 횟수 기준 심각도:</span>
              {(["critical", "serious", "info"] as const).map((tier) => (
                <span key={tier} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_STYLE[tier].fg }} />
                  {SEVERITY_STYLE[tier].label}
                </span>
              ))}
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
                    <th className="text-right font-medium px-4 py-3 whitespace-nowrap">발생</th>
                    <th className="text-left font-medium px-4 py-3 whitespace-nowrap">상세</th>
                    <th className="text-left font-medium px-4 py-3 whitespace-nowrap">처리 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item, i) => {
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
                      <td className="px-4 py-3">
                        <CaseStatusToggle
                          empId={item.사번}
                          ruleCode={item.rule_code}
                          month={data.month ?? month ?? ""}
                          status={item.status}
                          onChange={(next) => handleStatusChange(item, next)}
                        />
                      </td>
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
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
