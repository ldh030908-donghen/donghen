"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import { fetchOverview, type Overview } from "@/lib/api";

export default function Home() {
  const [overview, setOverview] = useState<Overview | null>(null);

  function reload() {
    fetchOverview().then(setOverview);
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      {overview === null ? (
        <div className="flex flex-col items-center gap-3">
          <span
            className="w-6 h-6 rounded-full block"
            style={{ border: "2.5px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}
          />
        </div>
      ) : (
        <Dashboard overview={overview} onDataChanged={reload} />
      )}
    </main>
  );
}
