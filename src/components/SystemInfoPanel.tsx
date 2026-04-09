"use client";

import { useState, useEffect } from "react";
import { Cpu, Monitor, MemoryStick, Settings, HardDrive, Battery, BatteryCharging, Zap } from "lucide-react";
import { getSystemInfo, getAppVersion, type CpuTier } from "@/lib/tauri";

const TIER_LABELS: Record<string, string> = {
  entry: "ENTRY",
  lowmid: "LOW-MID",
  mid: "MID",
  high: "HIGH",
  enthusiast: "ENTHUSIAST",
};

const TIER_COLORS: Record<string, string> = {
  entry: "#94a3b8",
  lowmid: "#f59e0b",
  mid: "#22c55e",
  high: "#3b82f6",
  enthusiast: "#a855f7",
};

export default function SystemInfoPanel() {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getSystemInfo>> | null>(null);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSystemInfo(), getAppVersion()])
      .then(([sys, ver]) => {
        setInfo(sys);
        setVersion(ver);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !info) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Settings size={16} className="text-[#3b82f6]" />
          System Info
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-[#3b82f620] text-[#3b82f6] border border-[#3b82f640] font-medium">
          v{version || "0.1.0"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
        >
          <span className="text-[#475569] flex-shrink-0"><Cpu size={13} /></span>
          <span className="text-xs text-[#475569] w-10 flex-shrink-0">CPU</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-[#f1f5f9] block truncate" title={info.cpu_model}>
              {info.cpu_model}
            </span>
            <span className="text-xs text-[#475569]">{info.cpu_cores} cores</span>
          </div>
          {info.cpu_tier_label && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
              style={{
                backgroundColor: `${TIER_COLORS[info.cpu_tier] ?? "#f59e0b"}20`,
                color: TIER_COLORS[info.cpu_tier] ?? "#f59e0b",
                border: `1px solid ${TIER_COLORS[info.cpu_tier] ?? "#f59e0b"}40`,
              }}
            >
              {info.cpu_tier_label}
            </span>
          )}
        </div>
        <InfoRow
          icon={<Monitor size={13} />}
          label="GPU"
          value={info.gpu_model}
          sub={info.gpu_vram_gb > 0 ? `${info.gpu_vram_gb} GB VRAM` : undefined}
        />
        <InfoRow
          icon={<MemoryStick size={13} />}
          label="RAM"
          value={`${info.ram_total_gb.toFixed(1)} GB`}
        />
        <InfoRow
          icon={<HardDrive size={13} />}
          label="OS"
          value={info.os_version}
        />

        {/* Battery row */}
        {info.battery && info.battery.charge_pct > 0 && (
          <BatteryRow battery={info.battery} />
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
    >
      <span className="text-[#475569] flex-shrink-0">{icon}</span>
      <span className="text-xs text-[#475569] w-10 flex-shrink-0">{label}</span>
      <span className="text-xs font-semibold text-[#f1f5f9] flex-1 truncate" title={value}>
        {value}
      </span>
      {sub && (
        <span className="text-xs text-[#475569] flex-shrink-0">{sub}</span>
      )}
    </div>
  );
}

function BatteryRow({ battery }: { battery: { charge_pct: number; is_charging: boolean; health_pct: number } }) {
  const pct = battery.charge_pct;
  const health = battery.health_pct;

  const color = pct > 50 ? "#22c55e" : pct > 20 ? "#f59e0b" : "#ef4444";
  const healthColor = health < 0 ? "#94a3b8" : health < 60 ? "#ef4444" : health < 80 ? "#f59e0b" : "#22c55e";
  const healthLabel = health < 0 ? "N/A" : `${health.toFixed(0)}%`;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
    >
      <span className="text-[#475569] flex-shrink-0">
        {battery.is_charging ? <BatteryCharging size={13} /> : <Battery size={13} />}
      </span>
      <span className="text-xs text-[#475569] w-10 flex-shrink-0">Pin</span>
      <span className="text-xs font-semibold" style={{ color }}>
        {pct.toFixed(0)}%{battery.is_charging ? " ⚡" : ""}
      </span>
      {health > 0 && (
        <span className="ml-auto flex items-center gap-1 text-xs" style={{ color: healthColor }}>
          <Zap size={10} />
          Health: {healthLabel}
        </span>
      )}
    </div>
  );
}
