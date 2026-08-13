"use client";

import { useEffect } from "react";

export default function Modal({
  onClose,
  children,
  maxWidth = 640,
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "#10131c66", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-2xl overflow-hidden"
        style={{
          maxWidth,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px -12px rgba(16, 19, 28, 0.25)",
          maxHeight: "85vh",
        }}
      >
        {children}
      </div>
    </div>
  );
}
