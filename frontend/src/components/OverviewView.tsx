"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAnomalies,
  fetchAnomaliesTopPeople,
  fetchAnomaliesTrend,
  fetchCandidates,
  fetchHoursTopPeople,
  fetchMonths,
  type AnomaliesResponse,
  type AnomalyTopPerson,
  type AnomalyTrendItem,
  type HoursTopPerson,
} from "@/lib/api";
import { formatHoursMinutes } from "@/lib/hours";
import { ICONS, StatTile } from "./AnomaliesView";
import DivisionBarChart, { type BarSlice } from "./DivisionBarChart";
import DonutChart from "./DonutChart";
import MonthlyTrendChart from "./MonthlyTrendChart";
import { ruleColor, ruleLabel } from "./RuleCountChart";
import RuleSummaryGrid from "./RuleSummaryGrid";
import TopPeopleBanner, { type BannerItem } from "./TopPeopleBanner";

const CLOCK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CHECKLIST_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const WARNING_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3l-8.18-14.14a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 전체 현황 홈 화면 — 경영진이 한눈에 훑어볼 수 있는 요약만 담는다. 인원 명단처럼 세부 내역이
 * 필요하면 "근태 특이건 조회"/"근무시간 현황 조회" 탭에서 조회하게 한다(그 탭들이 이미 그 역할을 함). */
export default function OverviewView({
  totalEmployeeCount,
  onNavigateToRule,
}: {
  totalEmployeeCount: number;
  onNavigateToRule: (ruleCode: string) => void;
}) {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [trend, setTrend] = useState<AnomalyTrendItem[] | null>(null);
  const [candidateTotal, setCandidateTotal] = useState<number | null>(null);
  const [topAnomalyPeople, setTopAnomalyPeople] = useState<AnomalyTopPerson[] | null>(null);
  const [topHoursPeople, setTopHoursPeople] = useState<HoursTopPerson[] | null>(null);

  useEffect(() => {
    fetchMonths().then((ms) => {
      setMonths(ms);
      setMonth(ms[ms.length - 1] ?? null);
    });
  }, []);

  useEffect(() => {
    if (!month) return;
    fetchAnomalies({ month }).then(setData);
    fetchAnomaliesTrend({ year: month.slice(0, 4) }).then(setTrend);
    fetchCandidates({ month }).then((res) => setCandidateTotal(res.total));
    fetchAnomaliesTopPeople({ limit: 5 }).then((res) => setTopAnomalyPeople(res.items));
    fetchHoursTopPeople({ limit: 5 }).then((res) => setTopHoursPeople(res.items));
  }, [month]);

  const divisionSlices: BarSlice[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const item of data.items) counts.set(item.사업부, (counts.get(item.사업부) ?? 0) + 1);
    return Array.from(counts.entries()).map(([key, value]) => ({ key, label: key, value }));
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      {months.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            조회 월
          </span>
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
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatTile label="전체 인원" value={totalEmployeeCount.toLocaleString()} icon={ICONS.people} />
        <StatTile
          label={`총 특이건 (${data?.month ?? "-"})`}
          value={(data?.total ?? 0).toLocaleString()}
          icon={ICONS.total}
          tone="critical"
          emphasize
        />
        <StatTile label="특이 인원(중복 제외)" value={(data?.affected_employees ?? 0).toLocaleString()} icon={ICONS.people} tone="accent" emphasize />
        <StatTile label="확인대상" value={(candidateTotal ?? 0).toLocaleString()} icon={CHECKLIST_ICON} />
        <StatTile label="탐지 규칙 수" value="7" icon={ICONS.rules} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>
            규칙별 특이건 비중 ({data?.month ?? "-"})
          </div>
          {data ? (
            <DonutChart
              slices={Object.entries(data.by_rule).map(([code, value], i) => ({
                key: code,
                label: ruleLabel(code),
                value,
                color: ruleColor(code, i),
              }))}
              centerLabel="특이건"
              emptyHint="이 달엔 특이건이 없습니다."
            />
          ) : (
            <div className="h-40" />
          )}
        </div>

        {trend && (
          <MonthlyTrendChart
            title={`${month?.slice(0, 4) ?? ""}년 월별 특이건 추이`}
            points={trend.map((t) => ({ label: `${Number(t.month.slice(5, 7))}월`, value: t.total, key: t.month }))}
            emptyHint="이번 해에 업로드된 데이터가 아직 없습니다."
          />
        )}
      </div>

      <DivisionBarChart title={`사업부별 특이건 수 (${data?.month ?? "-"})`} slices={divisionSlices} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopPeopleBanner
          heading="근태 특이자 TOP 5"
          subheading="최신 데이터 기준"
          icon={WARNING_ICON}
          tone="critical"
          items={
            topAnomalyPeople?.map(
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
        <TopPeopleBanner
          heading="근무시간 과다자 TOP 5"
          subheading="최신 데이터 기준"
          icon={CLOCK_ICON}
          tone="accent"
          items={
            topHoursPeople?.map(
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
      </div>

      <RuleSummaryGrid byRule={data?.by_rule ?? {}} onSelectRule={onNavigateToRule} />
    </div>
  );
}
