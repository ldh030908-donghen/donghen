const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type UploadResponse = {
  session_id: string;
  row_count: number;
  employee_count: number;
  steps: { id: string; label: string }[];
};

export type AnomalyItem = {
  사번: string;
  부서명: string;
  성명: string;
  직급: string;
  rule_code: string;
  case_name: string;
  detail: string;
  occurrence_count: number;
};

export type AnomaliesResponse = {
  total: number;
  affected_employees: number;
  by_rule: Record<string, number>;
  items: AnomalyItem[];
};

export type HoursSummaryItem = {
  사업부: string;
  부서명?: string;
  사번?: string;
  성명?: string;
  직급?: string;
  period: string;
  period_kind: string;
  metric: string;
  employee_count: number;
  total_hours: number;
  avg_hours_per_employee_total: number;
  avg_hours_per_employee_per_month: number;
};

export type GroupLevel = "division" | "department" | "employee";
export type PeriodKind = "week" | "month" | "quarter" | "half" | "year";
export type Metric = "worktime" | "stay";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function uploadRawFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResponse>("/api/upload", { method: "POST", body: form });
}

export async function fetchAnomalies(sessionId: string): Promise<AnomaliesResponse> {
  return request<AnomaliesResponse>(`/api/anomalies?session_id=${sessionId}`);
}

export async function fetchHoursSummary(
  sessionId: string,
  groupLevel: GroupLevel,
  periodKind: PeriodKind,
  metric: Metric = "worktime"
): Promise<{ items: HoursSummaryItem[] }> {
  const params = new URLSearchParams({
    session_id: sessionId,
    group_level: groupLevel,
    period_kind: periodKind,
    metric,
  });
  return request(`/api/hours-summary?${params.toString()}`);
}
