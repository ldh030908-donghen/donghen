// 특이건 발생 횟수(occurrence_count)를 상대적 심각도 3단계로 나눠 시각적으로 바로 스캔되게 한다.
// 절대 임계값이 아니라 "지금 보고 있는 데이터셋 안에서의 상대 순위"로 계산 — 더미셋마다 값 범위가
// 크게 달라도(예: 1~26회 vs 전혀 다른 분포) 항상 상/중/하가 자연스럽게 나뉜다.

export type SeverityTier = "critical" | "serious" | "info";

export const SEVERITY_STYLE: Record<SeverityTier, { fg: string; bg: string; label: string }> = {
  critical: { fg: "var(--status-critical)", bg: "var(--status-critical-soft)", label: "심각" },
  serious: { fg: "var(--status-serious)", bg: "var(--status-serious-soft)", label: "주의" },
  info: { fg: "var(--status-info)", bg: "var(--status-info-soft)", label: "관찰" },
};

export function severityTier(count: number, maxCount: number): SeverityTier {
  if (maxCount <= 0) return "info";
  const ratio = count / maxCount;
  if (ratio >= 0.66) return "critical";
  if (ratio >= 0.33) return "serious";
  return "info";
}
