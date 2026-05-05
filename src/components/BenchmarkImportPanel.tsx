"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileUp, Clipboard, CheckCircle, AlertCircle, Cpu, HardDrive } from "lucide-react";

interface Props {
  onResult: (cinebenchScore: number, diskRead: number, diskWrite: number) => void;
}

export default function BenchmarkImportPanel({ onResult }: Props) {
  const [input, setInput] = useState("");
  const [parseResult, setParseResult] = useState<{
    cinebench?: number;
    diskRead?: number;
    diskWrite?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCinebench = (text: string): number | null => {
    // Cinebench R23 format: "CPU (Multi Core): 12345 pts" or "Multi-Core Score: 12345"
    const patterns = [
      /CPU\s*\(Multi\s*Core\)\s*:\s*(\d+)/i,
      /Multi[-\s]*Core\s*Score\s*:\s*(\d+)/i,
      /CB\s*R23\s*Multi[-\s]*Core\s*:\s*(\d+)/i,
      /Cinebench\s*R23\s*:\s*(\d+)/i,
      /Multi[-\s]*Core\s*:\s*(\d+)\s*pts/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const score = parseInt(match[1], 10);
        if (score > 0 && score < 100000) return score;
      }
    }

    // Try to find any number between 100 and 50000 (reasonable Cinebench range)
    const numbers = text.match(/\b(\d{3,5})\b/g);
    if (numbers) {
      for (const num of numbers) {
        const val = parseInt(num, 10);
        if (val >= 100 && val <= 50000) return val;
      }
    }

    return null;
  };

  const parseCrystalDiskMark = (text: string): { read: number; write: number } | null => {
    // CrystalDiskMark format:
    // Sequential Read: 3500.12 MB/s
    // Sequential Write: 3000.45 MB/s
    const readPatterns = [
      /Sequential\s*(?:1MiB\s*)?(?:Q\d+T\d+\s*)?Read\s*:\s*([\d.]+)\s*MB\/s/i,
      /SEQ1M\s*Q\d+T\d+\s*Read\s*:\s*([\d.]+)\s*MB\/s/i,
      /Read\s*:\s*([\d.]+)\s*MB\/s/i,
    ];

    const writePatterns = [
      /Sequential\s*(?:1MiB\s*)?(?:Q\d+T\d+\s*)?Write\s*:\s*([\d.]+)\s*MB\/s/i,
      /SEQ1M\s*Q\d+T\d+\s*Write\s*:\s*([\d.]+)\s*MB\/s/i,
      /Write\s*:\s*([\d.]+)\s*MB\/s/i,
    ];

    let read = 0;
    let write = 0;

    for (const pattern of readPatterns) {
      const match = text.match(pattern);
      if (match) {
        read = parseFloat(match[1]);
        break;
      }
    }

    for (const pattern of writePatterns) {
      const match = text.match(pattern);
      if (match) {
        write = parseFloat(match[1]);
        break;
      }
    }

    if (read > 0 || write > 0) {
      return { read, write };
    }

    return null;
  };

  const handleParse = () => {
    setError(null);
    setParseResult(null);

    if (!input.trim()) {
      setError("Please paste benchmark results");
      return;
    }

    const cinebench = parseCinebench(input);
    const disk = parseCrystalDiskMark(input);

    if (!cinebench && !disk) {
      setError("Could not parse results. Please paste Cinebench or CrystalDiskMark output.");
      return;
    }

    const result = {
      cinebench: cinebench || 0,
      diskRead: disk?.read || 0,
      diskWrite: disk?.write || 0,
    };

    setParseResult(result);
    onResult(result.cinebench, result.diskRead, result.diskWrite);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch (e) {
      setError("Failed to read clipboard. Please paste manually.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <FileUp size={16} className="text-[#3b82f6]" />
          Benchmark Import
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-[#3b82f620] text-[#3b82f6] border border-[#3b82f640] font-medium">
          Auto-Parse
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">Paste benchmark results:</span>
          <button
            onClick={handlePasteFromClipboard}
            className="text-xs px-2 py-1 rounded-lg transition-all flex items-center gap-1"
            style={{
              backgroundColor: "#1a2235",
              color: "#3b82f6",
              border: "1px solid #2a3654",
            }}
          >
            <Clipboard size={12} />
            Paste
          </button>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste Cinebench R23 or CrystalDiskMark results here..."
          className="w-full px-3 py-2 rounded-lg text-xs text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#3b82f6] focus:outline-none resize-none placeholder:text-[#475569] font-mono"
          rows={6}
        />

        <motion.button
          onClick={handleParse}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
            color: "#fff",
          }}
        >
          Parse Results
        </motion.button>
      </div>

      {/* Parse Result */}
      {parseResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 p-3 rounded-lg"
          style={{ backgroundColor: "#22c55e15", border: "1px solid #22c55e40" }}
        >
          <div className="flex items-center gap-2 text-xs text-[#22c55e] font-medium">
            <CheckCircle size={14} />
            Parsed Successfully
          </div>
          {parseResult.cinebench > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8] flex items-center gap-1">
                <Cpu size={12} />
                Cinebench R23
              </span>
              <span className="text-[#f1f5f9] font-mono font-bold">
                {parseResult.cinebench.toFixed(0)} pts
              </span>
            </div>
          )}
          {(parseResult.diskRead > 0 || parseResult.diskWrite > 0) && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8] flex items-center gap-1">
                <HardDrive size={12} />
                Disk Speed
              </span>
              <span className="text-[#f1f5f9] font-mono font-bold">
                {parseResult.diskRead.toFixed(0)} / {parseResult.diskWrite.toFixed(0)} MB/s
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg text-xs"
          style={{ backgroundColor: "#ef444415", border: "1px solid #ef444440", color: "#ef4444" }}
        >
          <AlertCircle size={14} />
          {error}
        </motion.div>
      )}

      {/* Help */}
      <div className="text-xs text-[#475569] bg-[#1a2235] rounded-lg p-3">
        <p className="font-medium text-[#94a3b8] mb-1">Supported formats:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Cinebench R23/R24 results</li>
          <li>CrystalDiskMark sequential speeds</li>
        </ul>
      </div>

      {/* Examples */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[#94a3b8] hover:text-[#f1f5f9] transition-colors p-2 rounded-lg hover:bg-[#1a2235]">
          Show example formats
        </summary>
        <div className="mt-2 p-3 rounded-lg bg-[#111827] font-mono text-[#94a3b8] space-y-2">
          <div>
            <p className="text-[#475569] mb-1">Cinebench:</p>
            <code className="text-xs">CPU (Multi Core): 15234 pts</code>
          </div>
          <div>
            <p className="text-[#475569] mb-1">CrystalDiskMark:</p>
            <code className="text-xs">
              Sequential Read: 3500.12 MB/s<br />
              Sequential Write: 3000.45 MB/s
            </code>
          </div>
        </div>
      </details>
    </div>
  );
}
