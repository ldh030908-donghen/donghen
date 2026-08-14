"use client";

import { useEffect, useState } from "react";
import AssistantSidebar from "@/components/AssistantSidebar";
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
    <main className="flex-1 px-6 py-16">
      {overview === null ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <span
            className="w-6 h-6 rounded-full block"
            style={{ border: "2.5px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}
          />
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0">
            <Dashboard overview={overview} onDataChanged={reload} />
          </div>
          <AssistantSidebar />
        </div>
      )}
    </main>
  );
}
