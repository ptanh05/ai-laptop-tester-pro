"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Trash2,
  Download,
  Upload,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Cpu,
  TrendingUp,
  FileText,
} from "lucide-react";
import {
  getTestHistory,
  deleteTestFromHistory,
  clearTestHistory,
  updateTestNotes,
  exportHistoryToJson,
  importHistoryFromJson,
  type TestHistoryEntry,
} from "@/lib/test-history";
import { getScoreColor } from "@/lib/ai-scoring";

export default function TestHistoryPanel() {
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState("");

  const loadHistory = () => {
    setHistory(getTestHistory());
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = (id: string) => {
    if (confirm("Delete this test result?")) {
      deleteTestFromHistory(id);
      loadHistory();
    }
  };

  const handleClearAll = () => {
    if (confirm("Clear all test history? This cannot be undone.")) {
      clearTestHistory();
      loadHistory();
    }
  };

  const handleExport = () => {
    const json = exportHistoryToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-history-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      if (importHistoryFromJson(text)) {
        loadHistory();
        alert("History imported successfully!");
      } else {
        alert("Failed to import history. Invalid format.");
      }
    };
    input.click();
  };

  const handleSaveNotes = (id: string) => {
    updateTestNotes(id, notesInput);
    setEditingNotesId(null);
    loadHistory();
  };

  const filteredHistory = history.filter((entry) => {
    const q = searchQuery.toLowerCase();
    return (
      entry.systemInfo.cpu.toLowerCase().includes(q) ||
      entry.systemInfo.gpu.toLowerCase().includes(q) ||
      entry.result.verdict.toLowerCase().includes(q) ||
      entry.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <History size={16} className="text-[#8b5cf6]" />
          Test History
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-[#8b5cf620] text-[#8b5cf6] border border-[#8b5cf640] font-medium">
          {history.length} tests
        </span>
      </div>

      {/* Search & Actions */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by CPU, GPU, verdict..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#8b5cf6] focus:outline-none transition-all placeholder:text-[#475569]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#f1f5f9]"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={handleExport}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: "#1a2235",
            color: "#8b5cf6",
            border: "1px solid #2a3654",
          }}
          title="Export history to JSON"
        >
          <Download size={14} />
        </button>
        <button
          onClick={handleImport}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: "#1a2235",
            color: "#8b5cf6",
            border: "1px solid #2a3654",
          }}
          title="Import history from JSON"
        >
          <Upload size={14} />
        </button>
        <button
          onClick={handleClearAll}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: "#1a2235",
            color: "#ef4444",
            border: "1px solid #2a3654",
          }}
          title="Clear all history"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* History List */}
      <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-[#475569] text-sm">
            {searchQuery ? "No results found" : "No test history yet"}
          </div>
        ) : (
          filteredHistory.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
              onDelete={() => handleDelete(entry.id)}
              isEditingNotes={editingNotesId === entry.id}
              onEditNotes={() => {
                setEditingNotesId(entry.id);
                setNotesInput(entry.notes || "");
              }}
              onSaveNotes={() => handleSaveNotes(entry.id)}
              onCancelNotes={() => setEditingNotesId(null)}
              notesInput={notesInput}
              onNotesChange={setNotesInput}
            />
          ))
        )}
      </div>
    </div>
  );
}

function HistoryCard({
  entry,
  isExpanded,
  onToggleExpand,
  onDelete,
  isEditingNotes,
  onEditNotes,
  onSaveNotes,
  onCancelNotes,
  notesInput,
  onNotesChange,
}: {
  entry: TestHistoryEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  isEditingNotes: boolean;
  onEditNotes: () => void;
  onSaveNotes: () => void;
  onCancelNotes: () => void;
  notesInput: string;
  onNotesChange: (val: string) => void;
}) {
  const scoreColor = getScoreColor(entry.result.score);
  const date = new Date(entry.timestamp);
  const dateStr = date.toLocaleDateString("vi-VN");
  const timeStr = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#1a2235",
        boxShadow: "0 0 0 1px #2a3654",
      }}
    >
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#111827] transition-colors"
      >
        <div
          className="w-1 h-12 rounded-full flex-shrink-0"
          style={{ backgroundColor: scoreColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-lg font-black metric-value"
              style={{ color: scoreColor }}
            >
              {entry.result.score.toFixed(1)}
            </span>
            <span className="text-xs text-[#94a3b8]">{entry.result.verdict}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#475569]">
            <Calendar size={10} />
            <span>
              {dateStr} {timeStr}
            </span>
            <span>•</span>
            <Cpu size={10} />
            <span className="truncate max-w-[200px]">{entry.systemInfo.cpu}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${scoreColor}20`,
              color: scoreColor,
              border: `1px solid ${scoreColor}40`,
            }}
          >
            {entry.result.recommendation}
          </span>
          {isExpanded ? (
            <ChevronUp size={16} className="text-[#94a3b8]" />
          ) : (
            <ChevronDown size={16} className="text-[#94a3b8]" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-2 flex flex-col gap-3"
              style={{ borderTop: "1px solid #2a3654" }}
            >
              {/* System Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <InfoRow label="CPU" value={entry.systemInfo.cpu} />
                <InfoRow label="GPU" value={entry.systemInfo.gpu} />
                <InfoRow label="RAM" value={entry.systemInfo.ram} />
                <InfoRow
                  label="Duration"
                  value={`${Math.floor(entry.result.duration_sec / 60)}m ${entry.result.duration_sec % 60}s`}
                />
                <InfoRow
                  label="CPU Temp"
                  value={`${entry.result.metrics.cpu_temp.toFixed(1)}°C`}
                />
                <InfoRow
                  label="GPU Temp"
                  value={`${entry.result.metrics.gpu_temp.toFixed(1)}°C`}
                />
              </div>

              {/* Explanations */}
              {entry.result.explanations.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#94a3b8] font-medium flex items-center gap-1">
                    <TrendingUp size={12} />
                    Key Findings
                  </span>
                  <div className="flex flex-col gap-1">
                    {entry.result.explanations.slice(0, 3).map((exp, i) => (
                      <div
                        key={i}
                        className="text-xs text-[#f1f5f9] px-2 py-1 rounded bg-[#111827]"
                      >
                        {exp}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#94a3b8] font-medium flex items-center gap-1">
                    <FileText size={12} />
                    Notes
                  </span>
                  {!isEditingNotes && (
                    <button
                      onClick={onEditNotes}
                      className="text-xs text-[#8b5cf6] hover:underline"
                    >
                      {entry.notes ? "Edit" : "Add"}
                    </button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={notesInput}
                      onChange={(e) => onNotesChange(e.target.value)}
                      placeholder="Add notes about this test..."
                      className="w-full px-3 py-2 rounded-lg text-xs text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#8b5cf6] focus:outline-none resize-none placeholder:text-[#475569]"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={onSaveNotes}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: "#8b5cf620",
                          color: "#8b5cf6",
                          border: "1px solid #8b5cf640",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={onCancelNotes}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: "#111827",
                          color: "#94a3b8",
                          border: "1px solid #2a3654",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#f1f5f9] px-2 py-2 rounded bg-[#111827] min-h-[40px]">
                    {entry.notes || (
                      <span className="text-[#475569] italic">No notes</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onDelete}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: "#ef444420",
                    color: "#ef4444",
                    border: "1px solid #ef444440",
                  }}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#475569] w-16">{label}</span>
      <span className="text-[#f1f5f9] font-medium truncate" title={value}>
        {value}
      </span>
    </div>
  );
}
