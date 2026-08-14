"use client";

import { updateCaseStatus, type CaseStatus } from "@/lib/api";

const OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: "checked", label: "확인" },
  { value: "resolved", label: "조치" },
  { value: "false_positive", label: "오탐" },
];

const ACTIVE_STYLE: Record<CaseStatus, { bg: string; fg: string }> = {
  checked: { bg: "var(--accent-soft)", fg: "var(--accent-strong)" },
  resolved: { bg: "#16a34a1a", fg: "#16a34a" },
  false_positive: { bg: "#71717a1a", fg: "#71717a" },
};

// 확인/조치/오탐은 상호배타적인 3-state 토글이다. 같은 값을 다시 누르면 미확인으로 되돌아간다.
// 서버 반영이 실패하면 부모가 들고 있는 상태를 이전 값으로 되돌린다(낙관적 업데이트 롤백).
export default function CaseStatusToggle({
  empId,
  ruleCode,
  month,
  status,
  onChange,
}: {
  empId: string;
  ruleCode: string;
  month: string;
  status: CaseStatus | "" | undefined;
  onChange: (status: CaseStatus | null) => void;
}) {
  const current: CaseStatus | null = status || null;

  async function handleClick(value: CaseStatus) {
    const previous = current;
    const next = previous === value ? null : value;
    onChange(next);
    try {
      await updateCaseStatus({ empId, ruleCode, month, status: next });
    } catch {
      onChange(previous);
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      {OPTIONS.map((opt) => {
        const active = current === opt.value;
        const style = active ? ACTIVE_STYLE[opt.value] : { bg: "var(--bg-elevated)", fg: "var(--text-faint)" };
        return (
          <button
            key={opt.value}
            onClick={() => handleClick(opt.value)}
            className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap"
            style={{ background: style.bg, color: style.fg }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
