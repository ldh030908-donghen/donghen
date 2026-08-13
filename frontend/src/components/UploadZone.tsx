"use client";

import { useCallback, useRef, useState } from "react";

export default function UploadZone({
  onFileSelected,
  error,
  uploading,
}: {
  onFileSelected: (file: File) => void;
  error: string | null;
  uploading: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected, uploading]
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5"
          style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-strong)" }} />
          근태 특이건 분석 Agent
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          근태 raw data를 업로드하세요
        </h1>
        <p style={{ color: "var(--text-muted)" }} className="text-sm leading-relaxed">
          출입문 로그 기반 근태 데이터를 분석해 이상 패턴을 자동으로 탐지하고,
          <br />
          사업부 → 부서 → 개인 단위로 드릴다운해서 확인할 수 있습니다.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        aria-busy={uploading}
        className="relative rounded-2xl p-16 text-center transition-all duration-200"
        style={{
          background: "var(--surface)",
          border: `1.5px dashed ${dragActive ? "var(--accent)" : "var(--border-strong)"}`,
          boxShadow: dragActive ? "0 0 0 4px var(--accent-soft)" : "none",
          cursor: uploading ? "default" : "pointer",
          opacity: uploading ? 0.85 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
          }}
        />
        {uploading ? (
          <>
            <div
              className="mx-auto mb-5 w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-soft)" }}
            >
              <span
                className="block w-5 h-5 rounded-full"
                style={{
                  border: "2px solid var(--accent-strong)",
                  borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            </div>
            <p className="font-medium mb-1">파일을 읽는 중입니다…</p>
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              대용량 파일은 수십 초 정도 걸릴 수 있어요. 창을 닫지 말고 기다려주세요.
            </p>
          </>
        ) : (
          <>
            <div
              className="mx-auto mb-5 w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-soft)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="1.6">
                <path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-medium mb-1">파일을 드래그하거나 클릭해서 업로드</p>
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              .xlsx / .xls · RAW 시트 형식
            </p>
          </>
        )}
      </div>

      {error && (
        <div
          className="mt-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: "#f2555a15", color: "var(--danger)", border: "1px solid #f2555a33" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
