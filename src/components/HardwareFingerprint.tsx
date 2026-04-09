"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan, FileUp, FileDown, AlertTriangle, CheckCircle, XCircle, Info, Wifi, HardDrive, Cpu, MemoryStick, Battery, Monitor, Hash } from "lucide-react";
import {
  getHardwareFingerprint,
  saveFingerprint,
  importFingerprint,
  compareFingerprint,
  type HardwareFingerprint,
  type FingerprintCompare,
  type ChangeItem,
} from "@/lib/tauri";

const APPDATA_PATH = `C:\\Users\\anh01\\AppData\\Roaming\\ai-laptop-tester\\hardware-baseline.json`;

type PanelState = "idle" | "capturing" | "comparing" | "importing" | "result";

export default function HardwareFingerprint() {
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [baseline, setBaseline] = useState<HardwareFingerprint | null>(null);
  const [current, setCurrent] = useState<HardwareFingerprint | null>(null);
  const [compareResult, setCompareResult] = useState<FingerprintCompare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const captureBaseline = async () => {
    setError(null);
    setPanelState("capturing");
    try {
      const fp = await getHardwareFingerprint();
      await saveFingerprint(APPDATA_PATH);
      setBaseline(fp);
      setCurrent(fp);
      setPanelState("result");
    } catch (e: unknown) {
      setError(`Capture failed: ${e}`);
      setPanelState("idle");
    }
  };

  const handleCompare = async () => {
    if (!baseline) {
      setError("No baseline saved. Please capture baseline first.");
      return;
    }
    setError(null);
    setPanelState("comparing");
    try {
      const now = await getHardwareFingerprint();
      setCurrent(now);
      const result = await compareFingerprint(baseline, now);
      setCompareResult(result);
      setPanelState("result");
    } catch (e: unknown) {
      setError(`Compare failed: ${e}`);
      setPanelState("idle");
    }
  };

  const handleImport = async () => {
    setError(null);
    setPanelState("importing");
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setPanelState("idle"); return; }
    try {
      // Read file content
      const text = await file.text();
      const imported: HardwareFingerprint = JSON.parse(text);
      setBaseline(imported);
      setPanelState("idle");
    } catch (e: unknown) {
      setError(`Import failed: ${e}`);
      setPanelState("idle");
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = async () => {
    if (!current) return;
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const path = `C:\\Users\\anh01\\Documents\\AI-Laptop-Tester\\fingerprint-${timestamp}.json`;
      await saveFingerprint(path);
      alert(`Exported to:\n${path}`);
    } catch (e: unknown) {
      setError(`Export failed: ${e}`);
    }
  };

  const hasBaseline = baseline !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Scan size={16} className="text-[#06b6d4]" />
          Hardware Fingerprint
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-[#06b6d420] text-[#06b6d4] border border-[#06b6d440] font-medium">
          Tamper Detection
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Status bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
      >
        {hasBaseline ? (
          <>
            <CheckCircle size={12} className="text-[#22c55e]" />
            <span className="text-[#94a3b8]">Baseline saved:</span>
            <span className="text-[#f1f5f9] font-medium">{baseline?.hostname}</span>
            <span className="text-[#475569] ml-auto">{baseline?.captured_at}</span>
          </>
        ) : (
          <>
            <Info size={12} className="text-[#94a3b8]" />
            <span className="text-[#94a3b8]">No baseline. Capture or import one to begin.</span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          icon={<Scan size={14} />}
          label={panelState === "capturing" ? "Capturing..." : "Capture Baseline"}
          color="#06b6d4"
          onClick={captureBaseline}
          disabled={panelState !== "idle" && panelState !== "result"}
          loading={panelState === "capturing"}
        />
        <ActionButton
          icon={<AlertTriangle size={14} />}
          label={panelState === "comparing" ? "Comparing..." : "Compare Now"}
          color="#f59e0b"
          onClick={handleCompare}
          disabled={!hasBaseline || (panelState !== "idle" && panelState !== "result")}
          loading={panelState === "comparing"}
        />
        <ActionButton
          icon={<FileUp size={14} />}
          label="Import JSON"
          color="#8b5cf6"
          onClick={handleImport}
          disabled={panelState === "capturing" || panelState === "comparing"}
        />
        <ActionButton
          icon={<FileDown size={14} />}
          label="Export Current"
          color="#22c55e"
          onClick={handleExport}
          disabled={!current}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-[#ef4444] bg-[#ef444415] border border-[#ef444440] rounded-lg px-3 py-2"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {panelState === "result" && compareResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            {/* Verdict Banner */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{
                backgroundColor:
                  compareResult.verdict === "MATCH ✅"
                    ? "#22c55e15"
                    : compareResult.verdict === "CHANGED ⚠️"
                      ? "#f59e0b15"
                      : "#ef444415",
                border: `1px solid ${
                  compareResult.verdict === "MATCH ✅"
                    ? "#22c55e40"
                    : compareResult.verdict === "CHANGED ⚠️"
                      ? "#f59e0b40"
                      : "#ef444440"
                }`,
              }}
            >
              <div>
                <div
                  className="text-lg font-black"
                  style={{
                    color:
                      compareResult.verdict === "MATCH ✅"
                        ? "#22c55e"
                        : compareResult.verdict === "CHANGED ⚠️"
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                >
                  {compareResult.verdict}
                </div>
                <div className="text-xs text-[#94a3b8] mt-0.5">
                  {compareResult.changes.length === 0
                    ? "All components match baseline perfectly"
                    : `${compareResult.changes.length} change(s) detected`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-[#f1f5f9]">{compareResult.match_pct.toFixed(1)}%</div>
                <div className="text-xs text-[#94a3b8]">Match</div>
                <div className="mt-1 h-2 w-24 rounded-full overflow-hidden" style={{ backgroundColor: "#111827" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${compareResult.match_pct}%`,
                      backgroundColor:
                        compareResult.match_pct >= 90
                          ? "#22c55e"
                          : compareResult.match_pct >= 70
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Changes List */}
            {compareResult.changes.length > 0 && (
              <div
                className="flex flex-col gap-1.5 p-3 rounded-xl max-h-60 overflow-y-auto"
                style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
              >
                {compareResult.changes.map((change, i) => (
                  <ChangeRow key={i} change={change} />
                ))}
              </div>
            )}

            {/* Component summary when no changes */}
            {compareResult.changes.length === 0 && baseline && (
              <div
                className="flex flex-col gap-2 p-3 rounded-xl"
                style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
              >
                <SummaryRow icon={<Cpu size={13} />} label="CPU" value={current?.cpu_model ?? "N/A"} />
                <SummaryRow icon={<MemoryStick size={13} />} label="RAM" value={`${current?.ram_total_gb.toFixed(1) ?? "?"} GB (${current?.ram_slots.length ?? 0} slots)`} />
                <SummaryRow icon={<HardDrive size={13} />} label="Storage" value={`${current?.disks.length ?? 0} disk(s)`} />
                <SummaryRow icon={<Monitor size={13} />} label="GPU" value={current?.gpu_name ?? "N/A"} />
                <SummaryRow icon={<Battery size={13} />} label="Battery" value={current?.battery_serial ? `${current.battery_model} (${current.battery_health_pct.toFixed(0)}%)` : "No Battery"} />
                <SummaryRow icon={<Hash size={13} />} label="UUID" value={current?.smbios_uuid ?? "N/A"} />
                <SummaryRow icon={<Wifi size={13} />} label="MAC" value={current?.mac_addresses.join(", ") ?? "N/A"} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  color,
  onClick,
  disabled,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  disabled: boolean;
  loading?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {loading ? (
        <span className="animate-pulse">{icon}</span>
      ) : (
        icon
      )}
      {label}
    </motion.button>
  );
}

function ChangeRow({ change }: { change: ChangeItem }) {
  const severityColor =
    change.severity === "CRITICAL"
      ? "#ef4444"
      : change.severity === "WARNING"
        ? "#f59e0b"
        : "#06b6d4";

  const severityIcon =
    change.severity === "CRITICAL" ? (
      <XCircle size={12} />
    ) : change.severity === "WARNING" ? (
      <AlertTriangle size={12} />
    ) : (
      <Info size={12} />
    );

  const categoryIcon = {
    CPU: <Cpu size={11} />,
    RAM: <MemoryStick size={11} />,
    GPU: <Monitor size={11} />,
    Storage: <HardDrive size={11} />,
    Battery: <Battery size={11} />,
    BIOS: <Hash size={11} />,
    Motherboard: <Hash size={11} />,
    Network: <Wifi size={11} />,
  }[change.category] ?? <Info size={11} />;

  return (
    <div
      className="flex items-start gap-2 py-2 px-2 rounded-lg"
      style={{ backgroundColor: "#111827" }}
    >
      <span style={{ color: severityColor, marginTop: 1, flexShrink: 0 }}>{severityIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span style={{ color: "#94a3b8" }}>{categoryIcon}</span>
          <span className="text-xs font-semibold text-[#f1f5f9]">{change.category}</span>
          <span className="text-xs text-[#475569]">—</span>
          <span className="text-xs text-[#94a3b8]">{change.field}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#ef4444] font-mono line-through truncate max-w-[120px]">{change.old_value || "(empty)"}</span>
          <span className="text-[#475569] flex-shrink-0">→</span>
          <span className="text-[#22c55e] font-mono truncate">{change.new_value || "(empty)"}</span>
        </div>
      </div>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
        style={{
          backgroundColor: `${severityColor}20`,
          color: severityColor,
        }}
      >
        {change.severity}
      </span>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: "#475569", flexShrink: 0 }}>{icon}</span>
      <span className="text-xs text-[#94a3b8] w-16 flex-shrink-0">{label}</span>
      <span className="text-xs text-[#f1f5f9] font-medium truncate" title={value}>{value}</span>
    </div>
  );
}