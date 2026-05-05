"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompare, X, Plus, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getTestHistory, type TestHistoryEntry } from "@/lib/test-history";
import { getScoreColor } from "@/lib/ai-scoring";

export default function TestComparisonPanel() {
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [selectedTests, setSelectedTests] = useState<TestHistoryEntry[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    setHistory(getTestHistory());
  }, []);

  const handleAddTest = (test: TestHistoryEntry) => {
    if (selectedTests.length >= 4) {
      alert("Maximum 4 tests can be compared");
      return;
    }
    if (selectedTests.find((t) => t.id === test.id)) {
      return;
    }
    setSelectedTests([...selectedTests, test]);
  };

  const handleRemoveTest = (id: string) => {
    setSelectedTests(selectedTests.filter((t) => t.id !== id));
  };

  const handleClearAll = () => {
    setSelectedTests([]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <GitCompare size={16} className="text-[#a855f7]" />
          Test Comparison
        </h2>
        <div className="flex items-center gap-2">
          {selectedTests.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs px-2 py-1 rounded-full transition-all"
              style={{
                backgroundColor: "#ef444420",
                color: "#ef4444",
                border: "1px solid #ef444440",
              }}
            >
              Clear All
            </button>
          )}
          <span className="text-xs px-2 py-1 rounded-full bg-[#a855f620] text-[#a855f6] border border-[#a855f640] font-medium">
            {selectedTests.length}/4 selected
          </span>
        </div>
      </div>

      {/* Selected Tests */}
      {selectedTests.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-[#94a3b8] font-medium">Selected Tests:</div>
          <div className="grid grid-cols-2 gap-2">
            {selectedTests.map((test) => (
              <SelectedTestCard key={test.id} test={test} onRemove={handleRemoveTest} />
            ))}
          </div>
        </div>
      )}

      {/* Comparison View */}
      {selectedTests.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3"
        >
          <div className="text-xs text-[#94a3b8] font-medium">Comparison:</div>
          <ComparisonTable tests={selectedTests} />
        </motion.div>
      )}

      {/* Add Test Button */}
      <button
        onClick={() => setIsSelecting(!isSelecting)}
        className="w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
        style={{
          backgroundColor: isSelecting ? "#a855f620" : "#1a2235",
          color: isSelecting ? "#a855f6" : "#94a3b8",
          border: `1px solid ${isSelecting ? "#a855f640" : "#2a3654"}`,
        }}
      >
        {isSelecting ? <X size={14} /> : <Plus size={14} />}
        {isSelecting ? "Cancel" : "Add Test to Compare"}
      </button>

      {/* Test Selection List */}
      <AnimatePresence>
        {isSelecting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar"
          >
            {history.length === 0 ? (
              <div className="text-center py-4 text-[#475569] text-xs">No test history</div>
            ) : (
              history.map((test) => (
                <TestSelectCard
                  key={test.id}
                  test={test}
                  isSelected={selectedTests.some((t) => t.id === test.id)}
                  onSelect={() => handleAddTest(test)}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectedTestCard({ test, onRemove }: { test: TestHistoryEntry; onRemove: (id: string) => void }) {
  const scoreColor = getScoreColor(test.result.score);
  const date = new Date(test.timestamp).toLocaleDateString("vi-VN");

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg"
      style={{ backgroundColor: "#1a2235", border: "1px solid #2a3654" }}
    >
      <div
        className="w-1 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: scoreColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold" style={{ color: scoreColor }}>
          {test.result.score.toFixed(0)}
        </div>
        <div className="text-xs text-[#475569] truncate">{date}</div>
      </div>
      <button
        onClick={() => onRemove(test.id)}
        className="text-[#ef4444] hover:text-[#f87171] transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function TestSelectCard({
  test,
  isSelected,
  onSelect,
}: {
  test: TestHistoryEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const scoreColor = getScoreColor(test.result.score);
  const date = new Date(test.timestamp).toLocaleDateString("vi-VN");

  return (
    <button
      onClick={onSelect}
      disabled={isSelected}
      className="flex items-center gap-3 p-3 rounded-lg text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        backgroundColor: isSelected ? "#a855f620" : "#1a2235",
        border: `1px solid ${isSelected ? "#a855f640" : "#2a3654"}`,
      }}
    >
      <div
        className="w-1 h-12 rounded-full flex-shrink-0"
        style={{ backgroundColor: scoreColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold" style={{ color: scoreColor }}>
            {test.result.score.toFixed(0)}
          </span>
          <span className="text-xs text-[#94a3b8]">{test.result.verdict}</span>
        </div>
        <div className="text-xs text-[#475569]">{date}</div>
        <div className="text-xs text-[#475569] truncate">{test.systemInfo.cpu}</div>
      </div>
    </button>
  );
}

function ComparisonTable({ tests }: { tests: TestHistoryEntry[] }) {
  const metrics = [
    { key: "score", label: "Score", format: (v: number) => v.toFixed(1) },
    { key: "cpu_temp", label: "CPU Temp", format: (v: number) => `${v.toFixed(1)}°C` },
    { key: "gpu_temp", label: "GPU Temp", format: (v: number) => `${v.toFixed(1)}°C` },
    { key: "cpu_usage", label: "CPU Usage", format: (v: number) => `${v.toFixed(1)}%` },
    { key: "duration_sec", label: "Duration", format: (v: number) => `${Math.floor(v / 60)}m` },
  ];

  const getMetricValue = (test: TestHistoryEntry, key: string): number => {
    if (key === "score") return test.result.score;
    if (key === "duration_sec") return test.result.duration_sec;
    return (test.result.metrics as any)[key] || 0;
  };

  const getBestWorst = (key: string) => {
    const values = tests.map((t) => getMetricValue(t, key));
    const best = key === "cpu_temp" || key === "gpu_temp" ? Math.min(...values) : Math.max(...values);
    const worst = key === "cpu_temp" || key === "gpu_temp" ? Math.max(...values) : Math.min(...values);
    return { best, worst };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid #2a3654" }}>
            <th className="text-left py-2 px-2 text-[#94a3b8] font-medium">Metric</th>
            {tests.map((test, i) => (
              <th key={test.id} className="text-center py-2 px-2 text-[#94a3b8] font-medium">
                Test {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => {
            const { best, worst } = getBestWorst(metric.key);
            return (
              <tr key={metric.key} style={{ borderBottom: "1px solid #2a3654" }}>
                <td className="py-2 px-2 text-[#94a3b8]">{metric.label}</td>
                {tests.map((test) => {
                  const value = getMetricValue(test, metric.key);
                  const isBest = value === best && tests.length > 1;
                  const isWorst = value === worst && tests.length > 1;
                  return (
                    <td key={test.id} className="text-center py-2 px-2">
                      <div className="flex items-center justify-center gap-1">
                        {isBest && <TrendingUp size={10} className="text-[#22c55e]" />}
                        {isWorst && <TrendingDown size={10} className="text-[#ef4444]" />}
                        {!isBest && !isWorst && <Minus size={10} className="text-[#475569]" />}
                        <span
                          className="font-mono font-bold"
                          style={{
                            color: isBest ? "#22c55e" : isWorst ? "#ef4444" : "#f1f5f9",
                          }}
                        >
                          {metric.format(value)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
