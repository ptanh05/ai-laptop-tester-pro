"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Square, Clock, Zap, Pause } from "lucide-react";
import {
  runTool,
  getSystemMetrics,
  logEvent,
  aiEvaluate,
  writeLogFile,
  clearLogs,
  measureBatteryDrain,
  getSystemInfo,
  type TestResult,
} from "@/lib/tauri";
import { getTempColor } from "@/lib/ai-scoring";

const TEST_DURATION_SEC = 900; // 15 minutes
const POLL_INTERVAL_MS = 2000;

interface Props {
  onComplete: (result: TestResult, elapsed: number) => void;
  onRunningChange: (running: boolean) => void;
  toolPaths?: Record<string, string>;
  cpuTier?: string;
  batteryHealth?: number;
  drainRate?: number;
  networkDown?: number;
  networkUp?: number;
  networkLatency?: number;
}

export default function AutoTestController({
  onComplete,
  onRunningChange,
  toolPaths,
  cpuTier = "lowmid",
  batteryHealth = -1,
  drainRate = 0,
  networkDown = 0,
  networkUp = 0,
  networkLatency = 0,
}: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Use refs to avoid stale closures
  const cpuMaxRef = useRef(0);
  const gpuMaxRef = useRef(0);
  const cpuSumRef = useRef(0);
  const sampleCountRef = useRef(0);
  const logsRef = useRef<Awaited<ReturnType<typeof getSystemMetrics>>[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTestRef = useRef<(() => Promise<void>) | null>(null);

  const remainingSec = Math.max(0, TEST_DURATION_SEC - elapsedSec);
  const progress = (elapsedSec / TEST_DURATION_SEC) * 100;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const finishTest = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    timerRef.current = null;
    pollRef.current = null;

    setIsRunning(false);
    setIsComplete(true);
    onRunningChange(false);

    const elapsed = elapsedSec; // capture from state at call time
    const avgCpu = sampleCountRef.current > 0 ? cpuSumRef.current / sampleCountRef.current : 0;

    // Save logs
    if (logsRef.current.length > 0) {
      setSaving(true);
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        await writeLogFile(
          `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\test-${timestamp}.json`,
          logsRef.current.map((m, i) => ({
            timestamp: Date.now() - (logsRef.current.length - i) * POLL_INTERVAL_MS,
            cpu_temp: m.cpu_temp,
            gpu_temp: m.gpu_temp,
            ram_usage: m.ram_usage,
            event: "auto_test_sample",
          })),
        );
      } catch { /* ignore */ }
      setSaving(false);
    }

    // Evaluate
    try {
      const result = await aiEvaluate(
        cpuMaxRef.current,
        gpuMaxRef.current,
        0,         // benchmarkScore (no auto benchmark)
        0,         // ssdSeqRead
        0,         // ssdSeqWrite
        true,      // ramPass — from checklist (passed through props if available)
        avgCpu,
        elapsed,
        cpuTier as "entry" | "lowmid" | "mid" | "high" | "enthusiast",
        batteryHealth,
        drainRate,
        networkDown,
        networkUp,
        networkLatency,
      );
      onComplete(result, elapsed);
    } catch {
      onComplete({
        score: 0, verdict: "AVOID ❌", recommendation: "AVOID",
        explanations: ["Evaluation failed — check tool paths"],
        metrics: { cpu_temp: cpuMaxRef.current, gpu_temp: gpuMaxRef.current, ram_usage: 0, cpu_usage: avgCpu, ram_total_gb: 0, ram_used_gb: 0, is_mock: false },
        duration_sec: elapsed,
      }, elapsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete, onRunningChange]);

  // Keep finishTestRef updated for timer callback
  useEffect(() => {
    finishTestRef.current = finishTest;
  }, [finishTest]);

  const startTest = async () => {
    // Reset all
    cpuMaxRef.current = 0;
    gpuMaxRef.current = 0;
    cpuSumRef.current = 0;
    sampleCountRef.current = 0;
    logsRef.current = [];
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    setIsComplete(false);
    setSaving(false);

    try {
      await clearLogs();
      await logEvent("AUTO_TEST_START");
    } catch { /* ignore */ }

    // Launch all tools (non-blocking)
    Promise.allSettled([
      runTool("Cinebench", toolPaths),
      runTool("FurMark", toolPaths),
      runTool("MemTest64", toolPaths),
      runTool("CrystalDiskMark", toolPaths),
    ]);

    setIsRunning(true);
    onRunningChange(true);

    // Timer
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= TEST_DURATION_SEC && finishTestRef.current) {
          finishTestRef.current();
        }
        return next;
      });
    }, 1000);

    // Metrics polling
    pollRef.current = setInterval(async () => {
      try {
        const m = await getSystemMetrics();
        logsRef.current.push(m);
        cpuSumRef.current += m.cpu_usage;
        sampleCountRef.current += 1;
        cpuMaxRef.current = Math.max(cpuMaxRef.current, m.cpu_temp);
        gpuMaxRef.current = Math.max(gpuMaxRef.current, m.gpu_temp);
      } catch { /* ignore */ }
    }, POLL_INTERVAL_MS);
  };

  const togglePause = () => {
    if (!isRunning) return;
    if (!isPaused) {
      // Pause: stop timers but keep data
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setIsPaused(true);
    } else {
      // Resume: restart timers
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          const next = prev + 1;
          if (next >= TEST_DURATION_SEC && finishTestRef.current) {
            finishTestRef.current();
          }
          return next;
        });
      }, 1000);
      pollRef.current = setInterval(async () => {
        try {
          const m = await getSystemMetrics();
          logsRef.current.push(m);
          cpuSumRef.current += m.cpu_usage;
          sampleCountRef.current += 1;
          cpuMaxRef.current = Math.max(cpuMaxRef.current, m.cpu_temp);
          gpuMaxRef.current = Math.max(gpuMaxRef.current, m.gpu_temp);
        } catch { /* ignore */ }
      }, POLL_INTERVAL_MS);
      setIsPaused(false);
    }
  };

  const cancelTest = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSec(0);
    onRunningChange(false);

    // Save partial logs
    if (logsRef.current.length > 0) {
      setSaving(true);
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        await writeLogFile(
          `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\test-${timestamp}.json`,
          logsRef.current.map((m, i) => ({
            timestamp: Date.now() - (logsRef.current.length - i) * POLL_INTERVAL_MS,
            cpu_temp: m.cpu_temp,
            gpu_temp: m.gpu_temp,
            ram_usage: m.ram_usage,
            event: "auto_test_cancelled",
          })),
        );
      } catch { /* ignore */ }
      setSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
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

      {/* Timer */}
      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Clock size={18} className={isRunning ? "text-[#f59e0b] animate-pulse" : "text-[#475569]"} />
          <span className="text-3xl font-black metric-value text-[#f1f5f9]">
            {formatTime(remainingSec)}
          </span>
        </div>
        <span className="text-xs text-[#94a3b8]">
          {isPaused ? "Paused" : isRunning ? "Test in progress..." : isComplete ? "Test Complete ✓" : "Ready to start"}
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

      {/* Max temps */}
      {isRunning && (
        <div className="grid grid-cols-2 gap-2">
          <TempBadge label="CPU MAX" value={cpuMaxRef.current} />
          <TempBadge label="GPU MAX" value={gpuMaxRef.current} />
        </div>
      )}

      {/* Control */}
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
          <>
            <motion.button
              onClick={togglePause}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: isPaused
                  ? "linear-gradient(135deg, #f97316, #ef4444)"
                  : "#1a2235",
                color: isPaused ? "#fff" : "#f59e0b",
                boxShadow: isPaused
                  ? "0 0 20px rgba(249,115,22,0.3)"
                  : "0 0 0 1px #f59e0b40",
              }}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
              {isPaused ? "Resume" : "Pause"}
            </motion.button>
            <motion.button
              onClick={cancelTest}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: "#1a2235",
                color: "#ef4444",
                boxShadow: "0 0 0 1px #ef444460",
              }}
            >
              <Square size={16} />
              Stop
            </motion.button>
          </>
        )}
      </div>

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
    <div className="flex items-center justify-between px-3 py-2 rounded-lg"
      style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654" }}>
      <span className="text-xs text-[#94a3b8]">{label}</span>
      <span className="text-sm font-bold metric-value" style={{ color }}>
        {value > 0 ? `${value.toFixed(1)}°C` : "--"}
      </span>
    </div>
  );
}
