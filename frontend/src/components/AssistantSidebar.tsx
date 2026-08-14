"use client";

import { useState } from "react";
import ChatPanel, { type ChatStatus } from "./ChatPanel";
import HighlightsBanner from "./HighlightsBanner";
import NewsBanner from "./NewsBanner";
import ProcessStatusPanel from "./ProcessStatusPanel";

const INITIAL_STATUS: ChatStatus = { loading: false, steps: [], reference: null, hasStarted: false };

export default function AssistantSidebar() {
  const [status, setStatus] = useState<ChatStatus>(INITIAL_STATUS);

  return (
    <aside className="w-full lg:w-[296px] shrink-0 flex flex-col gap-4 h-[calc(100vh-8rem)] lg:sticky lg:top-8">
      <div
        className="flex-[5] min-h-0 rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <ChatPanel onStatusChange={setStatus} />
      </div>
      <div className="flex-[2] min-h-0">
        <HighlightsBanner />
      </div>
      <div className="flex-[2] min-h-0">
        <NewsBanner />
      </div>
      <div className="flex-[2] min-h-0">
        <ProcessStatusPanel
          loading={status.loading}
          steps={status.steps}
          reference={status.reference}
          hasStarted={status.hasStarted}
        />
      </div>
    </aside>
  );
}
