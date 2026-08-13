"use client";

import { useState } from "react";
import type { Overview } from "@/lib/api";
import { resetData } from "@/lib/api";
import AnomaliesView from "./AnomaliesView";
import HoursSummaryView from "./HoursSummaryView";
import EmptyState from "./EmptyState";
import Modal from "./Modal";
import UploadFlow from "./UploadFlow";

type Tab = "anomalies" | "hours";

export default function Dashboard({
  overview,
  onDataChanged,
}: {
  overview: Overview;
  onDataChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("anomalies");
  const [showUpload, setShowUpload] = useState(false);
  const [resetting, setResetting] = useState(false);
  const hasData = overview.has_data;

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
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">근태 분석 대시보드</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            {hasData
              ? `누적 ${overview.total_employee_count.toLocaleString()}명 · 최신 ${overview.latest_month} 기준 ${overview.employee_count.toLocaleString()}명 · 보유 데이터 ${overview.available_months.length}개월`
              : "업로드된 데이터 없음"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasData && (
            <div
              className="inline-flex p-1 rounded-lg gap-1"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setTab("anomalies")}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: tab === "anomalies" ? "var(--accent)" : "transparent",
                  color: tab === "anomalies" ? "#fff" : "var(--text-muted)",
                }}
              >
                근태 특이건 조회
              </button>
              <button
                onClick={() => setTab("hours")}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: tab === "hours" ? "var(--accent)" : "transparent",
                  color: tab === "hours" ? "#fff" : "var(--text-muted)",
                }}
              >
                근무시간 현황 조회
              </button>
            </div>
          )}
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            + 월별 데이터 업로드
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          {tab === "anomalies" && <AnomaliesView />}
          {tab === "hours" && <HoursSummaryView />}
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
