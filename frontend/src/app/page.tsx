"use client";

import { useEffect, useState } from "react";
import AssistantSidebar from "@/components/AssistantSidebar";
import Dashboard, { type Tab } from "@/components/Dashboard";
import SideNav, { SIDENAV_WIDTH } from "@/components/SideNav";
import { fetchOverview, type Overview } from "@/lib/api";

export default function Home() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [showUpload, setShowUpload] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navPinned, setNavPinned] = useState(false);

  function reload() {
    fetchOverview().then(setOverview);
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <>
      <SideNav
        open={navOpen}
        pinned={navPinned}
        tab={tab}
        onSelectTab={setTab}
        onClose={() => setNavOpen(false)}
        onTogglePin={() => setNavPinned((v) => !v)}
        onUploadClick={() => setShowUpload(true)}
      />
      <main
        className="flex-1 px-6 py-16 transition-[padding] duration-200"
        style={{ paddingLeft: navPinned ? SIDENAV_WIDTH + 24 : undefined }}
      >
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
              <Dashboard
                overview={overview}
                onDataChanged={reload}
                tab={tab}
                onSelectTab={setTab}
                showUpload={showUpload}
                onShowUploadChange={setShowUpload}
                onOpenNav={() => setNavOpen(true)}
              />
            </div>
            <AssistantSidebar />
          </div>
        )}
      </main>
    </>
  );
}
