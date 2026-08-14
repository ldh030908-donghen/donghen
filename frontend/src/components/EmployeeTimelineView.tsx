"use client";

import { useEffect, useState } from "react";
import {
  fetchEmployeeTimeline,
  type CaseStatus,
  type EmployeeMatch,
  type EmployeeTimeline,
  type EmployeeTimelineItem,
} from "@/lib/api";
import AnomalyDetailCell from "./AnomalyDetailCell";
import CaseStatusToggle from "./CaseStatusToggle";
import EmployeePicker from "./EmployeePicker";
import MonthlyTrendChart from "./MonthlyTrendChart";
import OrgFilter from "./OrgFilter";
import { ruleLabel } from "./RuleCountChart";

const SOURCE_STYLE: Record<EmployeeTimelineItem["source"], { bg: string; fg: string; label: string }> = {
  rule: { bg: "var(--status-critical-soft)", fg: "var(--status-critical)", label: "정식규칙" },
  candidate: { bg: "var(--accent-soft)", fg: "var(--accent-strong)", label: "확인대상" },
};

function caseLabel(item: EmployeeTimelineItem): string {
  return item.source === "rule" ? ruleLabel(item.rule_code) : item.case_name;
}

export default function EmployeeTimelineView() {
  const [division, setDivision] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeMatch | null>(null);
  const [data, setData] = useState<EmployeeTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employee) {
      setData(null);
      setError(null);
      return;
    }
    setData(null);
    setError(null);
    fetchEmployeeTimeline(employee.사번)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [employee]);

  function handleStatusChange(item: EmployeeTimelineItem, next: CaseStatus | null) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.사번 === item.사번 && it.rule_code === item.rule_code && it.month === item.month
                ? { ...it, status: next ?? "" }
                : it
            ),
          }
        : prev
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
        </div>
        <div className="text-xs" style={{ color: "var(--text-faint)" }}>
          사업부·부서를 참고해 사번 또는 성명으로 검색하면 해당 인원의 전체 근태 특이건·확인대상 이력을 볼 수 있습니다.
        </div>
      </div>

      {error && (
        <div className="text-sm p-4 rounded-xl" style={{ color: "var(--danger)", background: "#dc262612" }}>
          {error}
        </div>
      )}

      {!error && employee && !data && (
        <div className="h-24 rounded-2xl" style={{ background: "var(--surface)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }} />
      )}

      {!employee && (
        <div
          className="rounded-2xl p-10 text-center text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-faint)" }}
        >
          조회할 인원을 선택해주세요.
        </div>
      )}

      {data && data.profile && (
        <>
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-lg font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
            >
              {data.profile.성명.slice(0, 1)}
            </div>
            <div>
              <div className="text-base font-semibold">{data.profile.성명}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                사번 {data.profile.사번} · {data.profile.직급} · {data.profile.사업부} · {data.profile.부서명}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-6 text-right">
              <div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  누적 특이건
                </div>
                <div className="text-lg font-bold" style={{ color: "var(--status-critical)" }}>
                  {data.items.filter((i) => i.source === "rule").length.toLocaleString()}건
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  누적 확인대상
                </div>
                <div className="text-lg font-bold" style={{ color: "var(--accent-strong)" }}>
                  {data.items.filter((i) => i.source === "candidate").length.toLocaleString()}건
                </div>
              </div>
            </div>
          </div>

          <MonthlyTrendChart
            title="월별 실근로시간 추이"
            points={data.hours_trend.map((t) => ({ label: `${Number(t.month.slice(5, 7))}월`, value: t.hours }))}
            valueFormatter={(v) => `${v.toFixed(2)}h`}
            emptyHint="근무시간 데이터가 없습니다."
          />

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="px-5 py-4 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border)" }}>
              히스토리 타임라인 ({data.items.length.toLocaleString()}건)
            </div>
            {data.items.length === 0 ? (
              <div className="text-center py-10 text-sm" style={{ color: "var(--text-faint)" }}>
                이 인원의 특이건·확인대상 이력이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col">
                {data.items.map((item, i) => {
                  const src = SOURCE_STYLE[item.source];
                  return (
                    <div
                      key={`${item.month}-${item.rule_code}-${i}`}
                      className="flex items-start gap-4 px-5 py-4"
                      style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                    >
                      <div className="w-16 shrink-0 text-xs font-medium pt-1" style={{ color: "var(--text-faint)" }}>
                        {item.month}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: src.bg, color: src.fg }}
                          >
                            {src.label}
                          </span>
                          <span className="text-sm font-medium">{caseLabel(item)}</span>
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
                          onChange={(next) => handleStatusChange(item, next)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
