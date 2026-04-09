"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Save, RotateCcw, FolderOpen } from "lucide-react";
import { TOOL_PATHS } from "@/lib/tauri";

interface ToolPath {
  name: string;
  key: string;
  description: string;
}

const TOOLS: ToolPath[] = [
  { key: "Cinebench", name: "Cinebench", description: "CPU Benchmark" },
  { key: "FurMark", name: "FurMark", description: "GPU Stress Test" },
  { key: "MemTest64", name: "MemTest64", description: "RAM Stability" },
  { key: "CrystalDiskMark", name: "CrystalDiskMark", description: "SSD Speed" },
];

interface Props {
  onSave: (paths: Record<string, string>) => void;
}

const STORAGE_KEY = "ai-laptop-tester-paths";

function loadPaths(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...TOOL_PATHS };
}

export default function SettingsPanel({ onSave }: Props) {
  const [paths, setPaths] = useState<Record<string, string>>(loadPaths);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const handleChange = (key: string, val: string) => {
    setPaths((p) => ({ ...p, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    onSave(paths);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    const defaults = { ...TOOL_PATHS };
    setPaths(defaults);
    localStorage.removeItem(STORAGE_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Settings size={16} className="text-[#94a3b8]" />
          Tool Paths
        </h2>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs px-2 py-1 rounded-full transition-all"
          style={{
            backgroundColor: open ? "#3b82f620" : "#111827",
            color: open ? "#3b82f6" : "#94a3b8",
            border: `1px solid ${open ? "#3b82f640" : "#2a3654"}`,
          }}
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {!open && (
        <div className="text-xs text-[#475569]">
          {TOOLS.map((t) => (
            <span key={t.key}>
              <span className="text-[#94a3b8]">{t.name}:</span>{" "}
              <span className="font-mono text-[#64748b] truncate max-w-[180px] inline-block align-bottom">
                {paths[t.key]?.split("\\").pop() ?? "—"}
              </span>
              {t !== TOOLS[TOOLS.length - 1] && " · "}
            </span>
          ))}
        </div>
      )}

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-col gap-2 overflow-hidden"
        >
          {TOOLS.map((tool) => (
            <div key={tool.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#94a3b8] w-24 flex-shrink-0">{tool.name}</span>
                <span className="text-xs text-[#475569]">{tool.description}</span>
              </div>
              <input
                type="text"
                value={paths[tool.key] ?? ""}
                onChange={(e) => handleChange(tool.key, e.target.value)}
                placeholder={`e.g. C:\\Toolkit\\${tool.name}\\${tool.name}.exe`}
                className="w-full px-3 py-2 rounded-lg text-xs text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#3b82f6] focus:outline-none transition-all placeholder:text-[#475569] font-mono"
              />
            </div>
          ))}

          <div className="flex gap-2 mt-1">
            <motion.button
              onClick={handleSave}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: saved ? "#22c55e20" : "linear-gradient(135deg, #3b82f6, #06b6d4)",
                color: saved ? "#22c55e" : "#fff",
                border: saved ? "1px solid #22c55e40" : "none",
              }}
            >
              <Save size={12} />
              {saved ? "Saved!" : "Save Paths"}
            </motion.button>
            <motion.button
              onClick={handleReset}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: "#111827",
                color: "#94a3b8",
                border: "1px solid #2a3654",
              }}
            >
              <RotateCcw size={12} />
              Reset
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Re-export so page can import path config
export { TOOL_PATHS, STORAGE_KEY };