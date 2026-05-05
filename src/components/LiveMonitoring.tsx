"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Thermometer,
  Cpu,
  HardDrive,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getSystemMetrics, type SystemMetrics } from "@/lib/tauri";
import { getTempColor, getTempLabel } from "@/lib/ai-scoring";
import { sendThermalAlert, loadNotificationSettings } from "./NotificationPanel";

interface MetricHistory {
  cpuTemp: number[];
  gpuTemp: number[];
  ramUsage: number[];
}

interface LiveMonitoringProps {
  isTestRunning: boolean;
  onMaxUpdate: (cpuMax: number, gpuMax: number) => void;
  onMetricsUpdate: (metrics: SystemMetrics) => void;
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  maxValue,
  maxUnit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  maxValue?: number;
  maxUnit?: string;
  color: string;
}) {
  const [prevValue, setPrevValue] = useState(value);
  const trend = value > prevValue ? "up" : value < prevValue ? "down" : "flat";

  useEffect(() => {
    const timer = setTimeout(() => setPrevValue(value), 150);
    return () => clearTimeout(timer);
  }, [value]);

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : "#475569";
  const isTemp = unit === "°C";
  const barPct = isTemp ? Math.min(100, (value / 105) * 100) : Math.min(100, value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-xl p-4 overflow-hidden"
      style={{
        backgroundColor: "#1a2235",
        boxShadow: "0 0 0 1px #2a3654, 0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {/* Left color bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ backgroundColor: color }} />

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div style={{ color }}>{icon}</div>
          <span className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <TrendIcon size={12} style={{ color: trendColor }} />
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-1 mb-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={Math.round(value * 10)}
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -6, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="text-2xl font-black metric-value"
            style={{ color }}
          >
            {value.toFixed(1)}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm text-[#94a3b8]">{unit}</span>

        {/* Max badge */}
        {maxValue !== undefined && maxValue > 0 && (
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono"
            style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
          >
            MAX {maxValue.toFixed(1)}{maxUnit}
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#111827" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Status */}
      <div className="mt-2 text-xs font-semibold" style={{ color }}>
        {isTemp ? getTempLabel(value) : "ACTIVE"}
      </div>
    </motion.div>
  );
}

export default function LiveMonitoring({ isTestRunning, onMaxUpdate, onMetricsUpdate }: LiveMonitoringProps) {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu_temp: 0, gpu_temp: 0, ram_usage: 0, cpu_usage: 0,
    ram_total_gb: 0, ram_used_gb: 0, is_mock: false,
  });
  const [history, setHistory] = useState<MetricHistory>({ cpuTemp: [], gpuTemp: [], ramUsage: [] });
  const [isMock, setIsMock] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [lastAlertTime, setLastAlertTime] = useState(0);

  // Use refs for max tracking to avoid stale closures
  const cpuMaxRef = useRef(0);
  const gpuMaxRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const m = await getSystemMetrics();
      setMetrics(m);
      setIsMock(m.is_mock);
      setPollCount((c) => c + 1);
      onMetricsUpdate(m);

      // Update refs and call max update
      const newCpuMax = Math.max(cpuMaxRef.current, m.cpu_temp);
      const newGpuMax = Math.max(gpuMaxRef.current, m.gpu_temp);
      cpuMaxRef.current = newCpuMax;
      gpuMaxRef.current = newGpuMax;

      if (newCpuMax > 0 || newGpuMax > 0) {
        onMaxUpdate(newCpuMax, newGpuMax);
      }

      // Check thermal alert (throttle to once per minute)
      const now = Date.now();
      if (now - lastAlertTime > 60000) {
        const settings = loadNotificationSettings();
        if (settings.enabled && settings.thermalAlert) {
          if (m.cpu_temp >= settings.temperatureThreshold || m.gpu_temp >= settings.temperatureThreshold) {
            sendThermalAlert(m.cpu_temp, m.gpu_temp);
            setLastAlertTime(now);
          }
        }
      }

      setHistory((h) => ({
        cpuTemp: [...h.cpuTemp.slice(-59), m.cpu_temp],
        gpuTemp: [...h.gpuTemp.slice(-59), m.gpu_temp],
        ramUsage: [...h.ramUsage.slice(-59), m.ram_usage],
      }));
    } catch {
      // ignore
    }
  }, [onMaxUpdate, onMetricsUpdate, lastAlertTime]);

  useEffect(() => {
    // Poll immediately on mount, then every 2 seconds
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll]);

  const cpuColor = getTempColor(metrics.cpu_temp);
  const gpuColor = getTempColor(metrics.gpu_temp);
  const ramColor = metrics.ram_usage > 90 ? "#ef4444" : metrics.ram_usage > 70 ? "#f59e0b" : "#22c55e";
  const cpuUsageColor = metrics.cpu_usage > 90 ? "#ef4444" : metrics.cpu_usage > 70 ? "#f59e0b" : "#22c55e";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Activity size={16} className="text-[#06b6d4]" />
          Live Monitoring
        </h2>
        <div className="flex items-center gap-3">
          {/* Mock data warning */}
          {isMock && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
              style={{ backgroundColor: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}
            >
              <AlertTriangle size={11} />
              ESTIMATED
            </motion.div>
          )}
          {/* Live dot */}
          <div
            className={`w-2 h-2 rounded-full ${
              pollCount > 0 ? "bg-[#22c55e] animate-pulse" : "bg-[#475569]"
            }`}
          />
          <span className="text-xs text-[#94a3b8]">{isTestRunning ? "Test Running" : "Live"}</span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="CPU Temp" value={metrics.cpu_temp} unit="°C"
          icon={<Thermometer size={14} />} maxValue={cpuMaxRef.current} maxUnit="°C" color={cpuColor} />
        <MetricCard label="GPU Temp" value={metrics.gpu_temp} unit="°C"
          icon={<Thermometer size={14} />} maxValue={gpuMaxRef.current} maxUnit="°C" color={gpuColor} />
        <MetricCard label="RAM Usage" value={metrics.ram_usage} unit="%"
          icon={<Cpu size={14} />} color={ramColor} />
        <MetricCard label="CPU Usage" value={metrics.cpu_usage} unit="%"
          icon={<HardDrive size={14} />} color={cpuUsageColor} />
      </div>

      {/* System info strip */}
      {metrics.ram_total_gb > 0 && (
        <div
          className="flex items-center gap-4 px-4 py-2 rounded-lg text-xs text-[#94a3b8]"
          style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
        >
          <span>RAM: <strong className="text-[#f1f5f9]">{metrics.ram_used_gb.toFixed(1)} / {metrics.ram_total_gb.toFixed(1)} GB</strong></span>
          <span className="text-[#2a3654]">|</span>
          <span>CPU: <strong className="text-[#f1f5f9]">{metrics.cpu_usage.toFixed(0)}%</strong></span>
          <span className="text-[#2a3654]">|</span>
          <span>Updated: <strong className="text-[#f1f5f9]">{(pollCount * 2)}s</strong> ago</span>
          {isMock && (
            <>
              <span className="text-[#2a3654]">|</span>
              <span style={{ color: "#f59e0b" }}>⚠️ Temp = estimated (WMI unavailable)</span>
            </>
          )}
        </div>
      )}

      {/* Temperature Chart */}
      {history.cpuTemp.length > 3 && (
        <div className="rounded-xl p-3" style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}>
          <div className="text-xs text-[#94a3b8] mb-2 font-medium">Temperature Trend</div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={history.cpuTemp.map((cpu, i) => ({ t: i, cpu, gpu: history.gpuTemp[i] ?? 0 }))}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 110]} hide width={0} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #2a3654",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#f1f5f9",
                }}
                labelStyle={{ display: "none" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}°C`, name === "cpu" ? "CPU" : "GPU"]}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke={cpuColor}
                strokeWidth={2}
                dot={false}
                name="cpu"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="gpu"
                stroke={gpuColor}
                strokeWidth={2}
                dot={false}
                name="gpu"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1">
            <span className="text-xs" style={{ color: cpuColor }}>● CPU</span>
            <span className="text-xs" style={{ color: gpuColor }}>● GPU</span>
          </div>
        </div>
      )}
    </div>
  );
}

// kept for reference
function _Sparkline({ data, color, label }: { data: number[]; color: string; label: string }) {
  if (data.length < 2) return null;
  const W = 200, H = 32;
  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs text-[#475569] w-6 font-mono">{label}</span>
      <svg width={W} height={H} className="flex-1">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
      </svg>
      <span className="text-xs font-mono w-14 text-right" style={{ color }}>
        {data[data.length - 1].toFixed(1)}°C
      </span>
    </div>
  );
}
