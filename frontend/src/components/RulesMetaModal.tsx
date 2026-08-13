"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { fetchRulesMeta, type RuleMeta } from "@/lib/api";

export default function RulesMetaModal({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState<RuleMeta[] | null>(null);

  useEffect(() => {
    fetchRulesMeta().then(setRules);
  }, []);

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">탐지 규칙 목록</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
            style={{ color: "var(--text-faint)" }}
          >
            ✕
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--text-faint)" }}>
          현재 이 도구가 자동으로 탐지하는 근태 특이건 규칙입니다.
        </p>
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          {!rules &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl"
                style={{ background: "var(--bg-elevated)", animation: "skeleton-pulse 1.4s ease-in-out infinite" }}
              />
            ))}
          {rules?.map((rule) => (
            <div
              key={rule.rule_code}
              className="p-4 rounded-xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  {rule.case_name}
                </span>
                <span className="text-[11px] font-mono" style={{ color: "var(--text-faint)" }}>
                  {rule.rule_code}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
