"use client";

import { invoke } from "@tauri-apps/api/core";

export interface SystemMetrics {
  cpu_temp: number;
  gpu_temp: number;
  ram_usage: number;
  cpu_usage: number;
  ram_total_gb: number;
  ram_used_gb: number;
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

export const TOOL_PATHS: Record<string, string> = {
  Cinebench: "C:\\Toolkit\\Cinebench\\Cinebench.exe",
  FurMark: "C:\\Toolkit\\GPU\\FurMark\\furmark.exe",
  MemTest64: "C:\\Toolkit\\MemTest64\\memtest64.exe",
  CrystalDiskMark: "C:\\Toolkit\\DiskMark\\DiskMark64.exe",
};

export async function getSystemMetrics(): Promise<SystemMetrics> {
  try {
    return await invoke<SystemMetrics>("get_system_metrics");
  } catch {
    // Fallback mock in dev mode
    return {
      cpu_temp: 45 + Math.random() * 30,
      gpu_temp: 50 + Math.random() * 25,
      ram_usage: 30 + Math.random() * 40,
      cpu_usage: 10 + Math.random() * 50,
      ram_total_gb: 16,
      ram_used_gb: 8,
    };
  }
}

export async function runTool(toolName: string): Promise<string> {
  const path = TOOL_PATHS[toolName];
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

export async function getAppVersion(): Promise<string> {
  return invoke<string>("get_app_version");
}