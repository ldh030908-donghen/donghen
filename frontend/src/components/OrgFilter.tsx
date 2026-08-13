"use client";

import { useEffect, useState } from "react";
import { fetchDepartments, fetchDivisions } from "@/lib/api";

const selectStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

export default function OrgFilter({
  division,
  department,
  onDivisionChange,
  onDepartmentChange,
}: {
  division: string | null;
  department: string | null;
  onDivisionChange: (v: string | null) => void;
  onDepartmentChange: (v: string | null) => void;
}) {
  const [divisions, setDivisions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchDivisions().then(setDivisions);
  }, []);

  useEffect(() => {
    fetchDepartments(division ?? undefined).then(setDepartments);
  }, [division]);

  return (
    <div className="flex items-center gap-2">
      <select
        value={division ?? ""}
        onChange={(e) => {
          const v = e.target.value || null;
          onDivisionChange(v);
          onDepartmentChange(null);
        }}
        className="px-3 py-1.5 rounded-lg text-sm outline-none"
        style={selectStyle}
      >
        <option value="">전체 사업부</option>
        {divisions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        value={department ?? ""}
        onChange={(e) => onDepartmentChange(e.target.value || null)}
        className="px-3 py-1.5 rounded-lg text-sm outline-none disabled:opacity-50"
        style={selectStyle}
      >
        <option value="">전체 부서</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}
