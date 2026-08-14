"use client";

import { useMemo, useState } from "react";

type Parsed = { header: string | null; items: string[] };

// 8자리 날짜(YYYYMMDD)로 시작하면 보기 쉬운 YYYY-MM-DD로 바꿔준다.
function prettifyDate(s: string): string {
  return s.replace(/^(\d{4})(\d{2})(\d{2})(?=\D|$)/, "$1-$2-$3");
}

// 특이건 detail 문자열은 규칙마다 형식이 조금씩 다르다:
// - "N회 ... (예: A, B, C)" 형태 (R2/R4/R6) → 앞부분은 요약, 괄호 안은 사례 나열
// - "조건1 / 조건2" 형태 (R1/R3) → 슬래시로 독립된 조건 나열
// - "사례1; 사례2; 사례3" 형태 (R5 여러 건 집계) → 세미콜론으로 건별 나열
// 이 구조를 인식해서 "요약 한 줄 + 사례 불릿 리스트"로 재구성한다.
function parseDetail(detail: string): Parsed {
  const exampleMatch = detail.match(/^(.*?)\(예:\s*(.*)\)$/);
  if (exampleMatch) {
    const header = exampleMatch[1].trim();
    const raw = exampleMatch[2];
    const items = (raw.includes(";") ? raw.split(/;\s*/) : raw.split(/,\s*/))
      .map((p) => prettifyDate(p.trim()))
      .filter(Boolean);
    return { header, items };
  }

  let items = detail
    .split(/;\s*/)
    .map((p) => prettifyDate(p.trim()))
    .filter(Boolean);
  if (items.length <= 1) {
    items = detail
      .split(/\s+\/\s+/)
      .map((p) => prettifyDate(p.trim()))
      .filter(Boolean);
  }
  if (items.length <= 1) {
    return { header: null, items: [prettifyDate(detail)] };
  }
  return { header: null, items };
}

export default function AnomalyDetailCell({ detail }: { detail: string }) {
  const [expanded, setExpanded] = useState(false);
  const { header, items } = useMemo(() => parseDetail(detail), [detail]);

  const isSingleLine = !header && items.length <= 1;
  if (isSingleLine) {
    return (
      <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {items[0]}
      </span>
    );
  }

  const visibleItems = expanded ? items : items.slice(0, 1);

  return (
    <div className="flex flex-col gap-1 max-w-[300px]">
      {header && (
        <span className="text-xs font-medium leading-relaxed" style={{ color: "var(--text)" }}>
          {header}
        </span>
      )}
      {visibleItems.map((p, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--text-faint)" }} />
          <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {p}
          </span>
        </div>
      ))}
      {items.length > 1 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-[11px] font-medium mt-0.5"
          style={{ color: "var(--accent)" }}
        >
          {expanded ? "접기" : `외 ${items.length - 1}건 더보기`}
        </button>
      )}
    </div>
  );
}
