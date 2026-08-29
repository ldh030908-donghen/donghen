"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAnomalies,
  fetchAnomaliesTopPeople,
  fetchAnomaliesTrend,
  fetchCandidates,
  fetchEmployeeTimeline,
  fetchHoursTopPeople,
  fetchMonths,
  type AnomaliesResponse,
  type AnomalyTopPerson,
  type AnomalyTrendItem,
  type CaseStatus,
  type EmployeeTimeline,
  type HoursTopPerson,
  type RosterItem,
} from "@/lib/api";
import { formatHoursMinutes } from "@/lib/hours";
import { ICONS, StatTile } from "./AnomaliesView";
import AnomalyDetailCell from "./AnomalyDetailCell";
import CaseStatusToggle from "./CaseStatusToggle";
import DivisionBarChart, { type BarSlice } from "./DivisionBarChart";
import DonutChart from "./DonutChart";
import EmployeeRosterTable from "./EmployeeRosterTable";
import HeatmapChart, { type HeatmapCell } from "./HeatmapChart";
import Modal from "./Modal";
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
  const [personModal, setPersonModal] = useState<{ item: RosterItem; timeline: EmployeeTimeline | null; error?: string } | null>(null);

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

  const heatmap = useMemo(() => {
    if (!data) return { rowKeys: [] as string[], colKeys: [] as string[], cells: [] as HeatmapCell[] };
    const deptTotals = new Map<string, number>();
    const cellCounts = new Map<string, number>();
    const rules = new Set<string>();
    for (const item of data.items) {
      deptTotals.set(item.부서명, (deptTotals.get(item.부서명) ?? 0) + 1);
      const key = `${item.부서명}::${item.rule_code}`;
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
      rules.add(item.rule_code);
    }
    const rowKeys = Array.from(deptTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);
    const colKeys = Array.from(rules).sort();
    const cells: HeatmapCell[] = [];
    for (const row of rowKeys) {
      for (const col of colKeys) {
        const v = cellCounts.get(`${row}::${col}`) ?? 0;
        if (v > 0) cells.push({ rowKey: row, colKey: col, value: v });
      }
    }
    return { rowKeys, colKeys, cells };
  }, [data]);

  function openPersonModal(item: RosterItem) {
    setPersonModal({ item, timeline: null });
    fetchEmployeeTimeline(item.사번)
      .then((res) => setPersonModal({ item, timeline: res }))
      .catch((e) => setPersonModal({ item, timeline: null, error: e instanceof Error ? e.message : "조회 실패" }));
  }

  function handleStatusChange(empId: string, ruleCode: string, itemMonth: string, next: CaseStatus | null) {
    setPersonModal((prev) =>
      prev && prev.timeline
        ? {
            ...prev,
            timeline: {
              ...prev.timeline,
              items: prev.timeline.items.map((it) =>
                it.사번 === empId && it.rule_code === ruleCode && it.month === itemMonth ? { ...it, status: next ?? "" } : it
              ),
            },
          }
        : prev
    );
  }

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DivisionBarChart title={`사업부별 특이건 수 (${data?.month ?? "-"})`} slices={divisionSlices} />
        <HeatmapChart title={`부서 x 규칙 히트맵 · 상위 8개 부서 (${data?.month ?? "-"})`} {...heatmap} />
      </div>

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

      <EmployeeRosterTable month={month} onSelectEmployee={openPersonModal} />

      {personModal && (
        <Modal onClose={() => setPersonModal(null)} maxWidth={720}>
          <div className="p-6 flex flex-col gap-4" style={{ maxHeight: "80vh" }}>
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-semibold">
                  {personModal.item.성명}
                  <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-faint)" }}>
                    {personModal.item.직급} · {personModal.item.사업부} · {personModal.item.부서명}
                  </span>
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                  사번 {personModal.item.사번} · {month} 평균근로시간 {formatHoursMinutes(personModal.item.avg_hours)}
                </p>
              </div>
            </div>

            {personModal.error && (
              <div className="text-sm p-4 rounded-xl" style={{ color: "var(--danger)", background: "#dc262612" }}>
                {personModal.error}
              </div>
            )}

            {!personModal.error && !personModal.timeline && (
              <div className="flex items-center justify-center py-10">
                <span
                  className="w-5 h-5 rounded-full block"
                  style={{ border: "2px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}
                />
              </div>
            )}

            {personModal.timeline && (
              <div className="overflow-y-auto flex flex-col gap-4">
                {personModal.timeline.hours_trend.length > 0 && (
                  <MonthlyTrendChart
                    title="월별 실근로시간 추이"
                    points={personModal.timeline.hours_trend.map((t) => ({ label: `${Number(t.month.slice(5, 7))}월`, value: t.hours }))}
                    valueFormatter={formatHoursMinutes}
                    emptyHint="근무시간 데이터가 없습니다."
                  />
                )}
                {personModal.timeline.items.length === 0 ? (
                  <div className="text-sm py-6 text-center" style={{ color: "var(--text-faint)" }}>
                    이 인원의 특이건·확인대상 이력이 없습니다.
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {personModal.timeline.items.map((item, i) => (
                      <div
                        key={`${item.month}-${item.rule_code}-${i}`}
                        className="flex items-start gap-3 px-4 py-3"
                        style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                      >
                        <div className="w-14 shrink-0 text-xs font-medium pt-1" style={{ color: "var(--text-faint)" }}>
                          {item.month}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{item.source === "rule" ? ruleLabel(item.rule_code) : item.case_name}</span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                            >
                              {item.occurrence_count.toLocaleString()}회
                            </span>
                          </div>
                          <AnomalyDetailCell detail={item.detail} />
                        </div>
                        <div className="shrink-0 pt-1">
                          <CaseStatusToggle
                            empId={item.사번}
                            ruleCode={item.rule_code}
                            month={item.month}
                            status={item.status}
                            onChange={(next) => handleStatusChange(item.사번, item.rule_code, item.month, next)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
