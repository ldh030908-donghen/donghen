// 사내망 등 다른 기기에서 접속해도 지금 브라우저 주소의 호스트를 그대로 따라가서
// API를 찾도록 한다 (localhost로 고정하면 다른 PC에서 열었을 때 자기 자신을 가리키게 됨).
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000");

export type UploadResponse = {
  row_count: number;
  employee_count: number;
  min_date: string;
  max_date: string;
  total_row_count: number;
  total_employee_count: number;
  steps: { id: string; label: string }[];
};

export type Overview =
  | { has_data: false }
  | {
      has_data: true;
      available_months: string[];
      latest_month: string;
      employee_count: number;
      total_employee_count: number;
      anomaly_total: number;
      anomaly_affected_employees: number;
      avg_hours_per_employee_per_month: number;
    };

export type AnomalyItem = {
  사번: string;
  사업부: string;
  부서명: string;
  성명: string;
  직급: string;
  rule_code: string;
  case_name: string;
  detail: string;
  occurrence_count: number;
};

export type AnomaliesResponse = {
  month: string | null;
  total: number;
  affected_employees: number;
  by_rule: Record<string, number>;
  items: AnomalyItem[];
};

export type RuleMeta = { rule_code: string; case_name: string; description: string };

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

export type EmployeeMatch = {
  사번: string;
  사업부: string;
  부서명: string;
  성명: string;
  직급: string;
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

export async function fetchOverview(): Promise<Overview> {
  return request<Overview>("/api/overview");
}

export async function fetchMonths(): Promise<string[]> {
  const res = await request<{ months: string[] }>("/api/months");
  return res.months;
}

export async function fetchAnomalies(params: {
  month?: string;
  division?: string;
  department?: string;
  empId?: string;
}): Promise<AnomaliesResponse> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  if (params.empId) qs.set("emp_id", params.empId);
  return request<AnomaliesResponse>(`/api/anomalies?${qs.toString()}`);
}

export async function fetchRulesMeta(): Promise<RuleMeta[]> {
  const res = await request<{ rules: RuleMeta[] }>("/api/rules/meta");
  return res.rules;
}

export async function fetchDivisions(): Promise<string[]> {
  const res = await request<{ divisions: string[] }>("/api/org/divisions");
  return res.divisions;
}

export async function fetchDepartments(division?: string): Promise<string[]> {
  const qs = division ? `?division=${encodeURIComponent(division)}` : "";
  const res = await request<{ departments: string[] }>(`/api/org/departments${qs}`);
  return res.departments;
}

export async function searchEmployees(q: string): Promise<EmployeeMatch[]> {
  const res = await request<{ items: EmployeeMatch[] }>(
    `/api/employees/search?q=${encodeURIComponent(q)}`
  );
  return res.items;
}

export async function resetData(): Promise<void> {
  await request<{ status: string }>("/api/reset", { method: "DELETE" });
}

export type AnomalyTrendItem = { month: string; total: number; affected_employees: number };
export type HoursTrendItem = {
  month: string;
  avg_hours_per_employee_per_month: number;
  employee_count: number;
};

export async function fetchAnomaliesTrend(year?: string): Promise<AnomalyTrendItem[]> {
  const qs = year ? `?year=${encodeURIComponent(year)}` : "";
  const res = await request<{ items: AnomalyTrendItem[] }>(`/api/anomalies/trend${qs}`);
  return res.items;
}

export async function fetchHoursTrend(year?: string, metric: Metric = "worktime"): Promise<HoursTrendItem[]> {
  const qs = new URLSearchParams({ metric });
  if (year) qs.set("year", year);
  const res = await request<{ items: HoursTrendItem[] }>(`/api/hours-trend?${qs.toString()}`);
  return res.items;
}

export async function fetchHoursSummary(params: {
  groupLevel: GroupLevel;
  periodKind: PeriodKind;
  metric?: Metric;
  division?: string;
  department?: string;
}): Promise<{ items: HoursSummaryItem[] }> {
  const qs = new URLSearchParams({
    group_level: params.groupLevel,
    period_kind: params.periodKind,
    metric: params.metric ?? "worktime",
  });
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  return request(`/api/hours-summary?${qs.toString()}`);
}
