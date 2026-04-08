"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Laptop, Activity, ChevronRight } from "lucide-react";
import TestControls from "@/components/TestControls";
import LiveMonitoring from "@/components/LiveMonitoring";
import AIEvaluationPanel from "@/components/AIEvaluationPanel";
import ChecklistPanel from "@/components/ChecklistPanel";
import AutoTestController from "@/components/AutoTestController";
import { exportResultTxt, exportResultJson, type TestResult } from "@/lib/tauri";

export default function Home() {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [cpuMax, setCpuMax] = useState(0);
  const [gpuMax, setGpuMax] = useState(0);
  const [avgCpuUsage, setAvgCpuUsage] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAutoComplete = useCallback((result: TestResult) => {
    setTestResult(result);
    setIsEvaluated(true);
    setIsTestRunning(false);
    showToast("Auto test complete! Run AI evaluation.", "success");
  }, []);

  const handleMetricsUpdate = useCallback(
    (cpu: number, gpu: number, avgCpu: number) => {
      setCpuMax(cpu);
      setGpuMax(gpu);
      setAvgCpuUsage(avgCpu);
    },
    [],
  );

  const handleExportTxt = async () => {
    if (!testResult) {
      showToast("No result to export", "error");
      return;
    }
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportResultTxt(
        `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\result-${timestamp}.txt`,
        testResult,
      );
      showToast("Exported to result.txt", "success");
    } catch {
      showToast("Export failed", "error");
    }
  };

  const handleExportJson = async () => {
    if (!testResult) {
      showToast("No result to export", "error");
      return;
    }
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportResultJson(
        `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\result-${timestamp}.json`,
        testResult,
      );
      showToast("Exported to result.json", "success");
    } catch {
      showToast("Export failed", "error");
    }
  };

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
              Hardware Testing Suite v0.1.0
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
            {/* Test Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <TestControls onToolComplete={() => {}} isAutoRunning={isTestRunning} />
            </motion.div>

            {/* Auto Test */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl p-5"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <AutoTestController
                onComplete={handleAutoComplete}
                onMetricsUpdate={handleMetricsUpdate}
              />
            </motion.div>

            {/* Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-2xl p-5 flex-1"
              style={{ backgroundColor: "#111827", boxShadow: "0 0 0 1px #2a3654, 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              <ChecklistPanel onItemComplete={() => {}} />
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-5">
            {/* Live Monitoring */}
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
              />
            </motion.div>

            {/* AI Evaluation */}
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
                ramPass={true}
                ssdSeqRead={0}
                ssdSeqWrite={0}
                benchmarkScore={0}
                onExportTxt={handleExportTxt}
                onExportJson={handleExportJson}
                isEvaluated={isEvaluated}
              />
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
