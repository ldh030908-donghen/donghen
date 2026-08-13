"use client";

export default function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center text-center py-24 px-6"
      style={{ background: "var(--surface)", border: "1px dashed var(--border-strong)" }}
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
        style={{ background: "var(--accent-soft)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="1.6">
          <path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="font-medium mb-1">아직 업로드된 근태 데이터가 없습니다</p>
      <p className="text-sm mb-6" style={{ color: "var(--text-faint)" }}>
        월별 근태 raw data를 업로드하면 특이건 탐지와 근무시간 현황을 바로 확인할 수 있습니다.
      </p>
      <button
        onClick={onUploadClick}
        className="px-5 py-2.5 rounded-lg text-sm font-medium"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        + 월별 데이터 업로드
      </button>
    </div>
  );
}
