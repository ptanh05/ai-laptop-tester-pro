"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, CheckCircle, XCircle, AlertTriangle, Info, Download, Zap, Battery, Wifi } from "lucide-react";
import {
  evaluateScore,
  getScoreColor,
  CPU_TIER_LABELS,
  CPU_TIER_COLORS,
  BENCHMARK_MAX,
  type ScoringInput,
  type ScoreExplanation,
  type CpuTier,
} from "@/lib/ai-scoring";
import { type TestResult } from "@/lib/tauri";

interface Props {
  cpuMax: number;
  gpuMax: number;
  avgCpuUsage: number;
  durationSec: number;
  ramPass: boolean;
  ssdSeqRead: number;
  ssdSeqWrite: number;
  benchmarkScore: number;
  cpuTier: CpuTier;
  batteryHealth: number;
  drainRate: number;
  networkDown: number;
  networkUp: number;
  networkLatency: number;
  onExportTxt: () => void;
  onExportJson: () => void;
  isEvaluated: boolean;
  storedResult: TestResult | null;
  onEvaluate: (result: ReturnType<typeof evaluateScore>) => void;
}

function ExplanationItem({ ex }: { ex: ScoreExplanation }) {
  const icon = {
    CRITICAL: <XCircle size={14} className="flex-shrink-0" />,
    WARNING: <AlertTriangle size={14} className="flex-shrink-0" />,
    CAUTION: <AlertTriangle size={14} className="flex-shrink-0" />,
    MINOR: <Info size={14} className="flex-shrink-0" />,
    GOOD: <CheckCircle size={14} className="flex-shrink-0" />,
    INFO: <Info size={14} className="flex-shrink-0" />,
  };

  const color: Record<string, string> = {
    CRITICAL: "#ef4444",
    WARNING: "#f97316",
    CAUTION: "#f59e0b",
    MINOR: "#94a3b8",
    GOOD: "#22c55e",
    INFO: "#06b6d4",
  };

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span style={{ color: color[ex.type] ?? "#94a3b8", marginTop: 1 }}>{icon[ex.type] ?? icon.INFO}</span>
      <span className="text-sm" style={{ color: "#f1f5f9" }}>{ex.text}</span>
      {ex.delta !== 0 && (
        <span
          className="ml-auto text-xs font-mono font-bold flex-shrink-0 mt-0.5"
          style={{ color: ex.delta < 0 ? "#ef4444" : "#22c55e" }}
        >
          {ex.delta > 0 ? `+${ex.delta}` : ex.delta}
        </span>
      )}
    </div>
  );
}

export default function AIEvaluationPanel({
  cpuMax,
  gpuMax,
  avgCpuUsage,
  durationSec,
  ramPass,
  ssdSeqRead,
  ssdSeqWrite,
  benchmarkScore,
  cpuTier,
  batteryHealth,
  drainRate,
  networkDown,
  networkUp,
  networkLatency,
  onExportTxt,
  onExportJson,
  isEvaluated,
  storedResult,
  onEvaluate,
}: Props) {
  // Manual input overrides (user can tweak)
  const [manualSsdRead, setManualSsdRead] = useState(0);
  const [manualSsdWrite, setManualSsdWrite] = useState(0);
  const [manualBench, setManualBench] = useState(0);
  const [manualBatteryHealth, setManualBatteryHealth] = useState(-1); // -1 = use prop
  const [manualDrainRate, setManualDrainRate] = useState(0);           // 0 = use prop
  const [manualNetDown, setManualNetDown] = useState(0);
  const [manualNetUp, setManualNetUp] = useState(0);
  const [manualNetLatency, setManualNetLatency] = useState(0);
  const [ramStatus, setRamStatus] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  // Sync from auto-test stored result
  useEffect(() => {
    if (storedResult && storedResult.score > 0) {
      setResult({
        score: storedResult.score,
        verdict: storedResult.verdict,
        recommendation: storedResult.recommendation,
        explanations: storedResult.explanations.map((text: string) => ({
          type: "INFO",
          text,
          delta: 0,
        })),
      });
    }
  }, [storedResult]);

  const handleEvaluate = () => {
    // Use manual input if set, otherwise fall back to prop
    const finalBench = manualBench > 0 ? manualBench : benchmarkScore;
    const finalSsdRead = manualSsdRead > 0 ? manualSsdRead : ssdSeqRead;
    const finalSsdWrite = manualSsdWrite > 0 ? manualSsdWrite : ssdSeqWrite;
    const finalBatHealth = manualBatteryHealth >= 0 ? manualBatteryHealth : batteryHealth;
    const finalDrain = manualDrainRate > 0 ? manualDrainRate : drainRate;
    const finalNetDown = manualNetDown > 0 ? manualNetDown : networkDown;
    const finalNetUp = manualNetUp > 0 ? manualNetUp : networkUp;
    const finalNetLat = manualNetLatency > 0 ? manualNetLatency : networkLatency;

    const input: ScoringInput = {
      cpuMaxTemp: cpuMax || 0,
      gpuMaxTemp: gpuMax || 0,
      benchmarkScore: finalBench,
      ssdSeqRead: finalSsdRead,
      ssdSeqWrite: finalSsdWrite,
      ramPass: isEvaluated ? ramPass : ramStatus,
      avgCpuUsage: avgCpuUsage || 0,
      durationSec: durationSec || 0,
      cpuTier: cpuTier || "lowmid",
      batteryHealth: finalBatHealth,
      drainRate: finalDrain,
      networkDownMbps: finalNetDown,
      networkUpMbps: finalNetUp,
      networkLatencyMs: finalNetLat,
    };

    const res = evaluateScore(input);
    setResult(res);
    onEvaluate(res);
  };

  const scoreColor = result ? getScoreColor(result.score) : "#475569";
  const hasAutoData = cpuMax > 0 || gpuMax > 0;
  const tierLabel = CPU_TIER_LABELS[cpuTier] ?? "LOW-MID";
  const tierColor = CPU_TIER_COLORS[cpuTier] ?? "#f59e0b";
  const maxBench = BENCHMARK_MAX[cpuTier] ?? 3000;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Brain size={16} className="text-[#8b5cf6]" />
          AI Evaluation
        </h2>
        <div className="flex items-center gap-2">
          {/* CPU Tier Badge */}
          <span
            className="text-xs px-2.5 py-1 rounded-full font-bold tracking-wider"
            style={{
              backgroundColor: `${tierColor}20`,
              color: tierColor,
              border: `1px solid ${tierColor}40`,
            }}
          >
            {tierLabel}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-[#8b5cf620] text-[#8b5cf6] border border-[#8b5cf640] font-medium">
            Rule-Based AI
          </span>
        </div>
      </div>

      {/* Live data preview */}
      {hasAutoData && !isEvaluated && (
        <div
          className="grid grid-cols-2 gap-2 p-3 rounded-xl"
          style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
        >
          <LiveBadge label="CPU Max" value={cpuMax} unit="°C" color="#ef4444" />
          <LiveBadge label="GPU Max" value={gpuMax} unit="°C" color="#f97316" />
          <LiveBadge label="Avg CPU" value={avgCpuUsage} unit="%" color="#06b6d4" />
          <LiveBadge label="Duration" value={durationSec} unit="s" color="#94a3b8" />
        </div>
      )}

      {/* Tier benchmark reference */}
      <div
        className="flex items-center gap-2 p-3 rounded-xl text-xs"
        style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
      >
        <Zap size={13} className="text-[#94a3b8] flex-shrink-0" />
        <span className="text-[#94a3b8]">Benchmark tier max:</span>
        <span className="text-[#f1f5f9] font-mono font-bold">{maxBench.toLocaleString()}</span>
        <span className="text-[#475569]">(Cinebench R23 multi-core for {tierLabel} tier)</span>
      </div>

      {/* Manual inputs (hidden after auto-test evaluation) */}
      {!isEvaluated && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <InputField
              label="SSD Read (MB/s)"
              value={manualSsdRead}
              onChange={setManualSsdRead}
              placeholder="e.g. 3000"
              icon={<span className="text-xs">SSD R</span>}
            />
            <InputField
              label="SSD Write (MB/s)"
              value={manualSsdWrite}
              onChange={setManualSsdWrite}
              placeholder="e.g. 2000"
              icon={<span className="text-xs">SSD W</span>}
            />
            <InputField
              label={`Benchmark Score (max ${maxBench.toLocaleString()})`}
              value={manualBench}
              onChange={setManualBench}
              placeholder="e.g. 2500"
              icon={<Zap size={12} />}
            />
          </div>

          {/* Battery + Network row */}
          <div className="grid grid-cols-4 gap-2">
            <InputField
              label="Battery Health %"
              value={manualBatteryHealth >= 0 ? manualBatteryHealth : batteryHealth}
              onChange={(v) => setManualBatteryHealth(v)}
              placeholder="e.g. 85"
              icon={<Battery size={12} />}
            />
            <InputField
              label="Drain %/min"
              value={manualDrainRate > 0 ? manualDrainRate : drainRate}
              onChange={(v) => setManualDrainRate(v)}
              placeholder="e.g. 0.5"
              icon={<Battery size={12} />}
            />
            <InputField
              label="Net Down (Mbps)"
              value={manualNetDown > 0 ? manualNetDown : networkDown}
              onChange={(v) => setManualNetDown(v)}
              placeholder="e.g. 100"
              icon={<Wifi size={12} />}
            />
            <InputField
              label="Net Up (Mbps)"
              value={manualNetUp > 0 ? manualNetUp : networkUp}
              onChange={(v) => setManualNetUp(v)}
              placeholder="e.g. 50"
              icon={<Wifi size={12} />}
            />
          </div>
        </div>
      )}

      {/* RAM toggle (hidden after auto-test) */}
      {!isEvaluated && (
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}>
          <span className="text-sm text-[#94a3b8]">RAM Test Result:</span>
          <button
            onClick={() => setRamStatus(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: ramStatus ? "#22c55e20" : "#111827",
              color: ramStatus ? "#22c55e" : "#475569",
              border: ramStatus ? "1px solid #22c55e60" : "1px solid #2a3654",
            }}
          >
            <CheckCircle size={12} /> Pass
          </button>
          <button
            onClick={() => setRamStatus(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: !ramStatus ? "#ef444420" : "#111827",
              color: !ramStatus ? "#ef4444" : "#475569",
              border: !ramStatus ? "1px solid #ef444460" : "1px solid #2a3654",
            }}
          >
            <XCircle size={12} /> Fail
          </button>
        </div>
      )}

      {/* Evaluate Button */}
      <motion.button
        onClick={handleEvaluate}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        style={{
          background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
          color: "#fff",
          boxShadow: "0 0 20px rgba(139,92,246,0.25)",
        }}
      >
        <Brain size={16} />
        {isEvaluated ? "View Evaluation" : "Run AI Evaluation"}
      </motion.button>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Score Circle + Verdict */}
            <div className="flex flex-col items-center py-4 gap-3" style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654", borderRadius: "12px" }}>
              <div className="relative">
                <svg width="120" height="120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#111827" strokeWidth="10" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - result.score / 100) }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="text-3xl font-black metric-value"
                    style={{ color: scoreColor }}
                  >
                    {result.score.toFixed(1)}
                  </motion.span>
                  <span className="text-xs text-[#475569]">/100</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className="text-lg font-bold px-4 py-1.5 rounded-full"
                  style={{
                    backgroundColor: `${scoreColor}20`,
                    color: scoreColor,
                    border: `1px solid ${scoreColor}60`,
                  }}
                >
                  {result.verdict}
                </span>
                <span
                  className="text-sm font-semibold px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      result.recommendation === "BUY"
                        ? "#22c55e20"
                        : result.recommendation === "CONSIDER"
                          ? "#f59e0b20"
                          : "#ef444420",
                    color:
                      result.recommendation === "BUY"
                        ? "#22c55e"
                        : result.recommendation === "CONSIDER"
                          ? "#f59e0b"
                          : "#ef4444",
                    border: `1px solid ${
                      result.recommendation === "BUY"
                        ? "#22c55e60"
                        : result.recommendation === "CONSIDER"
                          ? "#f59e0b60"
                          : "#ef444460"
                    }`,
                  }}
                >
                  {result.recommendation}
                </span>
              </div>

              {/* CPU Tier + Benchmark reference in result */}
              <div className="flex items-center gap-3 text-xs">
                <span
                  className="px-2 py-0.5 rounded-full font-bold"
                  style={{
                    backgroundColor: `${tierColor}20`,
                    color: tierColor,
                    border: `1px solid ${tierColor}40`,
                  }}
                >
                  {tierLabel}
                </span>
                <span className="text-[#475569]">Benchmark max: <span className="text-[#94a3b8] font-mono">{maxBench.toLocaleString()}</span></span>
              </div>
            </div>

            {/* Explanations */}
            <div
              className="mt-3 p-4 rounded-xl"
              style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
            >
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                AI Analysis
              </div>
              <div>
                {result.explanations.map((ex: ScoreExplanation, i: number) => (
                  <ExplanationItem key={i} ex={ex} />
                ))}
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2 mt-3">
              <motion.button
                onClick={onExportTxt}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: "#1a2235", color: "#94a3b8", boxShadow: "0 0 0 1px #2a3654" }}
              >
                <Download size={14} />
                Export TXT
              </motion.button>
              <motion.button
                onClick={onExportJson}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: "#1a2235", color: "#94a3b8", boxShadow: "0 0 0 1px #2a3654" }}
              >
                <Download size={14} />
                Export JSON
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#94a3b8] font-medium flex items-center gap-1">
        {icon}
        {label}
      </label>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f640] transition-all placeholder:text-[#475569] font-mono"
      />
    </div>
  );
}

function LiveBadge({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#94a3b8]">{label}</span>
      <span className="text-sm font-bold metric-value" style={{ color }}>
        {value > 0 ? `${value.toFixed(1)}${unit}` : "--"}
      </span>
    </div>
  );
}