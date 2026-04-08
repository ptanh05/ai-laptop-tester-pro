/**
 * AI Scoring System — Rule-based weighted scoring engine
 * No external API required.
 */

export type Verdict = "GOOD ✅" | "ACCEPTABLE ⚠️" | "AVOID ❌";
export type Recommendation = "BUY" | "CONSIDER" | "AVOID";

export interface ScoringInput {
  cpuMaxTemp: number;
  gpuMaxTemp: number;
  benchmarkScore: number;
  ssdSeqRead: number;
  ssdSeqWrite: number;
  ramPass: boolean;
  avgCpuUsage: number;
  durationSec: number;
}

export interface ScoreExplanation {
  text: string;
  type: "CRITICAL" | "WARNING" | "CAUTION" | "MINOR" | "GOOD" | "INFO";
  delta: number;
}

export interface ScoringResult {
  score: number; // 0–100
  verdict: Verdict;
  recommendation: Recommendation;
  explanations: ScoreExplanation[];
  breakdown: {
    cpuPenalty: number;
    gpuPenalty: number;
    ramPenalty: number;
    ssdPenalty: number;
    benchmarkBonus: number;
    usageBonus: number;
    durationBonus: number;
  };
}

export function getTempColor(temp: number): string {
  if (temp < 0) return "#475569"; // muted
  if (temp <= 70) return "#22c55e"; // green
  if (temp <= 85) return "#f59e0b"; // yellow/amber
  if (temp <= 95) return "#f97316"; // orange
  return "#ef4444"; // red
}

export function getTempLabel(temp: number): string {
  if (temp < 0) return "NO DATA";
  if (temp <= 70) return "COOL";
  if (temp <= 85) return "WARM";
  if (temp <= 95) return "HOT";
  return "CRITICAL";
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function getVerdict(score: number): Verdict {
  if (score >= 80) return "GOOD ✅";
  if (score >= 50) return "ACCEPTABLE ⚠️";
  return "AVOID ❌";
}

export function getRecommendation(score: number): Recommendation {
  if (score >= 80) return "BUY";
  if (score >= 50) return "CONSIDER";
  return "AVOID";
}

export function evaluateScore(input: ScoringInput): ScoringResult {
  let score = 100;
  const explanations: ScoreExplanation[] = [];
  const breakdown = {
    cpuPenalty: 0,
    gpuPenalty: 0,
    ramPenalty: 0,
    ssdPenalty: 0,
    benchmarkBonus: 0,
    usageBonus: 0,
    durationBonus: 0,
  };

  // ── CPU Temperature Penalty ────────────────────────────────────────────────
  if (input.cpuMaxTemp > 95) {
    const pen = -40;
    score += pen;
    breakdown.cpuPenalty = pen;
    explanations.push({
      text: `🔴 CRITICAL: CPU max temp ${input.cpuMaxTemp}°C → ${pen} points`,
      type: "CRITICAL",
      delta: pen,
    });
  } else if (input.cpuMaxTemp > 90) {
    const pen = -25;
    score += pen;
    breakdown.cpuPenalty = pen;
    explanations.push({
      text: `🔴 WARNING: CPU max temp ${input.cpuMaxTemp}°C → ${pen} points`,
      type: "CRITICAL",
      delta: pen,
    });
  } else if (input.cpuMaxTemp > 85) {
    const pen = -12;
    score += pen;
    breakdown.cpuPenalty = pen;
    explanations.push({
      text: `🟡 CAUTION: CPU max temp ${input.cpuMaxTemp}°C → ${pen} points`,
      type: "CAUTION",
      delta: pen,
    });
  } else if (input.cpuMaxTemp > 75) {
    const pen = -4;
    score += pen;
    breakdown.cpuPenalty = pen;
    explanations.push({
      text: `🟢 Minor: CPU max temp ${input.cpuMaxTemp}°C → ${pen} points`,
      type: "MINOR",
      delta: pen,
    });
  } else if (input.cpuMaxTemp > 0) {
    explanations.push({
      text: `🟢 CPU temp ${input.cpuMaxTemp}°C within safe range`,
      type: "GOOD",
      delta: 0,
    });
  }

  // ── GPU Temperature Penalty ───────────────────────────────────────────────
  if (input.gpuMaxTemp > 85) {
    const pen = -30;
    score += pen;
    breakdown.gpuPenalty = pen;
    explanations.push({
      text: `🔴 CRITICAL: GPU max temp ${input.gpuMaxTemp}°C → ${pen} points`,
      type: "CRITICAL",
      delta: pen,
    });
  } else if (input.gpuMaxTemp > 80) {
    const pen = -18;
    score += pen;
    breakdown.gpuPenalty = pen;
    explanations.push({
      text: `🟠 WARNING: GPU max temp ${input.gpuMaxTemp}°C → ${pen} points`,
      type: "WARNING",
      delta: pen,
    });
  } else if (input.gpuMaxTemp > 75) {
    const pen = -8;
    score += pen;
    breakdown.gpuPenalty = pen;
    explanations.push({
      text: `🟡 CAUTION: GPU max temp ${input.gpuMaxTemp}°C → ${pen} points`,
      type: "CAUTION",
      delta: pen,
    });
  } else if (input.gpuMaxTemp > 0) {
    explanations.push({
      text: `🟢 GPU temp ${input.gpuMaxTemp}°C within safe range`,
      type: "GOOD",
      delta: 0,
    });
  }

  // ── RAM Stability Penalty ─────────────────────────────────────────────────
  if (!input.ramPass) {
    const pen = -50;
    score += pen;
    breakdown.ramPenalty = pen;
    explanations.push({
      text: `🔴 RAM stability test FAILED → ${pen} points`,
      type: "CRITICAL",
      delta: pen,
    });
  } else {
    explanations.push({
      text: "🟢 RAM stability test PASSED",
      type: "GOOD",
      delta: 0,
    });
  }

  // ── SSD Speed Penalty ─────────────────────────────────────────────────────
  if (input.ssdSeqRead < 500) {
    const pen = -25;
    score += pen;
    breakdown.ssdPenalty = pen;
    explanations.push({
      text: `🔴 SSD seq read ${input.ssdSeqRead.toFixed(0)} MB/s (slow) → ${pen} points`,
      type: "CRITICAL",
      delta: pen,
    });
  } else if (input.ssdSeqRead < 1000) {
    const pen = -12;
    score += pen;
    breakdown.ssdPenalty = pen;
    explanations.push({
      text: `🟠 SSD seq read ${input.ssdSeqRead.toFixed(0)} MB/s (moderate) → ${pen} points`,
      type: "WARNING",
      delta: pen,
    });
  } else if (input.ssdSeqRead < 2000) {
    const pen = -4;
    score += pen;
    breakdown.ssdPenalty = pen;
    explanations.push({
      text: `🟡 SSD seq read ${input.ssdSeqRead.toFixed(0)} MB/s (good) → ${pen} points`,
      type: "CAUTION",
      delta: pen,
    });
  } else {
    explanations.push({
      text: `🟢 SSD seq read ${input.ssdSeqRead.toFixed(0)} MB/s (excellent)`,
      type: "GOOD",
      delta: 0,
    });
  }

  // ── Benchmark Bonus ──────────────────────────────────────────────────────
  if (input.benchmarkScore > 20000) {
    const bon = 15;
    score += bon;
    breakdown.benchmarkBonus = bon;
    explanations.push({
      text: `🟢 Excellent benchmark score ${input.benchmarkScore.toFixed(0)} → +${bon} points`,
      type: "GOOD",
      delta: bon,
    });
  } else if (input.benchmarkScore > 10000) {
    const bon = 10;
    score += bon;
    breakdown.benchmarkBonus = bon;
    explanations.push({
      text: `🟢 Good benchmark score ${input.benchmarkScore.toFixed(0)} → +${bon} points`,
      type: "GOOD",
      delta: bon,
    });
  } else if (input.benchmarkScore > 5000) {
    const bon = 5;
    score += bon;
    breakdown.benchmarkBonus = bon;
    explanations.push({
      text: `🟢 Decent benchmark score ${input.benchmarkScore.toFixed(0)} → +${bon} points`,
      type: "GOOD",
      delta: bon,
    });
  } else if (input.benchmarkScore > 0) {
    explanations.push({
      text: `ℹ️ Benchmark score ${input.benchmarkScore.toFixed(0)} (below bonus threshold)`,
      type: "INFO",
      delta: 0,
    });
  }

  // ── CPU Usage Bonus ───────────────────────────────────────────────────────
  if (input.avgCpuUsage > 80) {
    const bon = 3;
    score += bon;
    breakdown.usageBonus = bon;
    explanations.push({
      text: `🟢 High average CPU usage ${input.avgCpuUsage.toFixed(0)}% → +${bon} points`,
      type: "GOOD",
      delta: bon,
    });
  }

  // ── Duration Bonus ───────────────────────────────────────────────────────
  if (input.durationSec >= 900) {
    const bon = 5;
    score += bon;
    breakdown.durationBonus = bon;
    explanations.push({
      text: "🟢 Full 15-min test completed → +5 points",
      type: "GOOD",
      delta: bon,
    });
  } else if (input.durationSec >= 600) {
    const bon = 3;
    score += bon;
    breakdown.durationBonus = bon;
    explanations.push({
      text: `🟢 ${(input.durationSec / 60).toFixed(0)}-min test completed → +${bon} points`,
      type: "GOOD",
      delta: bon,
    });
  }

  // ── Clamp score ──────────────────────────────────────────────────────────
  const clampedScore = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  return {
    score: clampedScore,
    verdict: getVerdict(clampedScore),
    recommendation: getRecommendation(clampedScore),
    explanations,
    breakdown,
  };
}