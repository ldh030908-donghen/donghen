"use client";

export default function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center text-center py-24 px-6"
      style={{ background: "var(--surface)", border: "1px dashed var(--border-strong)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "linear-gradient(135deg, var(--accent-100) 0%, var(--accent-soft) 100%)" }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="1.6">
          <path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="font-semibold mb-1.5" style={{ fontSize: 15 }}>
        아직 업로드된 근태 데이터가 없습니다
      </p>
      <p className="text-sm mb-6" style={{ color: "var(--text-faint)" }}>
        월별 근태 raw data를 업로드하면 특이건 탐지와 근무시간 현황을 바로 확인할 수 있습니다.
      </p>
      <button
        onClick={onUploadClick}
        className="px-5 py-2.5 rounded-lg text-sm font-medium transition-transform hover:-translate-y-px"
        style={{ background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-glow)" }}
      >
        + 월별 데이터 업로드
      </button>
    </div>
  );
}
