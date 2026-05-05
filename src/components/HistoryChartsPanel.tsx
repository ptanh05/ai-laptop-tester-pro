"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Calendar, Filter } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getTestHistory, type TestHistoryEntry } from "@/lib/test-history";
import { getScoreColor } from "@/lib/ai-scoring";

type TimeRange = "7d" | "30d" | "90d" | "all";
type ChartType = "score" | "temperature" | "performance";

export default function HistoryChartsPanel() {
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [chartType, setChartType] = useState<ChartType>("score");

  useEffect(() => {
    setHistory(getTestHistory());
  }, []);

  const filterByTimeRange = (tests: TestHistoryEntry[]): TestHistoryEntry[] => {
    if (timeRange === "all") return tests;

    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
      "all": Infinity,
    };

    const cutoff = now - ranges[timeRange];
    return tests.filter((t) => t.timestamp >= cutoff);
  };

  const filteredHistory = filterByTimeRange(history);

  const chartData = filteredHistory.map((test) => ({
    date: new Date(test.timestamp).toLocaleDateString("vi-VN", {
      month: "short",
      day: "numeric",
    }),
    timestamp: test.timestamp,
    score: test.result.score,
    cpuTemp: test.result.metrics.cpu_temp,
    gpuTemp: test.result.metrics.gpu_temp,
    cpuUsage: test.result.metrics.cpu_usage,
    duration: test.result.duration_sec / 60, // minutes
  }));

  const avgScore = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length
    : 0;

  const trend = chartData.length >= 2
    ? chartData[chartData.length - 1].score - chartData[0].score
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <TrendingUp size={16} className="text-[#06b6d4]" />
          History Charts
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-[#06b6d420] text-[#06b6d4] border border-[#06b6d440] font-medium">
          {filteredHistory.length} tests
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-[#94a3b8]">
          <Calendar size={12} />
          <span>Range:</span>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className="px-2 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: timeRange === range ? "#06b6d420" : "#1a2235",
                color: timeRange === range ? "#06b6d4" : "#94a3b8",
                border: `1px solid ${timeRange === range ? "#06b6d440" : "#2a3654"}`,
              }}
            >
              {range === "all" ? "All" : range.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs text-[#94a3b8] ml-4">
          <Filter size={12} />
          <span>Chart:</span>
        </div>
        <div className="flex gap-1">
          {(["score", "temperature", "performance"] as ChartType[]).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className="px-2 py-1 rounded text-xs font-medium transition-all capitalize"
              style={{
                backgroundColor: chartType === type ? "#06b6d420" : "#1a2235",
                color: chartType === type ? "#06b6d4" : "#94a3b8",
                border: `1px solid ${chartType === type ? "#06b6d440" : "#2a3654"}`,
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Avg Score"
            value={avgScore.toFixed(1)}
            color={getScoreColor(avgScore)}
          />
          <StatCard
            label="Trend"
            value={trend >= 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1)}
            color={trend >= 0 ? "#22c55e" : "#ef4444"}
          />
          <StatCard
            label="Total Tests"
            value={chartData.length.toString()}
            color="#06b6d4"
          />
        </div>
      )}

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="text-center py-12 text-[#475569] text-sm">
          No test data in selected time range
        </div>
      ) : (
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: "#1a2235", border: "1px solid #2a3654" }}
        >
          {chartType === "score" && <ScoreChart data={chartData} />}
          {chartType === "temperature" && <TemperatureChart data={chartData} />}
          {chartType === "performance" && <PerformanceChart data={chartData} />}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="p-3 rounded-lg text-center"
      style={{ backgroundColor: "#1a2235", border: "1px solid #2a3654" }}
    >
      <div className="text-xs text-[#94a3b8] mb-1">{label}</div>
      <div className="text-xl font-black metric-value" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ScoreChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          style={{ fontSize: "10px" }}
        />
        <YAxis
          stroke="#94a3b8"
          style={{ fontSize: "10px" }}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a2235",
            border: "1px solid #2a3654",
            borderRadius: "8px",
            fontSize: "11px",
          }}
          labelStyle={{ color: "#f1f5f9" }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#06b6d4"
          strokeWidth={2}
          dot={{ fill: "#06b6d4", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TemperatureChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          style={{ fontSize: "10px" }}
        />
        <YAxis
          stroke="#94a3b8"
          style={{ fontSize: "10px" }}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a2235",
            border: "1px solid #2a3654",
            borderRadius: "8px",
            fontSize: "11px",
          }}
          labelStyle={{ color: "#f1f5f9" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
        />
        <Line
          type="monotone"
          dataKey="cpuTemp"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: "#ef4444", r: 3 }}
          name="CPU Temp (°C)"
        />
        <Line
          type="monotone"
          dataKey="gpuTemp"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ fill: "#f59e0b", r: 3 }}
          name="GPU Temp (°C)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PerformanceChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          style={{ fontSize: "10px" }}
        />
        <YAxis
          stroke="#94a3b8"
          style={{ fontSize: "10px" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a2235",
            border: "1px solid #2a3654",
            borderRadius: "8px",
            fontSize: "11px",
          }}
          labelStyle={{ color: "#f1f5f9" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
        />
        <Bar dataKey="cpuUsage" fill="#3b82f6" name="CPU Usage (%)" />
        <Bar dataKey="duration" fill="#8b5cf6" name="Duration (min)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
