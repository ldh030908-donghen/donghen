"use client";

import { useEffect, useState } from "react";
import { fetchWorkGroups } from "@/lib/api";

export default function WorkGroupSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchWorkGroups().then(setOptions);
  }, []);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="근무제"
      className="px-3 py-1.5 rounded-lg text-sm outline-none"
      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
    >
      <option value="">전체 근무제</option>
      {options.map((w) => (
        <option key={w} value={w}>
          {w}
        </option>
      ))}
    </select>
  );
}
