"use client";

import { useEffect, useRef, useState } from "react";

type Step = { id: string; label: string };
type Particle = { left: number; delay: number; duration: number; dx: number; size: number };

function makeParticles(): Particle[] {
  return Array.from({ length: 22 }).map(() => ({
    left: Math.random() * 100,
    delay: Math.random() * 4,
    duration: 4 + Math.random() * 4,
    dx: (Math.random() - 0.5) * 60,
    size: 2 + Math.random() * 2,
  }));
}

const LOG_TEMPLATES: Record<string, string[]> = {
  parse: [
    "RAW 시트 스캐닝... 컬럼 매핑 확인 (L=입문, M=출문, Q=변경후시작, T=제외시간)",
    "행 파싱 완료",
  ],
  stay: [
    "입문/출문 시각 파싱 중...",
    "자정 롤오버 케이스 보정 적용",
    "N열(체류시간) 계산 완료",
  ],
  rule1: ["인원별 월 누적 근로시간 집계 중...", "기준시간 대비 초과 여부 판정"],
  rule2: ["입문(L) vs 변경후시작(Q) 시간 차이 계산", "1시간 이상 괴리 케이스 필터링"],
  rule3: ["근무조별(본사/현장) 제외시간 임계값 적용", "정상치 초과일 카운트 집계"],
  rule4: ["선택근무제(본사) 대상자 필터링", "코어타임(10~15시) 부재 여부 판정", "시간연차 사용 여부 교차 확인"],
  rule5: ["월말 구간 제외시간 값 분포 분석", "평소 패턴 대비 이상치 탐지"],
  rule6: ["입/출문 편측 결측 케이스 탐지", "반복 발생 여부 확인"],
  rule7: ["일별 체류시간 시퀀스 구성", "캘린더 연속성 검증 후 장시간 근무 구간 탐지"],
  done: ["결과 취합 및 인원별 케이스 매핑 완료"],
};

export default function AnalysisProgress({
  steps,
  onComplete,
}: {
  steps: Step[];
  onComplete: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [logLines, setLogLines] = useState<{ id: string; text: string }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(makeParticles());
  }, []);

  useEffect(() => {
    if (activeIndex >= steps.length) {
      const t = setTimeout(onComplete, 500);
      return () => clearTimeout(t);
    }
    const step = steps[activeIndex];
    const lines = LOG_TEMPLATES[step.id] ?? [`${step.label} 처리 중...`];
    const lineTimers = lines.map((line, i) =>
      setTimeout(() => {
        logCounter.current += 1;
        setLogLines((prev) => [...prev, { id: `log-${logCounter.current}`, text: line }]);
      }, i * 180)
    );
    const stepDuration = 480 + lines.length * 180;
    const t = setTimeout(() => setActiveIndex((v) => v + 1), stepDuration);
    return () => {
      lineTimers.forEach(clearTimeout);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  const progressPct = Math.min(100, (activeIndex / steps.length) * 100);

  return (
    <div className="w-full max-w-4xl mx-auto relative overflow-hidden">
      {/* 배경 파티클 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={
              {
                left: `${p.left}%`,
                bottom: 0,
                width: p.size,
                height: p.size,
                background: "var(--accent-strong)",
                "--dx": `${p.dx}px`,
                animation: `float-particle ${p.duration}s ease-in ${p.delay}s infinite`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5"
          style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--accent-strong)", animation: "pulse-ring 1.6s infinite" }}
          />
          분석 진행 중
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">근태 데이터를 분석하고 있습니다</h1>
      </div>

      {/* 전체 진행률 타임라인 */}
      <div className="mb-8 px-1">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-strong))" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          <span>{Math.min(activeIndex, steps.length)} / {steps.length} 단계</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 워크플로우 그래프 */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-xs font-medium mb-4" style={{ color: "var(--text-faint)" }}>
            분석 워크플로우
          </div>
          <div className="relative">
            {steps.map((step, i) => {
              const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
              return (
                <div key={step.id} className="relative flex items-start gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && (
                    <div
                      className="absolute left-[9px] top-5 bottom-0 w-px"
                      style={{
                        background:
                          state === "done" ? "var(--accent)" : "var(--border-strong)",
                        transition: "background 0.4s",
                      }}
                    />
                  )}
                  <div
                    className="relative z-10 w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300"
                    style={{
                      background:
                        state === "pending" ? "var(--bg-elevated)" : "var(--accent)",
                      border: `1.5px solid ${state === "pending" ? "var(--border-strong)" : "var(--accent)"}`,
                      animation: state === "active" ? "pulse-ring 1.4s infinite" : "none",
                    }}
                  >
                    {state === "done" && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div
                    className="text-sm pt-0.5 transition-colors duration-300"
                    style={{
                      color: state === "pending" ? "var(--text-faint)" : "var(--text)",
                      fontWeight: state === "active" ? 600 : 400,
                    }}
                  >
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 라이브 로그 스트림 */}
        <div
          className="rounded-2xl p-5 flex flex-col"
          style={{ background: "#000000", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f2555a" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f5b942" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#34d399" }} />
            <span className="ml-2 text-xs" style={{ color: "var(--text-faint)" }}>
              analysis.log
            </span>
          </div>
          <div
            className="flex-1 overflow-y-auto font-mono text-[12px] leading-relaxed"
            style={{ maxHeight: 280, color: "#8ce6a8" }}
          >
            {logLines.map((line) => (
              <div key={line.id} style={{ animation: "log-in 0.25s ease-out" }} className="mb-1">
                <span style={{ color: "var(--text-faint)" }}>{"> "}</span>
                {line.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
