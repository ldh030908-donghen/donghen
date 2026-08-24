"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchHoursSummary,
  fetchHoursTopPeople,
  fetchHoursTrend,
  fetchMonths,
  fetchPeriods,
  type EmployeeMatch,
  type GroupLevel,
  type HoursSummaryItem,
  type HoursTopPerson,
  type HoursTrendItem,
  type Metric,
  type PeriodKind,
} from "@/lib/api";
import OrgFilter from "./OrgFilter";
import EmployeePicker from "./EmployeePicker";
import MonthlyTrendChart from "./MonthlyTrendChart";
import PeriodSelect, { PERIOD_ALL, periodFullLabel } from "./PeriodSelect";
import TopPeopleBanner, { type BannerItem } from "./TopPeopleBanner";
import WorkGroupSelect from "./WorkGroupSelect";
import { formatHoursMinutes } from "@/lib/hours";

const CLOCK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PERIOD_OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: "week", label: "주" },
  { value: "month", label: "월" },
  { value: "quarter", label: "분기" },
  { value: "half", label: "반기" },
  { value: "year", label: "연" },
];

const METRIC_OPTIONS: { value: Metric; label: string; tooltip?: string }[] = [
  { value: "worktime", label: "실근로시간" },
  { value: "stay", label: "체류시간", tooltip: "출문시간 - 입문시간 (사업장에 머문 총 시간, 휴게시간 등 제외 전 원시값)" },
];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; tooltip?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex p-1 rounded-lg gap-1"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <div key={opt.value} className="relative group">
            <button
              onClick={() => onChange(opt.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--text-muted)",
              }}
            >
              {opt.label}
              {opt.tooltip && (
                <span
                  className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{
                    background: active ? "rgba(255,255,255,0.25)" : "var(--bg)",
                    color: active ? "#fff" : "var(--text-faint)",
                  }}
                >
                  ?
                </span>
              )}
            </button>
            {opt.tooltip && (
              <div
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:block z-20 px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed whitespace-nowrap pointer-events-none"
                style={{ background: "var(--text)", color: "var(--bg)", boxShadow: "var(--shadow-md)" }}
              >
                {opt.tooltip}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="p-4 flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-lg"
          style={{ background: "var(--bg-elevated)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }}
        />
      ))}
    </div>
  );
}

const GROUP_COL_LABELS: Record<GroupLevel, string[]> = {
  division: ["사업부"],
  department: ["사업부", "부서명"],
  employee: ["사업부", "부서명", "사번", "성명", "직급"],
};

export default function HoursSummaryView() {
  const [division, setDivision] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [workGroup, setWorkGroup] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeMatch | null>(null);
  const [periodKind, setPeriodKind] = useState<PeriodKind>("month");
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);
  const [periodValue, setPeriodValue] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("worktime");
  const [items, setItems] = useState<HoursSummaryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<HoursTrendItem[] | null>(null);
  const [topPeople, setTopPeople] = useState<HoursTopPerson[] | null>(null);

  // 드릴다운 깊이에 따라 자동으로 집계 단위를 정한다: 개인 선택 > 부서 선택 > 사업부 선택 > 전체
  const groupLevel: GroupLevel = employee ? "employee" : department ? "employee" : division ? "department" : "division";
  const effectiveDivision = employee ? employee.사업부 : division ?? undefined;
  const effectiveDepartment = employee ? employee.부서명 : department ?? undefined;

  // 기간 단위(주/월/분기/반기/연)를 바꾸면 그 단위로 실제 존재하는 조회 시점 목록을 다시 받아와서
  // 최신 시점으로 기본 선택한다 — "26년 3월 기준"처럼 특정 시점을 콕 집어 조회하기 위함.
  // 사용자가 "전체 기간"을 선택해둔 상태라면(연도별/월별 전체 비교) 기간 단위를 바꿔도 그 선택을 유지한다.
  useEffect(() => {
    let cancelled = false;
    fetchPeriods(periodKind).then((periods) => {
      if (cancelled) return;
      setPeriodOptions(periods);
      setPeriodValue((prev) => {
        if (prev === PERIOD_ALL) return prev;
        if (prev && periods.includes(prev)) return prev;
        return periods[periods.length - 1] ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [periodKind]);

  // 전사 월별 추이 그래프도 지금 선택된 사업부/부서/근무제 범위(하위 트리)로 좁혀서 보여준다.
  useEffect(() => {
    fetchMonths().then((months) => {
      const year = months[months.length - 1]?.slice(0, 4);
      if (!year) return;
      fetchHoursTrend({ year, metric, division: effectiveDivision, department: effectiveDepartment, workGroup: workGroup ?? undefined }).then(
        setTrend
      );
    });
  }, [metric, effectiveDivision, effectiveDepartment, workGroup]);

  // 가장 최근 데이터 기준 근무시간 과다자 상위 5명 — 사업부/부서/근무제 필터를 선택하면 그 범위로 좁혀진다.
  useEffect(() => {
    fetchHoursTopPeople({
      metric,
      division: effectiveDivision,
      department: effectiveDepartment,
      workGroup: workGroup ?? undefined,
      limit: 5,
    })
      .then((res) => setTopPeople(res.items))
      .catch(() => setTopPeople(null));
  }, [metric, effectiveDivision, effectiveDepartment, workGroup]);

  const isAllPeriods = periodValue === PERIOD_ALL;

  useEffect(() => {
    if (!periodValue) return;
    let cancelled = false;
    setItems(null);
    setError(null);
    fetchHoursSummary({
      groupLevel,
      periodKind,
      periodValue: isAllPeriods ? undefined : periodValue,
      metric,
      division: effectiveDivision ?? undefined,
      department: effectiveDepartment ?? undefined,
      workGroup: workGroup ?? undefined,
    })
      .then((res) => {
        if (cancelled) return;
        const rows = employee ? res.items.filter((r) => r.사번 === employee.사번) : res.items;
        setItems(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupLevel, periodKind, periodValue, isAllPeriods, metric, effectiveDivision, effectiveDepartment, workGroup, employee?.사번]);

  // 조회 시점이 하나로 고정되면 근무시간이 많은 순으로 바로 랭킹처럼 보여주고,
  // "전체 기간"이면 기존처럼 최신 기간 먼저 + 기간 내에서는 근무시간 순으로 보여준다.
  const sorted = useMemo(() => {
    if (!items) return null;
    if (isAllPeriods) {
      return [...items].sort(
        (a, b) => b.period.localeCompare(a.period) || b.avg_hours_per_employee_per_month - a.avg_hours_per_employee_per_month
      );
    }
    return [...items].sort((a, b) => b.avg_hours_per_employee_per_month - a.avg_hours_per_employee_per_month);
  }, [items, isAllPeriods]);
  const capped = sorted?.slice(0, 500) ?? null;

  const breadcrumb = [division, department, employee?.성명].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <TopPeopleBanner
        heading="근무시간 과다자 TOP 5"
        subheading="최신 데이터 기준"
        icon={CLOCK_ICON}
        tone="accent"
        items={
          topPeople?.map(
            (p): BannerItem => ({
              name: p.성명,
              dept: p.부서명,
              division: p.사업부,
              rankTitle: p.직급,
              metricLabel: formatHoursMinutes(p.avg_hours_per_employee_per_month),
              metricSub: `누적 ${formatHoursMinutes(p.total_hours)}`,
            })
          ) ?? null
        }
      />

      {trend && (
        <MonthlyTrendChart
          title={`${trend[0]?.month.slice(0, 4) ?? ""}년 ${effectiveDepartment ?? effectiveDivision ?? "전사"} 월별 1인당 평균 ${metric === "worktime" ? "실근로시간" : "체류시간"} 추이`}
          points={trend.map((t) => ({
            label: `${Number(t.month.slice(5, 7))}월`,
            value: t.avg_hours_per_employee_per_month,
          }))}
          valueFormatter={formatHoursMinutes}
          emptyHint="이번 해에 업로드된 데이터가 아직 없습니다."
        />
      )}

      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
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
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            ·
          </span>
          <WorkGroupSelect value={workGroup} onChange={setWorkGroup} />
        </div>

        {(breadcrumb.length > 0 || workGroup) && (
          <div className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: "var(--accent-strong)" }}>
            <span style={{ color: "var(--text-faint)" }}>조회 범위:</span>
            전체
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span style={{ color: "var(--text-faint)" }}>→</span>
                {b}
              </span>
            ))}
            {workGroup && (
              <span className="flex items-center gap-1.5">
                <span style={{ color: "var(--text-faint)" }}>·근무제</span>
                {workGroup}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 pt-3">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              기간 단위
            </span>
            <SegmentedControl options={PERIOD_OPTIONS} value={periodKind} onChange={setPeriodKind} />
          </div>
          <div className="flex items-center gap-3 pt-3">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              조회 시점
            </span>
            <PeriodSelect
              periods={periodOptions}
              periodKind={periodKind}
              value={periodValue}
              onChange={setPeriodValue}
              label="조회 시점"
              allowAllLabel="전체 기간 (연도별·월별 비교)"
            />
          </div>
          <div className="flex items-center gap-3 pt-3">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              지표
            </span>
            <SegmentedControl options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
          </div>
        </div>
      </div>

      <div
        className="px-4 py-3 rounded-lg text-xs flex items-center justify-between flex-wrap gap-2"
        style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
      >
        <span>
          “평균”은 해당 기간 동안 인원 1인당 누적 근로시간을, 실제 데이터가 존재하는 개월 수로
          나눈 <strong>1인당 월평균 근로시간</strong> 기준입니다.
        </span>
        {periodValue && !isAllPeriods && (
          <span className="font-semibold whitespace-nowrap">{periodFullLabel(periodValue, periodKind)} 기준</span>
        )}
        {isAllPeriods && <span className="font-semibold whitespace-nowrap">전체 기간 비교</span>}
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        {error && (
          <div className="p-6 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}
        {!error && !capped && <SkeletonRows />}
        {!error && capped && (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
                <tr style={{ color: "var(--text-faint)" }} className="text-xs">
                  {GROUP_COL_LABELS[groupLevel].map((col) => (
                    <th key={col} className="text-left font-medium px-4 py-3 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  {isAllPeriods && <th className="text-left font-medium px-4 py-3 whitespace-nowrap">기간</th>}
                  <th className="text-right font-medium px-4 py-3 whitespace-nowrap">인원수</th>
                  <th className="text-right font-medium px-4 py-3 whitespace-nowrap">1인당 월평균</th>
                  <th className="text-right font-medium px-4 py-3 whitespace-nowrap">기간 합계</th>
                </tr>
              </thead>
              <tbody>
                {capped.map((row, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }} className="hover:bg-[var(--bg-elevated)]">
                    {GROUP_COL_LABELS[groupLevel].map((col) => (
                      <td key={col} className="px-4 py-3">
                        {(row as unknown as Record<string, string>)[col]}
                      </td>
                    ))}
                    {isAllPeriods && (
                      <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                        {periodFullLabel(row.period, periodKind)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.employee_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatHoursMinutes(row.avg_hours_per_employee_per_month)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}
                    >
                      {formatHoursMinutes(row.total_hours)}
                    </td>
                  </tr>
                ))}
                {capped.length === 0 && (
                  <tr>
                    <td
                      colSpan={GROUP_COL_LABELS[groupLevel].length + (isAllPeriods ? 4 : 3)}
                      className="text-center py-10 text-sm"
                      style={{ color: "var(--text-faint)" }}
                    >
                      데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {sorted && sorted.length > 500 && (
              <div className="px-4 py-3 text-xs text-center" style={{ color: "var(--text-faint)" }}>
                상위 500건만 표시 중 (전체 {sorted.length.toLocaleString()}건)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
