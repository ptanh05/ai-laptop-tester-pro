"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Laptop, Activity, ChevronRight } from "lucide-react";
import TestControls from "@/components/TestControls";
import LiveMonitoring from "@/components/LiveMonitoring";
import AIEvaluationPanel from "@/components/AIEvaluationPanel";
import ChecklistPanel from "@/components/ChecklistPanel";
import AutoTestController from "@/components/AutoTestController";
import {
  exportResultTxt,
  exportResultJson,
  getSystemInfo,
  type TestResult,
  type SystemMetrics,
  type CpuTier,
  TOOL_PATHS,
} from "@/lib/tauri";
import SystemInfoPanel from "@/components/SystemInfoPanel";
import SettingsPanel from "@/components/SettingsPanel";
import UserPreferencesPanel from "@/components/UserPreferencesPanel";
import NetworkSpeedTest from "@/components/NetworkSpeedTest";
import HardwareFingerprint from "@/components/HardwareFingerprint";
import TestHistoryPanel from "@/components/TestHistoryPanel";
import TestComparisonPanel from "@/components/TestComparisonPanel";
import HistoryChartsPanel from "@/components/HistoryChartsPanel";
import NotificationPanel, {
  sendTestCompleteNotification,
  sendThermalAlert,
} from "@/components/NotificationPanel";
import BenchmarkImportPanel from "@/components/BenchmarkImportPanel";
import { saveTestToHistory } from "@/lib/test-history";
import { generatePDFReport } from "@/lib/pdf-export";

const STORAGE_KEY = "ai-laptop-tester-paths";

function loadToolPaths(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...TOOL_PATHS };
}

export default function Home() {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [cpuMax, setCpuMax] = useState(0);
  const [gpuMax, setGpuMax] = useState(0);
  const [avgCpuUsage, setAvgCpuUsage] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [toolPaths, setToolPaths] = useState<Record<string, string>>(loadToolPaths);
  const [checklistState, setChecklistState] = useState<Record<string, "pending" | "pass" | "fail">>({
    cpu: "pending",
    gpu: "pending",
    ram: "pending",
    ssd: "pending",
    thermal: "pending",
  });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Tier-aware scoring state ──────────────────────────────────────────────
  const [cpuTier, setCpuTier] = useState<CpuTier>("lowmid");
  const [batteryHealth, setBatteryHealth] = useState(-1);
  const [drainRate, setDrainRate] = useState(0);
  const [networkDown, setNetworkDown] = useState(0);
  const [networkUp, setNetworkUp] = useState(0);
  const [networkLatency, setNetworkLatency] = useState(0);
  const [systemInfo, setSystemInfo] = useState<{ cpu: string; gpu: string; ram: string } | null>(null);

  // ── Benchmark scores ──────────────────────────────────────────────────────
  const [benchmarkScore, setBenchmarkScore] = useState(0);
  const [ssdSeqRead, setSsdSeqRead] = useState(0);
  const [ssdSeqWrite, setSsdSeqWrite] = useState(0);

  // Load system info on mount
  useEffect(() => {
    getSystemInfo()
      .then((info) => {
        setCpuTier((info.cpu_tier as CpuTier) || "lowmid");
        setBatteryHealth(info.battery.health_pct ?? -1);
        setSystemInfo({
          cpu: info.cpu_model,
          gpu: info.gpu_model,
          ram: `${info.ram_total_gb.toFixed(1)} GB`,
        });
      })
      .catch(() => {
        // fallback silently
      });
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSettingsSave = useCallback((paths: Record<string, string>) => {
    setToolPaths(paths);
    showToast("Tool paths updated!", "success");
  }, []);

  const handleToolComplete = useCallback((toolId: string, passed: boolean) => {
    const idMap: Record<string, keyof typeof checklistState> = {
      Cinebench: "cpu",
      FurMark: "gpu",
      MemTest64: "ram",
      CrystalDiskMark: "ssd",
    };
    const checkId = idMap[toolId];
    if (checkId) {
      setChecklistState((prev) => ({ ...prev, [checkId]: passed ? "pass" : "fail" }));
    }
  }, []);

  const handleChecklistUpdate = useCallback((id: string, status: "pending" | "pass" | "fail") => {
    setChecklistState((prev) => ({ ...prev, [id]: status }));
  }, []);

  const handleAutoComplete = useCallback(async (result: TestResult, elapsed: number) => {
    setTestResult(result);
    setDurationSec(elapsed);
    setIsEvaluated(true);
    setIsTestRunning(false);
    setChecklistState((prev) => ({
      ...prev,
      thermal: result.metrics.cpu_temp > 95 || result.metrics.gpu_temp > 85 ? "fail" : "pass",
    }));
    showToast(`Auto test done! Score: ${result.score}/100 — ${result.verdict}`, "success");

    // Send notification
    sendTestCompleteNotification(result.score, result.verdict);

    // Save to history
    if (systemInfo) {
      saveTestToHistory(result, systemInfo);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\result-${timestamp}`;
    try {
      await exportResultTxt(`${dir}.txt`, result);
      await exportResultJson(`${dir}.json`, result);
      showToast("Results auto-exported to Documents/AI-Laptop-Tester/", "success");
    } catch (e) {
      // silent fail
    }
  }, [systemInfo]);

  const handleNetworkResult = useCallback((down: number, up: number, latency: number) => {
    setNetworkDown(down);
    setNetworkUp(up);
    setNetworkLatency(latency);
  }, []);

  const handleBenchmarkResult = useCallback((
    cinebenchScore: number,
    diskRead: number,
    diskWrite: number
  ) => {
    if (cinebenchScore > 0) {
      setBenchmarkScore(cinebenchScore);
      showToast(`Cinebench score imported: ${cinebenchScore}`, "success");
    }
    if (diskRead > 0 || diskWrite > 0) {
      setSsdSeqRead(diskRead);
      setSsdSeqWrite(diskWrite);
      showToast(`Disk speeds imported: ${diskRead.toFixed(0)}/${diskWrite.toFixed(0)} MB/s`, "success");
    }
  }, []);

  const handleExportTxt = useCallback(async () => {
    const result = testResult;
    if (!result) { showToast("No result to export", "error"); return; }
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportResultTxt(
        `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\result-${timestamp}.txt`,
        result,
      );
      showToast("Exported to Documents/AI-Laptop-Tester/", "success");
    } catch (e) {
      showToast(`Export failed: ${e}`, "error");
    }
  }, [testResult]);

  const handleExportJson = useCallback(async () => {
    const result = testResult;
    if (!result) { showToast("No result to export", "error"); return; }
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportResultJson(
        `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\result-${timestamp}.json`,
        result,
      );
      showToast("Exported to Documents/AI-Laptop-Tester/", "success");
    } catch (e) {
      showToast(`Export failed: ${e}`, "error");
    }
  }, [testResult]);

  const handleExportPdf = useCallback(() => {
    const result = testResult;
    if (!result || !systemInfo) {
      showToast("No result to export", "error");
      return;
    }
    try {
      generatePDFReport(result, systemInfo);
      showToast("PDF report opened in new window", "success");
    } catch (e) {
      showToast(`PDF export failed: ${e}`, "error");
    }
  }, [testResult, systemInfo]);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: "#0a0e1a" }}>
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ backgroundColor: "#111827", borderColor: "#2a3654" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              boxShadow: "0 0 20px rgba(59,130,246,0.3)",
            }}
          >
            <Laptop size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#f1f5f9] tracking-tight leading-none">
              AI Laptop Tester Pro
            </h1>
            <p className="text-xs text-[#475569] mt-0.5">
              Hardware Testing Suite — Tier-Aware Scoring v2
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isTestRunning ? "bg-[#22c55e] animate-pulse" : "bg-[#475569]"}`}
            />
            <span className="text-xs text-[#94a3b8]">
              {isTestRunning ? "Test Running" : "Idle"}
            </span>
          </div>
          <ChevronRight size={14} className="text-[#475569]" />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-12 gap-5">

          {/* Left Column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <SystemInfoPanel />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <TestControls
                onToolComplete={handleToolComplete}
                isAutoRunning={isTestRunning}
                toolPaths={toolPaths}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <SettingsPanel onSave={handleSettingsSave} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <UserPreferencesPanel />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <AutoTestController
                onComplete={handleAutoComplete}
                onRunningChange={setIsTestRunning}
                toolPaths={toolPaths}
                cpuTier={cpuTier}
                batteryHealth={batteryHealth}
                drainRate={drainRate}
                networkDown={networkDown}
                networkUp={networkUp}
                networkLatency={networkLatency}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-2xl p-5 flex-1"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <ChecklistPanel
                onItemComplete={() => {}}
                statuses={checklistState}
                onUpdate={handleChecklistUpdate}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <HardwareFingerprint />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <NotificationPanel />
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <LiveMonitoring
                isTestRunning={isTestRunning}
                onMaxUpdate={(cpu, gpu) => {
                  setCpuMax((prev) => Math.max(prev, cpu));
                  setGpuMax((prev) => Math.max(prev, gpu));
                }}
                onMetricsUpdate={(m: SystemMetrics) => {
                  setAvgCpuUsage(m.cpu_usage);
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <NetworkSpeedTest onResult={handleNetworkResult} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <BenchmarkImportPanel onResult={handleBenchmarkResult} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <AIEvaluationPanel
                cpuMax={cpuMax}
                gpuMax={gpuMax}
                avgCpuUsage={avgCpuUsage}
                durationSec={durationSec}
                ramPass={checklistState.ram !== "fail"}
                ssdSeqRead={ssdSeqRead}
                ssdSeqWrite={ssdSeqWrite}
                benchmarkScore={benchmarkScore}
                cpuTier={cpuTier}
                batteryHealth={batteryHealth}
                drainRate={drainRate}
                networkDown={networkDown}
                networkUp={networkUp}
                networkLatency={networkLatency}
                onExportTxt={handleExportTxt}
                onExportJson={handleExportJson}
                onExportPdf={handleExportPdf}
                isEvaluated={isEvaluated}
                storedResult={testResult}
                onEvaluate={(result: ReturnType<typeof import("@/lib/ai-scoring").evaluateScore>) => {
                  const newResult = {
                    score: result.score,
                    verdict: result.verdict,
                    recommendation: result.recommendation,
                    explanations: result.explanations.map(e => e.text),
                    metrics: {
                      cpu_temp: cpuMax,
                      gpu_temp: gpuMax,
                      ram_usage: 0,
                      cpu_usage: avgCpuUsage,
                      ram_total_gb: 0,
                      ram_used_gb: 0,
                      is_mock: false,
                    },
                    duration_sec: durationSec,
                  };
                  setTestResult(newResult);

                  // Save to history
                  if (systemInfo) {
                    saveTestToHistory(newResult, systemInfo);
                  }
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <TestHistoryPanel />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <TestComparisonPanel />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <HistoryChartsPanel />
            </motion.div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-50 flex items-center gap-2"
          style={{
            backgroundColor: toast.type === "success" ? "#1a2235" : "#2d1515",
            color: toast.type === "success" ? "#22c55e" : "#ef4444",
            border: `1px solid ${toast.type === "success" ? "#22c55e40" : "#ef444440"}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <Activity size={14} />
          {toast.msg}
        </motion.div>
      )}
    </div>
  );
}
