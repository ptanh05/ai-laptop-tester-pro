"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Cpu, Monitor, MemoryStick, HardDrive, Activity } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "pass" | "fail";
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: "cpu",
    label: "CPU Test",
    description: "Cinebench R23/R24",
    icon: <Cpu size={16} />,
    status: "pending",
  },
  {
    id: "gpu",
    label: "GPU Test",
    description: "FurMark 15-min stress",
    icon: <Monitor size={16} />,
    status: "pending",
  },
  {
    id: "ram",
    label: "RAM Test",
    description: "MemTest64 (2+ passes)",
    icon: <MemoryStick size={16} />,
    status: "pending",
  },
  {
    id: "ssd",
    label: "SSD Benchmark",
    description: "CrystalDiskMark (1GB)",
    icon: <HardDrive size={16} />,
    status: "pending",
  },
  {
    id: "thermal",
    label: "Thermal Check",
    description: "CPU < 95°C, GPU < 85°C",
    icon: <Activity size={16} />,
    status: "pending",
  },
];

interface Props {
  onItemComplete: (id: string, pass: boolean) => void;
  statuses?: Record<string, "pending" | "pass" | "fail">;
  onUpdate?: (id: string, status: "pending" | "pass" | "fail") => void;
}

export default function ChecklistPanel({ onItemComplete, statuses = {}, onUpdate }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST.map((item) => ({
      ...item,
      status: statuses[item.id] ?? "pending",
    }))
  );

  // Sync external status changes (e.g. from auto test)
  useEffect(() => {
    setItems((prev) =>
      prev.map((item) => {
        const ext = statuses[item.id];
        return ext !== undefined && ext !== item.status ? { ...item, status: ext } : item;
      })
    );
  }, [statuses]);

  const handleToggle = (id: string, currentStatus: ChecklistItem["status"]) => {
    const nextStatus: ChecklistItem["status"] =
      currentStatus === "pending"
        ? "pass"
        : currentStatus === "pass"
          ? "fail"
          : "pending";

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
    );

    if (nextStatus !== "pending") {
      onItemComplete(id, nextStatus === "pass");
    }
    onUpdate?.(id, nextStatus);
  };

  const completedCount = items.filter((i) => i.status !== "pending").length;
  const passCount = items.filter((i) => i.status === "pass").length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight">
          Test Checklist
        </h2>
        <span className="text-xs text-[#94a3b8]">
          {completedCount}/{items.length} done
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#111827" }}>
        <motion.div
          className="h-full rounded-full"
          style={{
            background: progress === 100
              ? "linear-gradient(90deg, #22c55e, #16a34a)"
              : "linear-gradient(90deg, #3b82f6, #06b6d4)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Checklist items */}
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06 }}
            onClick={() => handleToggle(item.id, item.status)}
            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left cursor-pointer"
            style={{
              backgroundColor: "#1a2235",
              boxShadow: "0 0 0 1px #2a3654",
            }}
          >
            {/* Icon */}
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{
                backgroundColor:
                  item.status === "pass"
                    ? "#22c55e20"
                    : item.status === "fail"
                      ? "#ef444420"
                      : "#111827",
                color:
                  item.status === "pass"
                    ? "#22c55e"
                    : item.status === "fail"
                      ? "#ef4444"
                      : "#475569",
              }}
            >
              {item.status === "pass" ? (
                <CheckCircle2 size={16} />
              ) : item.status === "fail" ? (
                <AlertTriangle size={16} />
              ) : (
                item.icon
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#f1f5f9]">{item.label}</span>
                {item.status === "pass" && (
                  <span className="text-xs text-[#22c55e]">PASS</span>
                )}
                {item.status === "fail" && (
                  <span className="text-xs text-[#ef4444]">FAIL</span>
                )}
              </div>
              <span className="text-xs text-[#94a3b8]">{item.description}</span>
            </div>

            {/* Click hint */}
            {item.status === "pending" && (
              <span className="text-xs text-[#475569] flex-shrink-0">
                tap → pass
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Summary */}
      {completedCount === items.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl p-3 text-center text-sm font-medium"
          style={{
            backgroundColor: passCount === items.length ? "#22c55e15" : "#f59e0b15",
            color: passCount === items.length ? "#22c55e" : "#f59e0b",
            border: `1px solid ${passCount === items.length ? "#22c55e40" : "#f59e0b40"}`,
          }}
        >
          {passCount}/{items.length} tests passed —{" "}
          {passCount === items.length ? "System healthy" : "Review failed items"}
        </motion.div>
      )}
    </div>
  );
}