"use client";

import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────────────────────

export type CpuTier = "entry" | "lowmid" | "mid" | "high" | "enthusiast";

export interface SystemMetrics {
  cpu_temp: number;
  gpu_temp: number;
  ram_usage: number;
  cpu_usage: number;
  ram_total_gb: number;
  ram_used_gb: number;
  is_mock: boolean;
}

export interface TestLogEntry {
  timestamp: number;
  cpu_temp: number;
  gpu_temp: number;
  ram_usage: number;
  event: string;
}

export interface TestResult {
  score: number;
  verdict: string;
  recommendation: string;
  explanations: string[];
  metrics: SystemMetrics;
  duration_sec: number;
}

export interface BatteryInfo {
  charge_pct: number;
  is_charging: boolean;
  health_pct: number;    // 0–100, -1 = unknown
  design_cap_mwh: number;
  full_cap_mwh: number;
}

export interface SystemInfo {
  cpu_model: string;
  cpu_cores: number;
  ram_total_gb: number;
  gpu_model: string;
  gpu_vram_gb: number;
  os_version: string;
  battery: BatteryInfo;
  cpu_tier: CpuTier;
  cpu_tier_label: string;
  benchmark_max: number;
}

export interface BatteryDrainResult {
  drain_rate: number;     // %/min
  start_charge: number;  // %
  end_charge: number;    // %
  is_discharging: boolean;
  is_charging: boolean;
}

// ── Tool Paths — EDIT THESE to match your system ──────────────────────────────
export const TOOL_PATHS: Record<string, string> = {
  Cinebench: "C:\\Toolkit\\Cinebench\\Cinebench.exe",
  FurMark: "C:\\Toolkit\\GPU\\FurMark\\furmark.exe",
  MemTest64: "C:\\Toolkit\\MemTest64\\memtest64.exe",
  CrystalDiskMark: "C:\\Toolkit\\DiskMark\\DiskMark64.exe",
};

// ── Commands ─────────────────────────────────────────────────────────────────

export async function getSystemMetrics(): Promise<SystemMetrics> {
  return invoke<SystemMetrics>("get_system_metrics");
}

export async function runTool(toolName: string, paths?: Record<string, string>): Promise<string> {
  const toolPaths = paths ?? TOOL_PATHS;
  const path = toolPaths[toolName];
  if (!path) throw new Error(`Unknown tool: ${toolName}`);
  return invoke<string>("run_program", { path });
}

export async function logEvent(event: string): Promise<void> {
  await invoke("log_test_event", { event });
}

export async function getLogs(): Promise<TestLogEntry[]> {
  return invoke<TestLogEntry[]>("get_test_logs");
}

export async function clearLogs(): Promise<void> {
  await invoke("clear_logs");
}

export async function setTestActive(active: boolean): Promise<void> {
  await invoke("set_test_active", { active });
}

export async function isTestActive(): Promise<boolean> {
  return invoke<boolean>("is_test_active");
}

export async function aiEvaluate(
  cpuMaxTemp: number,
  gpuMaxTemp: number,
  benchmarkScore: number,
  ssdSeqRead: number,
  ssdSeqWrite: number,
  ramPass: boolean,
  cpuUsage: number,
  durationSec: number,
  cpuTier: CpuTier,
  batteryHealth: number,
  drainRate: number,
  networkDown: number,
  networkUp: number,
  networkLatency: number,
): Promise<TestResult> {
  return invoke<TestResult>("ai_evaluate", {
    cpuMaxTemp,
    gpuMaxTemp,
    benchmarkScore,
    ssdSeqRead,
    ssdSeqWrite,
    ramPass,
    cpuUsage,
    durationSec,
    cpuTier,
    batteryHealth,
    drainRate,
    networkDown,
    networkUp,
    networkLatency,
  });
}

export async function exportResultJson(
  path: string,
  result: TestResult,
): Promise<string> {
  return invoke<string>("export_result_json", { path, result });
}

export async function exportResultTxt(
  path: string,
  result: TestResult,
): Promise<string> {
  return invoke<string>("export_result_txt", { path, result });
}

export async function writeLogFile(
  path: string,
  logs: TestLogEntry[],
): Promise<string> {
  return invoke<string>("write_log_file", { path, logs });
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>("get_system_info");
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>("get_app_version");
}

export async function getCpuTier(): Promise<SystemInfo> {
  return invoke<SystemInfo>("get_cpu_tier");
}

export async function measureBatteryDrain(seconds: number): Promise<BatteryDrainResult> {
  return invoke<BatteryDrainResult>("measure_battery_drain", { seconds });
}
