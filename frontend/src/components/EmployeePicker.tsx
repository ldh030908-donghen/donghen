"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { searchEmployees, type EmployeeMatch } from "@/lib/api";

export default function EmployeePicker({
  selected,
  onSelect,
}: {
  selected: EmployeeMatch | null;
  onSelect: (emp: EmployeeMatch | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<EmployeeMatch[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() || selected) {
      setMatches([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchEmployees(query.trim());
        setMatches(results);
        if (results.length === 1) {
          onSelect(results[0]);
          setQuery("");
        } else if (results.length > 1) {
          setShowPicker(true);
        }
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selected]);

  if (selected) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
      >
        <span className="font-medium">{selected.성명}</span>
        <span style={{ color: "var(--text-faint)" }}>
          {selected.사번} · {selected.부서명}
        </span>
        <button
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          className="ml-1 opacity-70 hover:opacity-100"
          aria-label="선택 해제"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="사번 또는 성명 검색"
          className="px-3 py-1.5 rounded-lg text-sm outline-none w-56"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
        {searching && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full block"
            style={{
              border: "2px solid var(--accent)",
              borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }}
          />
        )}
        {!searching && query.trim() && matches.length === 0 && (
          <div
            className="absolute top-full mt-1 left-0 px-3 py-2 rounded-lg text-xs z-10"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-faint)" }}
          >
            일치하는 인원이 없습니다.
          </div>
        )}
      </div>

      {showPicker && (
        <Modal onClose={() => setShowPicker(false)} maxWidth={480}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">동일한 이름이 여러 명입니다 — 선택해주세요</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                style={{ color: "var(--text-faint)" }}
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
              {matches.map((m) => (
                <button
                  key={m.사번}
                  onClick={() => {
                    onSelect(m);
                    setShowPicker(false);
                    setQuery("");
                  }}
                  className="text-left px-4 py-3 rounded-xl transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <div className="font-medium text-sm">{m.성명}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                    사번 {m.사번} · {m.사업부} · {m.부서명} · {m.직급}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
