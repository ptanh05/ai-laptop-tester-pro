"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  Monitor,
  MemoryStick,
  HardDrive,
  Play,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { runTool } from "@/lib/tauri";

type TestStatus = "idle" | "launching" | "running" | "done" | "error";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: TestStatus;
}

interface Props {
  onToolComplete: (toolId: string, passed: boolean) => void;
  isAutoRunning: boolean;
}

const TOOLS: Tool[] = [
  {
    id: "Cinebench",
    name: "Cinebench",
    description: "CPU Benchmark",
    icon: <Cpu size={22} />,
    status: "idle",
  },
  {
    id: "FurMark",
    name: "FurMark",
    description: "GPU Stress Test",
    icon: <Monitor size={22} />,
    status: "idle",
  },
  {
    id: "MemTest64",
    name: "MemTest64",
    description: "RAM Stability",
    icon: <MemoryStick size={22} />,
    status: "idle",
  },
  {
    id: "CrystalDiskMark",
    name: "CrystalDiskMark",
    description: "SSD Speed Test",
    icon: <HardDrive size={22} />,
    status: "idle",
  },
];

function getStatusColor(status: TestStatus): string {
  switch (status) {
    case "idle":
      return "#475569";
    case "launching":
      return "#3b82f6";
    case "running":
      return "#3b82f6";
    case "done":
      return "#22c55e";
    case "error":
      return "#ef4444";
  }
}

function StatusDot({ status }: { status: TestStatus }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{
        backgroundColor: getStatusColor(status),
        boxShadow: status !== "idle" ? `0 0 6px ${getStatusColor(status)}` : "none",
      }}
    />
  );
}

export default function TestControls({ onToolComplete, isAutoRunning }: Props) {
  const [tools, setTools] = useState<(Tool & { status: TestStatus })[]>(
    TOOLS.map((t) => ({ ...t, status: "idle" })),
  );
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const handleLaunch = async (tool: (typeof tools)[0]) => {
    setTools((prev) =>
      prev.map((t) =>
        t.id === tool.id ? { ...t, status: "launching" as TestStatus } : t,
      ),
    );
    setSelectedTool(tool.id);

    try {
      await runTool(tool.id);
      setTools((prev) =>
        prev.map((t) =>
          t.id === tool.id ? { ...t, status: "running" as TestStatus } : t,
        ),
      );
    } catch {
      setTools((prev) =>
        prev.map((t) =>
          t.id === tool.id ? { ...t, status: "error" as TestStatus } : t,
        ),
      );
    }
  };

  const handleComplete = (toolId: string, passed: boolean) => {
    setTools((prev) =>
      prev.map((t) =>
        t.id === toolId
          ? { ...t, status: (passed ? "done" : "error") as TestStatus }
          : t,
      ),
    );
    onToolComplete(toolId, passed);
  };

  const handleReset = () => {
    setTools(TOOLS.map((t) => ({ ...t, status: "idle" })));
    setSelectedTool(null);
  };

  const runningCount = tools.filter((t) => t.status === "running" || t.status === "launching").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight">
          Test Controls
        </h2>
        <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
          <Zap size={12} className={runningCount > 0 ? "text-[#f59e0b]" : "text-[#475569]"} />
          <span>{runningCount} active</span>
        </div>
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 gap-3">
        {tools.map((tool, idx) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.3 }}
          >
            <motion.button
              onClick={() => {
                if (tool.status === "idle" || tool.status === "error") {
                  handleLaunch(tool);
                } else if (tool.status === "running") {
                  handleComplete(tool.id, true);
                }
              }}
              disabled={tool.status === "launching" || isAutoRunning}
              whileHover={{ scale: tool.status !== "idle" ? 1.01 : 1.02 }}
              whileTap={{ scale: 0.99 }}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer disabled:cursor-not-allowed relative overflow-hidden"
              style={{
                backgroundColor: "#1a2235",
                boxShadow: `0 0 0 1px ${
                  tool.status === "running"
                    ? "#3b82f6"
                    : tool.status === "done"
                      ? "#22c55e"
                      : tool.status === "error"
                        ? "#ef4444"
                        : "#2a3654"
                }, 0 4px 16px rgba(0,0,0,0.3)`,
                border: "none",
                outline: "none",
              }}
            >
              {/* Left color bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                style={{ backgroundColor: getStatusColor(tool.status) }}
              />

              {/* Icon */}
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ml-1"
                style={{
                  backgroundColor: `${getStatusColor(tool.status)}20`,
                  color: getStatusColor(tool.status),
                }}
              >
                {tool.status === "launching" ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : tool.status === "done" ? (
                  <CheckCircle2 size={20} />
                ) : tool.status === "error" ? (
                  <XCircle size={20} />
                ) : (
                  tool.icon
                )}
              </div>

              {/* Text */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#f1f5f9]">
                    {tool.name}
                  </span>
                  <StatusDot status={tool.status} />
                </div>
                <span className="text-xs text-[#94a3b8]">{tool.description}</span>
              </div>

              {/* Action label */}
              <div className="text-xs text-[#94a3b8] pr-2">
                {tool.status === "idle" || tool.status === "error"
                  ? "Launch →"
                  : tool.status === "running"
                    ? "Mark Pass"
                    : tool.status === "done"
                      ? "Done ✓"
                      : "..."}
              </div>
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Auto Test Button */}
      <div className="flex flex-col gap-2 mt-2">
        <motion.button
          onClick={() => {}}
          disabled
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
          style={{
            background: isAutoRunning
              ? "linear-gradient(135deg, #f97316, #ef4444)"
              : "linear-gradient(135deg, #3b82f6, #06b6d4)",
            color: "#fff",
            boxShadow: isAutoRunning
              ? "0 0 20px rgba(249,115,22,0.3)"
              : "0 0 20px rgba(59,130,246,0.3)",
          }}
        >
          <Play size={16} />
          {isAutoRunning ? "AUTO TEST RUNNING..." : "Start Full Auto Test (15 min)"}
        </motion.button>

        {runningCount > 0 && (
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs text-[#94a3b8] hover:text-[#ef4444] transition-colors"
          >
            <Square size={12} /> Reset All
          </button>
        )}
      </div>
    </div>
  );
}