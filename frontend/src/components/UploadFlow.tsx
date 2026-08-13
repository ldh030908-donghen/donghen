"use client";

import { useState } from "react";
import UploadZone from "./UploadZone";
import AnalysisProgress from "./AnalysisProgress";
import { uploadRawFile, type UploadResponse } from "@/lib/api";

type Stage = "upload" | "analyzing";

export default function UploadFlow({ onDone }: { onDone: (result: UploadResponse) => void }) {
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

  if (stage === "analyzing" && uploadResult) {
    return (
      <AnalysisProgress steps={uploadResult.steps} onComplete={() => onDone(uploadResult)} />
    );
  }

  return <UploadZone onFileSelected={handleFile} error={error} uploading={uploading} />;
}
