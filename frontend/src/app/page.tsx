"use client";

import { useState } from "react";
import UploadZone from "@/components/UploadZone";
import AnalysisProgress from "@/components/AnalysisProgress";
import Dashboard from "@/components/Dashboard";
import { uploadRawFile, type UploadResponse } from "@/lib/api";

type Stage = "upload" | "analyzing" | "dashboard";

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const result = await uploadRawFile(file);
      setUploadResult(result);
      setStage("analyzing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      {stage === "upload" && (
        <UploadZone onFileSelected={handleFile} error={error} uploading={uploading} />
      )}
      {stage === "analyzing" && uploadResult && (
        <AnalysisProgress steps={uploadResult.steps} onComplete={() => setStage("dashboard")} />
      )}
      {stage === "dashboard" && uploadResult && <Dashboard upload={uploadResult} />}
    </main>
  );
}
