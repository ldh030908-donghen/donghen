"use client";

import { useEffect, useState } from "react";
import { fetchAnomalies, type AnomaliesResponse, type UploadResponse } from "@/lib/api";
import AnomaliesView from "./AnomaliesView";
import HoursSummaryView from "./HoursSummaryView";

type Tab = "anomalies" | "hours";

export default function Dashboard({ upload }: { upload: UploadResponse }) {
  const [tab, setTab] = useState<Tab>("anomalies");
  const [anomalies, setAnomalies] = useState<AnomaliesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnomalies(upload.session_id)
      .then(setAnomalies)
      .catch((e) => setError(e.message));
  }, [upload.session_id]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">근태 분석 대시보드</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            총 {upload.row_count.toLocaleString()}행 · {upload.employee_count.toLocaleString()}명
          </p>
        </div>
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
      </div>

      {tab === "anomalies" &&
        (error ? (
          <div className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        ) : anomalies ? (
          <AnomaliesView data={anomalies} />
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-2xl"
                style={{ background: "var(--surface)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }}
              />
            ))}
          </div>
        ))}

      {tab === "hours" && <HoursSummaryView sessionId={upload.session_id} />}
    </div>
  );
}
