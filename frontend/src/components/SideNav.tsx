"use client";

import { useEffect } from "react";
import type { Tab } from "./Dashboard";

export const SIDENAV_WIDTH = 248;

const HAMBURGER_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PIN_ICON = (filled: boolean) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type MenuItem = {
  tab: Tab;
  label: string;
  icon: React.ReactNode;
};

const HOME_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ANOMALY_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86l-8.18 14.18A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3l-8.18-14.14a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CLOCK_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CHECK_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const HISTORY_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 7v5l4 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const UPLOAD_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SETTINGS_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MENU_ITEMS: MenuItem[] = [
  { tab: "home", label: "전체 현황", icon: HOME_ICON },
  { tab: "anomalies", label: "근태 특이건 조회", icon: ANOMALY_ICON },
  { tab: "hours", label: "근무시간 현황 조회", icon: CLOCK_ICON },
  { tab: "candidates", label: "확인대상", icon: CHECK_ICON },
  { tab: "timeline", label: "개인별 히스토리", icon: HISTORY_ICON },
];

export function SideNavToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="메뉴 열기"
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
      style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      {HAMBURGER_ICON}
    </button>
  );
}

export default function SideNav({
  open,
  pinned,
  tab,
  onSelectTab,
  onClose,
  onTogglePin,
  onUploadClick,
}: {
  open: boolean;
  pinned: boolean;
  tab: Tab;
  onSelectTab: (t: Tab) => void;
  onClose: () => void;
  onTogglePin: () => void;
  onUploadClick: () => void;
}) {
  const visible = open || pinned;

  useEffect(() => {
    if (pinned) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, onClose]);

  return (
    <>
      {open && !pinned && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "#10131c66", backdropFilter: "blur(1px)" }}
          onClick={onClose}
        />
      )}
      <aside
        className="fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-200"
        style={{
          width: SIDENAV_WIDTH,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          boxShadow: pinned ? "none" : "0 20px 60px -12px rgba(16, 19, 28, 0.25)",
          transform: visible ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--accent) 0%, #4a89f5 100%)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M3 3v18h18M8 17V9m5 8V5m5 12v-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold">근태 분석</span>
          </div>
          {/* 모바일/좁은 화면에서는 고정 개념이 없으니 데스크톱(lg 이상)에서만 pin 버튼 노출 */}
          <button
            onClick={onTogglePin}
            aria-label={pinned ? "메뉴 고정 해제" : "메뉴 고정"}
            className="hidden lg:flex w-7 h-7 rounded-md items-center justify-center transition-colors"
            style={{
              background: pinned ? "var(--accent-soft)" : "transparent",
              color: pinned ? "var(--accent-strong)" : "var(--text-faint)",
            }}
            title={pinned ? "고정 해제" : "항상 펼쳐두기"}
          >
            {PIN_ICON(pinned)}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {MENU_ITEMS.map((item, i) => {
            const active = tab === item.tab;
            return (
              <button
                key={`${item.tab}-${i}`}
                onClick={() => {
                  onSelectTab(item.tab);
                  if (!pinned) onClose();
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent-strong)" : "var(--text-muted)",
                }}
              >
                <span className="shrink-0">{item.icon}</span>
                {item.label}
              </button>
            );
          })}

          <div className="my-2 h-px" style={{ background: "var(--border)" }} />

          <button
            onClick={() => {
              onUploadClick();
              if (!pinned) onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="shrink-0">{UPLOAD_ICON}</span>
            데이터 업로드
          </button>
          <button
            onClick={() => {
              onSelectTab("settings");
              if (!pinned) onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
            style={{
              background: tab === "settings" ? "var(--accent-soft)" : "transparent",
              color: tab === "settings" ? "var(--accent-strong)" : "var(--text-muted)",
            }}
          >
            <span className="shrink-0">{SETTINGS_ICON}</span>
            설정
          </button>
        </nav>
      </aside>
    </>
  );
}
