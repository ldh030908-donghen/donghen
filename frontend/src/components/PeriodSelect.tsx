"use client";

import type { PeriodKind } from "@/lib/api";

// "조회 시점을 하나로 고정하지 않고 보유한 모든 기간을 다 보여줘" 라는 선택지를 나타내는 값.
// 실제 기간값과 겹치지 않도록 만든 sentinel이다.
export const PERIOD_ALL = "__all__";

// "2026-03" / "2026-Q1" / "2026-H1" / "2026-W12" / "2026" 같은 기간값을
// 드롭다운에서 보기 좋은 라벨로 바꾼다.
export function periodOptionLabel(period: string, kind: PeriodKind): string {
  switch (kind) {
    case "month": {
      const m = Number(period.slice(5, 7));
      return Number.isFinite(m) ? `${m}월` : period;
    }
    case "quarter": {
      const q = period.slice(6);
      return `${q}분기`;
    }
    case "half": {
      return period.endsWith("H1") ? "상반기" : "하반기";
    }
    case "week": {
      const w = Number(period.slice(6));
      return Number.isFinite(w) ? `${w}주차` : period;
    }
    case "year":
      return `${period}년`;
    default:
      return period;
  }
}

function yearOf(period: string, kind: PeriodKind): string {
  return kind === "year" ? period : period.slice(0, 4);
}

// "2026년 3월", "2026년 1분기", "2026년" 처럼 연도까지 포함한 풀 라벨.
export function periodFullLabel(period: string, kind: PeriodKind): string {
  if (kind === "year") return `${period}년`;
  return `${yearOf(period, kind)}년 ${periodOptionLabel(period, kind)}`;
}

/** 연도별로 묶은(optgroup) 기간 선택 드롭다운. period_kind가 "year"면 그룹 없이 평평하게 보여준다. */
export default function PeriodSelect({
  periods,
  periodKind,
  value,
  onChange,
  label,
  className,
  allowAllLabel,
}: {
  periods: string[];
  periodKind: PeriodKind;
  value: string | null;
  onChange: (v: string) => void;
  label?: string;
  className?: string;
  /** 지정하면 목록 맨 위에 "전체 기간" 같은 옵션(PERIOD_ALL)을 추가한다. */
  allowAllLabel?: string;
}) {
  const years = Array.from(new Set(periods.map((p) => yearOf(p, periodKind))));
  const grouped = periodKind !== "year";

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={className ?? "px-3 py-1.5 rounded-lg text-sm outline-none"}
      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
    >
      {periods.length === 0 && <option value="">데이터 없음</option>}
      {allowAllLabel && <option value={PERIOD_ALL}>{allowAllLabel}</option>}
      {grouped
        ? years.map((year) => (
            <optgroup key={year} label={`${year}년`}>
              {periods
                .filter((p) => yearOf(p, periodKind) === year)
                .map((p) => (
                  <option key={p} value={p}>
                    {periodOptionLabel(p, periodKind)}
                  </option>
                ))}
            </optgroup>
          ))
        : periods.map((p) => (
            <option key={p} value={p}>
              {periodOptionLabel(p, periodKind)}
            </option>
          ))}
    </select>
  );
}
