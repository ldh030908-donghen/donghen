/** 소수 시간(예: 180.9333)을 "180시간 56분" 형태로 사람이 읽기 좋게 바꾼다. */
export function formatHoursMinutes(hours: number): string {
  if (!Number.isFinite(hours)) return "-";
  const sign = hours < 0 ? "-" : "";
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${sign}${h}시간 ${m}분`;
}
