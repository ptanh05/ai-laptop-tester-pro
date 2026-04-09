"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Globe, Download, Upload, Activity, X } from "lucide-react";

// Use a public CDN file for speed test
const TEST_URL = "https://speed.cloudflare.com/__down?bytes=5000000";
const TEST_URL_UPLOAD = "https://speed.cloudflare.com/__up";

interface SpeedResult {
  mbps: number;
  ms: number;
}

interface Props {
  onResult?: (down: number, up: number, latency: number) => void;
}

export default function NetworkSpeedTest({ onResult }: Props) {
  const [state, setState] = useState<"idle" | "testing_down" | "testing_up" | "done">("idle");
  const [downSpeed, setDownSpeed] = useState<SpeedResult | null>(null);
  const [upSpeed, setUpSpeed] = useState<SpeedResult | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const runTest = async (direction: "down" | "up") => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setProgress(0);

    const start = performance.now();
    try {
      if (direction === "down") {
        setState("testing_down");
        const res = await fetch(TEST_URL, { signal: abortRef.current.signal });
        const blob = await res.blob();
        const elapsed = performance.now() - start;
        const bytes = blob.size;
        const mbps = (bytes * 8) / elapsed / 1000;
        const newDown = { mbps, ms: elapsed };
        setDownSpeed(newDown);
        setState("done");
        setProgress(100);
        if (onResult) onResult(mbps, upSpeed?.mbps ?? 0, elapsed);
      } else {
        setState("testing_up");
        // Upload: send 500KB of random data
        const data = new Uint8Array(500 * 1024);
        const start2 = performance.now();
        await fetch(TEST_URL_UPLOAD, {
          method: "POST",
          body: data,
          signal: abortRef.current.signal,
        });
        const elapsed = performance.now() - start2;
        const mbps = (data.byteLength * 8) / elapsed / 1000;
        const newUp = { mbps, ms: elapsed };
        setUpSpeed(newUp);
        setState("done");
        setProgress(100);
        if (onResult) onResult(downSpeed?.mbps ?? 0, mbps, elapsed);
      }
      setProgress(100);
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        // Fallback: estimate from connection type
        setProgress(0);
      }
    }
  };

  const cancel = () => {
    if (abortRef.current) abortRef.current.abort();
    setState("idle");
    setProgress(0);
  };

  const reset = () => {
    setDownSpeed(null);
    setUpSpeed(null);
    setState("idle");
    setProgress(0);
  };

  const isRunning = state === "testing_down" || state === "testing_up";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Globe size={16} className="text-[#06b6d4]" />
          Network Speed
        </h2>
        {isRunning ? (
          <button onClick={cancel} className="text-xs px-2 py-1 rounded-full text-[#ef4444] bg-[#ef444420]" style={{ border: "1px solid #ef444440" }}>
            <X size={10} className="inline" /> Cancel
          </button>
        ) : (downSpeed || upSpeed) ? (
          <button onClick={reset} className="text-xs px-2 py-1 rounded-full text-[#94a3b8]" style={{ border: "1px solid #2a3654" }}>
            Reset
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Download */}
        <SpeedCard
          label="Download"
          icon={<Download size={16} />}
          result={downSpeed}
          color="#06b6d4"
          testing={state === "testing_down"}
          onTest={() => runTest("down")}
          disabled={isRunning}
        />
        {/* Upload */}
        <SpeedCard
          label="Upload"
          icon={<Upload size={16} />}
          result={upSpeed}
          color="#8b5cf6"
          testing={state === "testing_up"}
          onTest={() => runTest("up")}
          disabled={isRunning}
        />
      </div>
    </div>
  );
}

function SpeedCard({
  label,
  icon,
  result,
  color,
  testing,
  onTest,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  result: SpeedResult | null;
  color: string;
  testing: boolean;
  onTest: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-xl"
      style={{ backgroundColor: "#1a2235", boxShadow: "0 0 0 1px #2a3654" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs text-[#94a3b8] font-medium">{label}</span>
      </div>

      {result ? (
        <div className="flex flex-col">
          <span className="text-2xl font-black metric-value" style={{ color }}>
            {result.mbps.toFixed(1)}
          </span>
          <span className="text-xs text-[#475569]">Mbps ({result.ms.toFixed(0)}ms)</span>
        </div>
      ) : testing ? (
        <div className="flex flex-col gap-2">
          <span className="text-lg font-bold text-[#94a3b8] animate-pulse">Testing...</span>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#111827" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              animate={{ width: ["0%", "100%"] }}
              transition={{ duration: 4, ease: "linear" }}
            />
          </div>
        </div>
      ) : (
        <motion.button
          onClick={onTest}
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.02 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
          style={{
            backgroundColor: `${color}15`,
            color,
            border: `1px solid ${color}40`,
          }}
        >
          Test {label}
        </motion.button>
      )}
    </div>
  );
}
