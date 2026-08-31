"use client";

import { useState } from "react";
import type { Overview } from "@/lib/api";
import { resetData } from "@/lib/api";
import AnomaliesView from "./AnomaliesView";
import CandidatesView from "./CandidatesView";
import EmployeeTimelineView from "./EmployeeTimelineView";
import HoursSummaryView from "./HoursSummaryView";
import OverviewView from "./OverviewView";
import EmptyState from "./EmptyState";
import Modal from "./Modal";
import UploadFlow from "./UploadFlow";
import { SideNavToggle } from "./SideNav";

export type Tab = "home" | "anomalies" | "hours" | "candidates" | "timeline" | "settings";

export default function Dashboard({
  overview,
  onDataChanged,
  tab,
  onSelectTab,
  showUpload,
  onShowUploadChange,
  onOpenNav,
}: {
  overview: Overview;
  onDataChanged: () => void;
  tab: Tab;
  onSelectTab: (t: Tab) => void;
  showUpload: boolean;
  onShowUploadChange: (v: boolean) => void;
  onOpenNav: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [ruleFilter, setRuleFilter] = useState<{ rule: string; token: number } | null>(null);
  const hasData = overview.has_data;
  const setShowUpload = onShowUploadChange;

  function handleNavigateToRule(ruleCode: string) {
    setRuleFilter((prev) => ({ rule: ruleCode, token: (prev?.token ?? 0) + 1 }));
    onSelectTab("anomalies");
  }

  async function handleReset() {
    if (!window.confirm("업로드된 근태 데이터를 전부 삭제할까요? 되돌릴 수 없습니다.")) return;
    setResetting(true);
    try {
      await resetData();
      setShowUpload(false);
      onDataChanged();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <SideNavToggle onClick={onOpenNav} />
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, #4a89f5 100%)", boxShadow: "var(--shadow-glow)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M3 3v18h18M8 17V9m5 8V5m5 12v-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold tracking-tight leading-tight">근태 분석 대시보드</h1>
        </div>
      </div>

      {hasData && (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ color: "var(--accent)" }}>{TAB_META[tab].icon}</span>
            <h2 className="text-lg font-semibold tracking-tight">{TAB_META[tab].label}</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>
            {TAB_META[tab].description}
          </p>
          <div className="flex items-center gap-2 flex-wrap mb-8">
            <SummaryChip icon={PEOPLE_CHIP_ICON} text={`누적 ${overview.total_employee_count.toLocaleString()}명`} />
            <SummaryChip icon={CALENDAR_CHIP_ICON} text={`최신 ${overview.latest_month} 기준 ${overview.employee_count.toLocaleString()}명`} />
            <SummaryChip icon={DB_CHIP_ICON} text={`보유 데이터 ${overview.available_months.length}개월`} />
          </div>
        </>
      )}

      {hasData ? (
        <>
          {tab === "home" && (
            <OverviewView totalEmployeeCount={overview.total_employee_count} onNavigateToRule={handleNavigateToRule} />
          )}
          {tab === "anomalies" && <AnomaliesView key={ruleFilter?.token ?? 0} initialRuleFilter={ruleFilter?.rule ?? null} />}
          {tab === "hours" && <HoursSummaryView />}
          {tab === "candidates" && <CandidatesView />}
          {tab === "timeline" && <EmployeeTimelineView />}
          {tab === "settings" && <SettingsPlaceholder />}
        </>
      ) : (
        <EmptyState onUploadClick={() => setShowUpload(true)} />
      )}

      {showUpload && (
        <Modal onClose={() => setShowUpload(false)} maxWidth={720}>
          <div className="p-8">
            <UploadFlow
              onDone={() => {
                setShowUpload(false);
                onDataChanged();
              }}
            />
            {hasData && (
              <div className="mt-6 pt-5 text-center" style={{ borderTop: "1px solid var(--border)" }}>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="text-xs"
                  style={{ color: "var(--text-faint)" }}
                >
                  {resetting ? "초기화 중..." : "업로드된 데이터 전체 초기화"}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

const TAB_META: Record<Tab, { label: string; description: string; icon: React.ReactNode }> = {
  home: {
    label: "전체 현황",
    description: "전사 KPI와 핵심 시각화를 한눈에 확인합니다. 인원별 세부 내역은 근태 특이건 조회·근무시간 현황 조회 탭에서 확인하세요.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  anomalies: {
    label: "근태 특이건 조회",
    description: "출입문 로그 기반 근태 이상 패턴을 사업부 → 부서 → 개인 단위로 조회합니다.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3l-8.18-14.14a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  hours: {
    label: "근무시간 현황 조회",
    description: "기간·조직 단위로 실근로시간/체류시간 현황을 조회합니다.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  candidates: {
    label: "확인대상",
    description: "특이건으로 확정되기 전, 사람이 한 번 더 확인해봐야 할 후보 케이스입니다.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  timeline: {
    label: "개인별 히스토리",
    description: "특정 인원을 선택해 월별 근태 특이건/근무시간 이력을 확인합니다.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 7v5l4 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  settings: {
    label: "설정",
    description: "조직도 매핑, 규칙 임계값 등 대시보드 설정입니다.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

const PEOPLE_CHIP_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CALENDAR_CHIP_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DB_CHIP_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function SummaryChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      {text}
    </span>
  );
}

function SettingsPlaceholder() {
  return (
    <div
      className="rounded-2xl p-10 text-center flex flex-col items-center gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--bg-elevated)", color: "var(--text-faint)" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-sm font-medium">설정 기능은 아직 준비 중입니다</div>
      <p className="text-xs max-w-sm" style={{ color: "var(--text-faint)" }}>
        조직도(사업부 매핑) 업로드, 규칙 임계값 조정 같은 설정 기능이 추후 이 화면에 추가될 예정입니다.
      </p>
    </div>
  );
}
