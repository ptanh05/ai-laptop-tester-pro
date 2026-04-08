"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Thermometer, Cpu, HardDrive, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getSystemMetrics, type SystemMetrics } from "@/lib/tauri";
import { getTempColor, getTempLabel } from "@/lib/ai-scoring";

interface MetricHistory {
  cpuTemp: number[];
  gpuTemp: number[];
  ramUsage: number[];
  timestamps: number[];
}

interface LiveMonitoringProps {
  isTestRunning: boolean;
  onMaxUpdate: (cpuMax: number, gpuMax: number) => void;
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  maxValue,
  maxUnit,
  color,
  history = [],
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  maxValue?: number;
  maxUnit?: string;
  color: string;
  history?: number[];
}) {
  const [prevValue, setPrevValue] = useState(value);
  const trend = value > prevValue ? "up" : value < prevValue ? "down" : "flat";

  useEffect(() => {
    const timer = setTimeout(() => setPrevValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const TrendIcon =
    trend === "up"
      ? TrendingUp
      : trend === "down"
        ? TrendingDown
        : Minus;
  const trendColor =
    trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : "#475569";

  const isTemp = unit === "°C";
  const barPct = isTemp ? Math.min(100, (value / 105) * 100) : Math.min(100, value);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-xl p-4 overflow-hidden"
      style={{
        backgroundColor: "#1a2235",
        boxShadow: "0 0 0 1px #2a3654, 0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {/* Color accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div style={{ color }}>{icon}</div>
          <span className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1" style={{ color: trendColor }}>
          <TrendIcon size={12} />
        </div>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1 mb-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={Math.round(value)}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-2xl font-bold metric-value"
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
            style={{
              backgroundColor: `${color}20`,
              color,
              border: `1px solid ${color}40`,
            }}
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
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Label */}
      <div className="mt-2 text-xs font-medium" style={{ color }}>
        {isTemp ? getTempLabel(value) : "ACTIVE"}
      </div>
    </motion.div>
  );
}

export default function LiveMonitoring({ isTestRunning, onMaxUpdate }: LiveMonitoringProps) {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu_temp: 0,
    gpu_temp: 0,
    ram_usage: 0,
    cpu_usage: 0,
    ram_total_gb: 0,
    ram_used_gb: 0,
  });
  const [history, setHistory] = useState<MetricHistory>({
    cpuTemp: [],
    gpuTemp: [],
    ramUsage: [],
    timestamps: [],
  });
  const [maxCpuTemp, setMaxCpuTemp] = useState(0);
  const [maxGpuTemp, setMaxGpuTemp] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Always poll metrics when component is mounted — no need to press Start
    intervalRef.current = setInterval(async () => {
      try {
        const m = await getSystemMetrics();
        setMetrics(m);

        setMaxCpuTemp((prev) => {
          const next = Math.max(prev, m.cpu_temp);
          if (next !== prev) onMaxUpdate(next, maxGpuTemp);
          return next;
        });
        setMaxGpuTemp((prev) => {
          const next = Math.max(prev, m.gpu_temp);
          if (next !== prev) onMaxUpdate(maxCpuTemp, next);
          return next;
        });

        setHistory((h) => {
          const MAX_HIST = 60;
          return {
            cpuTemp: [...h.cpuTemp.slice(-(MAX_HIST - 1)), m.cpu_temp],
            gpuTemp: [...h.gpuTemp.slice(-(MAX_HIST - 1)), m.gpu_temp],
            ramUsage: [...h.ramUsage.slice(-(MAX_HIST - 1)), m.ram_usage],
            timestamps: [...h.timestamps.slice(-(MAX_HIST - 1)), Date.now()],
          };
        });
        } catch {
          // silently ignore
        }
      }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Activity size={16} className="text-[#06b6d4]" />
          Live Monitoring
        </h2>
        <div
          className={`w-2 h-2 rounded-full ${isTestRunning ? "bg-[#22c55e] animate-pulse" : "bg-[#475569]"}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="CPU Temp"
          value={metrics.cpu_temp}
          unit="°C"
          icon={<Thermometer size={14} />}
          maxValue={maxCpuTemp}
          maxUnit="°C"
          color={getTempColor(metrics.cpu_temp)}
          history={history.cpuTemp}
        />
        <MetricCard
          label="GPU Temp"
          value={metrics.gpu_temp}
          unit="°C"
          icon={<Thermometer size={14} />}
          maxValue={maxGpuTemp}
          maxUnit="°C"
          color={getTempColor(metrics.gpu_temp)}
          history={history.gpuTemp}
        />
        <MetricCard
          label="RAM Usage"
          value={metrics.ram_usage}
          unit="%"
          icon={<Cpu size={14} />}
          color={metrics.ram_usage > 90 ? "#ef4444" : metrics.ram_usage > 70 ? "#f59e0b" : "#22c55e"}
          history={history.ramUsage}
        />
        <MetricCard
          label="CPU Usage"
          value={metrics.cpu_usage}
          unit="%"
          icon={<HardDrive size={14} />}
          color={metrics.cpu_usage > 90 ? "#ef4444" : metrics.cpu_usage > 70 ? "#f59e0b" : "#22c55e"}
        />
      </div>

      {/* Mini sparkline */}
      {history.cpuTemp.length > 2 && (
        <div className="rounded-xl p-3" style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}>
          <div className="text-xs text-[#94a3b8] mb-2">Temperature Trend</div>
          <Sparkline data={history.cpuTemp} color={getTempColor(metrics.cpu_temp)} label="CPU" />
          <Sparkline data={history.gpuTemp} color={getTempColor(metrics.gpu_temp)} label="GPU" />
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, color, label }: { data: number[]; color: string; label: string }) {
  if (data.length < 2) return null;
  const W = 200;
  const H = 32;
  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs text-[#475569] w-6 font-mono">{label}</span>
      <svg width={W} height={H} className="flex-1">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      <span className="text-xs font-mono" style={{ color }}>
        {data[data.length - 1].toFixed(1)}°C
      </span>
    </div>
  );
}