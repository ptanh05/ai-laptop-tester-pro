"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Square, Clock, Zap } from "lucide-react";
import { runTool, getSystemMetrics, logEvent, aiEvaluate, writeLogFile, type SystemMetrics, type TestResult } from "@/lib/tauri";
import { getTempColor, type ScoringInput } from "@/lib/ai-scoring";

const TEST_DURATION_SEC = 900; // 15 minutes
const POLL_INTERVAL_MS = 2000;

interface Props {
  onComplete: (result: TestResult) => void;
  onMetricsUpdate: (cpuMax: number, gpuMax: number, avgCpu: number) => void;
}

export default function AutoTestController({ onComplete, onMetricsUpdate }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [cpuMax, setCpuMax] = useState(0);
  const [gpuMax, setGpuMax] = useState(0);
  const [avgCpuUsage, setAvgCpuUsage] = useState(0);
  const [logs, setLogs] = useState<SystemMetrics[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metricsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cpuSumRef = useRef(0);
  const sampleCountRef = useRef(0);

  const remainingSec = Math.max(0, TEST_DURATION_SEC - elapsedSec);
  const progress = (elapsedSec / TEST_DURATION_SEC) * 100;
  const progressColor = isRunning ? "#3b82f6" : "#475569";

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const saveLogs = useCallback(async () => {
    if (logs.length === 0) return;
    setSaving(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await writeLogFile(
        `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\test-${timestamp}.json`,
        logs.map((m, i) => ({
          timestamp: Date.now() - (logs.length - i) * POLL_INTERVAL_MS,
          cpu_temp: m.cpu_temp,
          gpu_temp: m.gpu_temp,
          ram_usage: m.ram_usage,
          event: "auto_test_sample",
        })),
      );
    } catch {
      // ignore
    }
    setSaving(false);
  }, [logs]);

  const finishTest = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (metricsRef.current) clearInterval(metricsRef.current);
    setIsRunning(false);
    setIsComplete(true);
    await saveLogs();

    const avgCpu = sampleCountRef.current > 0 ? cpuSumRef.current / sampleCountRef.current : 0;
    onMetricsUpdate(cpuMax, gpuMax, avgCpu);

    try {
      const result = await aiEvaluate(
        cpuMax,
        gpuMax,
        0, // benchmark
        0, // ssd read
        0, // ssd write
        true, // ram pass
        avgCpu,
        elapsedSec,
      );
      onComplete(result);
    } catch {
      onComplete({
        score: 0,
        verdict: "AVOID ❌",
        recommendation: "AVOID",
        explanations: ["Evaluation failed"],
        metrics: { cpu_temp: cpuMax, gpu_temp: gpuMax, ram_usage: 0, cpu_usage: avgCpu, ram_total_gb: 0, ram_used_gb: 0 },
        duration_sec: elapsedSec,
      });
    }
  }, [cpuMax, gpuMax, elapsedSec, logs, onComplete, onMetricsUpdate, saveLogs]);

  const startTest = async () => {
    setIsRunning(true);
    setElapsedSec(0);
    setCpuMax(0);
    setGpuMax(0);
    setAvgCpuUsage(0);
    setLogs([]);
    setIsComplete(false);
    startTimeRef.current = Date.now();
    cpuSumRef.current = 0;
    sampleCountRef.current = 0;

    try {
      await logEvent("AUTO_TEST_START");
      // Launch all tools
      await Promise.allSettled([
        runTool("Cinebench"),
        runTool("FurMark"),
        runTool("MemTest64"),
        runTool("CrystalDiskMark"),
      ]);
    } catch {
      // tools may not be installed — continue with monitoring
    }

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= TEST_DURATION_SEC) {
          finishTest();
        }
        return next;
      });
    }, 1000);

    // Metrics polling
    metricsRef.current = setInterval(async () => {
      try {
        const m = await getSystemMetrics();
        setLogs((prev) => [...prev, m]);
        cpuSumRef.current += m.cpu_usage;
        sampleCountRef.current += 1;

        setCpuMax((prev) => Math.max(prev, m.cpu_temp));
        setGpuMax((prev) => Math.max(prev, m.gpu_temp));
      } catch {
        // ignore
      }
    }, POLL_INTERVAL_MS);
  };

  const cancelTest = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (metricsRef.current) clearInterval(metricsRef.current);
    setIsRunning(false);
    setElapsedSec(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (metricsRef.current) clearInterval(metricsRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Zap size={16} className="text-[#f59e0b]" />
          Auto Test Mode
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-[#f59e0b20] text-[#f59e0b] border border-[#f59e0b40] font-medium">
          15 MIN
        </span>
      </div>

      {/* Timer display */}
      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Clock size={18} className={isRunning ? "text-[#f59e0b] animate-pulse" : "text-[#475569]"} />
          <span className="text-3xl font-black metric-value text-[#f1f5f9]">
            {formatTime(remainingSec)}
          </span>
        </div>
        <span className="text-xs text-[#94a3b8]">
          {isRunning ? "Test in progress..." : isComplete ? "Test Complete" : "Ready to start"}
        </span>

        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#111827" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #3b82f6, #06b6d4, #8b5cf6)" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-[#475569]">{formatTime(elapsedSec)}</span>
          <span className="text-xs text-[#475569]">15:00</span>
        </div>
      </div>

      {/* Current max temps */}
      {isRunning && (
        <div className="grid grid-cols-2 gap-2">
          <TempBadge label="CPU MAX" value={cpuMax} />
          <TempBadge label="GPU MAX" value={gpuMax} />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        {!isRunning ? (
          <motion.button
            onClick={startTest}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: "linear-gradient(135deg, #f97316, #ef4444)",
              color: "#fff",
              boxShadow: "0 0 20px rgba(249,115,22,0.3)",
            }}
          >
            <Play size={16} />
            Start Full Test
          </motion.button>
        ) : (
          <motion.button
            onClick={cancelTest}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: "#1a2235",
              color: "#ef4444",
              boxShadow: "0 0 0 1px #ef444460",
            }}
          >
            <Square size={16} />
            Cancel Test
          </motion.button>
        )}
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="text-xs text-[#94a3b8] text-center animate-pulse">
          Saving logs...
        </div>
      )}
    </div>
  );
}

function TempBadge({ label, value }: { label: string; value: number }) {
  const color = getTempColor(value);
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg"
      style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654" }}
    >
      <span className="text-xs text-[#94a3b8]">{label}</span>
      <span className="text-sm font-bold metric-value" style={{ color }}>
        {value > 0 ? `${value.toFixed(1)}°C` : "--"}
      </span>
    </div>
  );
}