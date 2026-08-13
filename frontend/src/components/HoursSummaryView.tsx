"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchHoursSummary,
  fetchHoursTrend,
  fetchMonths,
  type EmployeeMatch,
  type GroupLevel,
  type HoursSummaryItem,
  type HoursTrendItem,
  type Metric,
  type PeriodKind,
} from "@/lib/api";
import OrgFilter from "./OrgFilter";
import EmployeePicker from "./EmployeePicker";
import MonthlyTrendChart from "./MonthlyTrendChart";

const PERIOD_OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: "week", label: "주" },
  { value: "month", label: "월" },
  { value: "quarter", label: "분기" },
  { value: "half", label: "반기" },
  { value: "year", label: "연" },
];

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "worktime", label: "실근로시간(K열)" },
  { value: "stay", label: "체류시간(N열)" },
];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
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
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--text-muted)",
            }}
          >
            {opt.label}
          </button>
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
  const [employee, setEmployee] = useState<EmployeeMatch | null>(null);
  const [periodKind, setPeriodKind] = useState<PeriodKind>("month");
  const [metric, setMetric] = useState<Metric>("worktime");
  const [items, setItems] = useState<HoursSummaryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<HoursTrendItem[] | null>(null);

  useEffect(() => {
    fetchMonths().then((months) => {
      const year = months[months.length - 1]?.slice(0, 4);
      if (!year) return;
      fetchHoursTrend(year, metric).then(setTrend);
    });
  }, [metric]);

  // 드릴다운 깊이에 따라 자동으로 집계 단위를 정한다: 개인 선택 > 부서 선택 > 사업부 선택 > 전체
  const groupLevel: GroupLevel = employee ? "employee" : department ? "employee" : division ? "department" : "division";
  const effectiveDivision = employee ? employee.사업부 : division ?? undefined;
  const effectiveDepartment = employee ? employee.부서명 : department ?? undefined;

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    fetchHoursSummary({
      groupLevel,
      periodKind,
      metric,
      division: effectiveDivision ?? undefined,
      department: effectiveDepartment ?? undefined,
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
  }, [groupLevel, periodKind, metric, effectiveDivision, effectiveDepartment, employee?.사번]);

  const sorted = useMemo(
    () =>
      items
        ? [...items].sort(
            (a, b) =>
              b.period.localeCompare(a.period) ||
              b.avg_hours_per_employee_per_month - a.avg_hours_per_employee_per_month
          )
        : null,
    [items]
  );
  const capped = sorted?.slice(0, 500) ?? null;

  const breadcrumb = [division, department, employee?.성명].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {trend && (
        <MonthlyTrendChart
          title={`${trend[0]?.month.slice(0, 4) ?? ""}년 전사 월별 1인당 평균 ${metric === "worktime" ? "실근로시간" : "체류시간"} 추이`}
          points={trend.map((t) => ({
            label: `${Number(t.month.slice(5, 7))}월`,
            value: Math.round(t.avg_hours_per_employee_per_month * 10) / 10,
          }))}
          valueFormatter={(v) => `${v}h`}
          emptyHint="이번 해에 업로드된 데이터가 아직 없습니다."
        />
      )}

      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
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

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 pt-3">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              기간 단위
            </span>
            <SegmentedControl options={PERIOD_OPTIONS} value={periodKind} onChange={setPeriodKind} />
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
        className="px-4 py-3 rounded-lg text-xs"
        style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
      >
        “평균”은 해당 기간 동안 인원 1인당 누적 근로시간을, 실제 데이터가 존재하는 개월 수로
        나눈 <strong>1인당 월평균 근로시간</strong> 기준입니다.
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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
                  <th className="text-left font-medium px-4 py-3 whitespace-nowrap">기간</th>
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
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {row.period}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.employee_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.avg_hours_per_employee_per_month.toFixed(1)}h
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}
                    >
                      {row.total_hours.toLocaleString(undefined, { maximumFractionDigits: 0 })}h
                    </td>
                  </tr>
                ))}
                {capped.length === 0 && (
                  <tr>
                    <td colSpan={GROUP_COL_LABELS[groupLevel].length + 3} className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
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
