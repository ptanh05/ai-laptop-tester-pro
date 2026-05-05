"use client";

import { TestResult } from "./tauri";

export interface TestHistoryEntry {
  id: string;
  timestamp: number;
  date: string;
  result: TestResult;
  systemInfo: {
    cpu: string;
    gpu: string;
    ram: string;
  };
  notes?: string;
}

const STORAGE_KEY = "ai-laptop-tester-history";
const MAX_HISTORY = 50;

export function saveTestToHistory(
  result: TestResult,
  systemInfo: { cpu: string; gpu: string; ram: string },
  notes?: string
): TestHistoryEntry {
  const entry: TestHistoryEntry = {
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    date: new Date().toISOString(),
    result,
    systemInfo,
    notes,
  };

  const history = getTestHistory();
  history.unshift(entry);

  // Keep only last MAX_HISTORY entries
  const trimmed = history.slice(0, MAX_HISTORY);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Failed to save test history:", e);
  }

  return entry;
}

export function getTestHistory(): TestHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load test history:", e);
    return [];
  }
}

export function deleteTestFromHistory(id: string): void {
  const history = getTestHistory();
  const filtered = history.filter((entry) => entry.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to delete test from history:", e);
  }
}

export function clearTestHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear test history:", e);
  }
}

export function updateTestNotes(id: string, notes: string): void {
  const history = getTestHistory();
  const updated = history.map((entry) =>
    entry.id === id ? { ...entry, notes } : entry
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to update test notes:", e);
  }
}

export function getTestById(id: string): TestHistoryEntry | null {
  const history = getTestHistory();
  return history.find((entry) => entry.id === id) || null;
}

export function exportHistoryToJson(): string {
  const history = getTestHistory();
  return JSON.stringify(history, null, 2);
}

export function importHistoryFromJson(json: string): boolean {
  try {
    const imported = JSON.parse(json);
    if (!Array.isArray(imported)) return false;

    const existing = getTestHistory();
    const merged = [...imported, ...existing];

    // Remove duplicates by id
    const unique = merged.filter(
      (entry, index, self) => self.findIndex((e) => e.id === entry.id) === index
    );

    const trimmed = unique.slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch (e) {
    console.error("Failed to import history:", e);
    return false;
  }
}
