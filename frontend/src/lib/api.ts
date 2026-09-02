// 프론트 서버(next.config.ts의 rewrites)가 /api/*를 백엔드(:8000)로 대신 전달해주므로,
// 브라우저는 항상 "지금 접속한 주소"로만 요청하면 된다 (localhost/사내망 IP/Cloudflare 터널
// 주소 어디로 접속하든 동일하게 동작 — 접속 주소별로 다른 백엔드 주소를 계산할 필요가 없음).
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

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

export type CaseStatus = "checked" | "resolved" | "false_positive";

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
  status?: CaseStatus | "";
  note?: string;
  /** 연도별(1~12월 통합) 조회일 때만 채워지는, 이 건이 실제로 발생한 월. */
  month?: string;
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
  /** month를 안 주고 year만 주면 그 해 1~12월 데이터를 통합해서 반환한다. */
  year?: string;
  division?: string;
  department?: string;
  empId?: string;
}): Promise<AnomaliesResponse> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);
  if (params.year) qs.set("year", params.year);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  if (params.empId) qs.set("emp_id", params.empId);
  return request<AnomaliesResponse>(`/api/anomalies?${qs.toString()}`);
}

export async function fetchRulesMeta(): Promise<RuleMeta[]> {
  const res = await request<{ rules: RuleMeta[] }>("/api/rules/meta");
  return res.rules;
}

export type CandidateMeta = { candidate_code: string; case_name: string; description: string };

export async function fetchCandidatesMeta(): Promise<CandidateMeta[]> {
  const res = await request<{ candidates: CandidateMeta[] }>("/api/candidates/meta");
  return res.candidates;
}

// 확인대상 응답도 특이건과 동일한 모양(AnomalyItem/AnomaliesResponse)을 쓴다 — 백엔드가 같은 스키마로 내려준다.
export async function fetchCandidates(params: {
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
  return request<AnomaliesResponse>(`/api/candidates?${qs.toString()}`);
}

export async function fetchHighlights(limit = 8): Promise<{ month: string | null; items: AnomalyItem[] }> {
  return request(`/api/highlights?limit=${limit}`);
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

export async function fetchWorkGroups(): Promise<string[]> {
  const res = await request<{ workgroups: string[] }>("/api/org/workgroups");
  return res.workgroups;
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

export async function fetchAnomaliesTrend(params: {
  year?: string;
  division?: string;
  department?: string;
}): Promise<AnomalyTrendItem[]> {
  const qs = new URLSearchParams();
  if (params.year) qs.set("year", params.year);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  const res = await request<{ items: AnomalyTrendItem[] }>(`/api/anomalies/trend?${qs.toString()}`);
  return res.items;
}

export async function fetchHoursTrend(params: {
  year?: string;
  metric?: Metric;
  division?: string;
  department?: string;
  workGroup?: string;
  empId?: string;
}): Promise<HoursTrendItem[]> {
  const qs = new URLSearchParams({ metric: params.metric ?? "worktime" });
  if (params.year) qs.set("year", params.year);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  if (params.workGroup) qs.set("work_group", params.workGroup);
  if (params.empId) qs.set("emp_id", params.empId);
  const res = await request<{ items: HoursTrendItem[] }>(`/api/hours-trend?${qs.toString()}`);
  return res.items;
}

export type AnomalyTopPerson = {
  사번: string;
  사업부: string;
  부서명: string;
  성명: string;
  직급: string;
  total_occurrences: number;
  rule_count: number;
};

export async function fetchAnomaliesTopPeople(params: {
  month?: string;
  division?: string;
  department?: string;
  limit?: number;
}): Promise<{ month: string | null; items: AnomalyTopPerson[] }> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  qs.set("limit", String(params.limit ?? 5));
  return request(`/api/anomalies/top-people?${qs.toString()}`);
}

export type HoursTopPerson = {
  사업부: string;
  부서명: string;
  사번: string;
  성명: string;
  직급: string;
  period: string;
  avg_hours_per_employee_per_month: number;
  total_hours: number;
};

export async function fetchHoursTopPeople(params: {
  periodKind?: PeriodKind;
  periodValue?: string;
  metric?: Metric;
  division?: string;
  department?: string;
  workGroup?: string;
  limit?: number;
}): Promise<{ period: string | null; items: HoursTopPerson[] }> {
  const qs = new URLSearchParams({ period_kind: params.periodKind ?? "month", metric: params.metric ?? "worktime" });
  if (params.periodValue) qs.set("period_value", params.periodValue);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  if (params.workGroup) qs.set("work_group", params.workGroup);
  qs.set("limit", String(params.limit ?? 5));
  return request(`/api/hours-summary/top-people?${qs.toString()}`);
}

export type HrNewsItem = {
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
};

export async function fetchHrNews(): Promise<HrNewsItem[]> {
  const res = await request<{ items: HrNewsItem[] }>("/api/hr-news");
  return res.items;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResult = {
  kind: string;
  items?: Record<string, unknown>[];
  [key: string]: unknown;
} | null;

export type ChatExport = { kind: string; params: Record<string, unknown> } | null;

export type ChatStep = { label: string };

export type ChatResponse = {
  reply: string;
  result: ChatResult;
  export: ChatExport;
  steps: ChatStep[];
  reference: string | null;
};

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
}

export function buildExportUrl(exp: { kind: string; params: Record<string, unknown> }): string {
  const qs = new URLSearchParams({ kind: exp.kind });
  for (const [k, v] of Object.entries(exp.params)) {
    if (v === undefined || v === null || v === "") continue;
    // 챗봇 도구 인자는 period_value라는 이름을 쓰지만 /api/export는 month 파라미터를 받는다 —
    // 이름이 안 맞아서 특정 월을 지정해도 조용히 무시되던 버그였다.
    const key = k === "period_value" ? "month" : k;
    qs.set(key, String(v));
  }
  return `${API_BASE}/api/export?${qs.toString()}`;
}

export async function fetchHoursSummary(params: {
  groupLevel: GroupLevel;
  periodKind: PeriodKind;
  periodValue?: string;
  metric?: Metric;
  division?: string;
  department?: string;
  workGroup?: string;
}): Promise<{ items: HoursSummaryItem[] }> {
  const qs = new URLSearchParams({
    group_level: params.groupLevel,
    period_kind: params.periodKind,
    metric: params.metric ?? "worktime",
  });
  if (params.periodValue) qs.set("period_value", params.periodValue);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  if (params.workGroup) qs.set("work_group", params.workGroup);
  return request(`/api/hours-summary?${qs.toString()}`);
}

export async function fetchPeriods(periodKind: PeriodKind): Promise<string[]> {
  const res = await request<{ periods: string[] }>(
    `/api/periods?period_kind=${encodeURIComponent(periodKind)}`
  );
  return res.periods;
}

export async function updateCaseStatus(params: {
  empId: string;
  ruleCode: string;
  month: string;
  status: CaseStatus | null;
  note?: string;
}): Promise<void> {
  await request<{ ok: boolean }>("/api/case-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emp_id: params.empId,
      rule_code: params.ruleCode,
      month: params.month,
      status: params.status,
      note: params.note,
    }),
  });
}

export type EmployeeTimelineItem = AnomalyItem & {
  month: string;
  source: "rule" | "candidate";
};

export type EmployeeProfile = {
  사번: string;
  사업부: string;
  부서명: string;
  성명: string;
  직급: string;
};

export type EmployeeTimeline = {
  emp_id: string;
  profile: EmployeeProfile | null;
  items: EmployeeTimelineItem[];
  hours_trend: { month: string; hours: number }[];
};

export async function fetchEmployeeTimeline(empId: string): Promise<EmployeeTimeline> {
  return request<EmployeeTimeline>(`/api/employee-timeline?emp_id=${encodeURIComponent(empId)}`);
}

export type RosterItem = {
  사번: string;
  사업부: string;
  부서명: string;
  성명: string;
  직급: string;
  avg_hours: number;
  anomaly_total: number;
  anomaly_by_rule: Record<string, number>;
  top_rule: string | null;
  candidate_total: number;
  status_summary: Record<string, number>;
};

export async function fetchRoster(params: {
  month?: string;
  division?: string;
  department?: string;
}): Promise<{ month: string | null; items: RosterItem[] }> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);
  if (params.division) qs.set("division", params.division);
  if (params.department) qs.set("department", params.department);
  return request(`/api/roster?${qs.toString()}`);
}
