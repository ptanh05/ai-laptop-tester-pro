/**
 * AI Scoring System v2 — Tier-aware relative scoring engine
 * No external API required. Designed for multi-machine testing.
 */

export type CpuTier = "entry" | "lowmid" | "mid" | "high" | "enthusiast";

export const CPU_TIER_LABELS: Record<CpuTier, string> = {
  entry: "ENTRY",
  lowmid: "LOW-MID",
  mid: "MID",
  high: "HIGH",
  enthusiast: "ENTHUSIAST",
};

export const CPU_TIER_COLORS: Record<CpuTier, string> = {
  entry: "#94a3b8",
  lowmid: "#f59e0b",
  mid: "#22c55e",
  high: "#3b82f6",
  enthusiast: "#a855f7",
};

// Maximum reasonable Cinebench R23 multi-core scores per tier
export const BENCHMARK_MAX: Record<CpuTier, number> = {
  entry: 500,
  lowmid: 3000,
  mid: 15000,
  high: 25000,
  enthusiast: 50000,
};

export type Verdict = "GOOD ✅" | "ACCEPTABLE ⚠️" | "AVOID ❌";
export type Recommendation = "BUY" | "CONSIDER" | "AVOID";

export interface ScoringInput {
  // ── Temperature ──────────────────────────────────────────────────────────
  cpuMaxTemp: number;
  gpuMaxTemp: number;

  // ── Performance ──────────────────────────────────────────────────────────
  benchmarkScore: number;
  ssdSeqRead: number;
  ssdSeqWrite: number;
  ramPass: boolean;

  // ── Usage ────────────────────────────────────────────────────────────────
  avgCpuUsage: number;
  durationSec: number;

  // ── NEW: Tier-aware scoring ───────────────────────────────────────────────
  cpuTier: CpuTier;
  batteryHealth: number;   // 0–100, -1 = unknown
  drainRate: number;       // %/min, 0 = not measured / charging / unavailable
  networkDownMbps: number;
  networkUpMbps: number;
  networkLatencyMs: number;
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
    batteryPenalty: number;
    networkBonus: number;
    usageBonus: number;
    durationBonus: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getTempColor(temp: number): string {
  if (temp < 0) return "#475569";
  if (temp <= 70) return "#22c55e";
  if (temp <= 85) return "#f59e0b";
  if (temp <= 95) return "#f97316";
  return "#ef4444";
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

// ── Core Scoring Engine ────────────────────────────────────────────────────────

export function evaluateScore(input: ScoringInput): ScoringResult {
  let score = 100;
  const explanations: ScoreExplanation[] = [];
  const breakdown = {
    cpuPenalty: 0,
    gpuPenalty: 0,
    ramPenalty: 0,
    ssdPenalty: 0,
    benchmarkBonus: 0,
    batteryPenalty: 0,
    networkBonus: 0,
    usageBonus: 0,
    durationBonus: 0,
  };

  // ── CPU Temperature ───────────────────────────────────────────────────────
  if (input.cpuMaxTemp > 95) {
    const pen = -40;
    score += pen; breakdown.cpuPenalty = pen;
    explanations.push({ text: `🔴 CRITICAL: CPU ${input.cpuMaxTemp}°C → ${pen} pts`, type: "CRITICAL", delta: pen });
  } else if (input.cpuMaxTemp > 90) {
    const pen = -25;
    score += pen; breakdown.cpuPenalty = pen;
    explanations.push({ text: `🔴 WARNING: CPU ${input.cpuMaxTemp}°C → ${pen} pts`, type: "CRITICAL", delta: pen });
  } else if (input.cpuMaxTemp > 85) {
    const pen = -12;
    score += pen; breakdown.cpuPenalty = pen;
    explanations.push({ text: `🟡 CAUTION: CPU ${input.cpuMaxTemp}°C → ${pen} pts`, type: "CAUTION", delta: pen });
  } else if (input.cpuMaxTemp > 75) {
    const pen = -4;
    score += pen; breakdown.cpuPenalty = pen;
    explanations.push({ text: `🟢 Minor: CPU ${input.cpuMaxTemp}°C → ${pen} pts`, type: "MINOR", delta: pen });
  } else if (input.cpuMaxTemp > 0) {
    explanations.push({ text: `🟢 CPU ${input.cpuMaxTemp}°C — safe`, type: "GOOD", delta: 0 });
  }

  // ── GPU Temperature ───────────────────────────────────────────────────────
  if (input.gpuMaxTemp > 85) {
    const pen = -30;
    score += pen; breakdown.gpuPenalty = pen;
    explanations.push({ text: `🔴 CRITICAL: GPU ${input.gpuMaxTemp}°C → ${pen} pts`, type: "CRITICAL", delta: pen });
  } else if (input.gpuMaxTemp > 80) {
    const pen = -18;
    score += pen; breakdown.gpuPenalty = pen;
    explanations.push({ text: `🟠 WARNING: GPU ${input.gpuMaxTemp}°C → ${pen} pts`, type: "WARNING", delta: pen });
  } else if (input.gpuMaxTemp > 75) {
    const pen = -8;
    score += pen; breakdown.gpuPenalty = pen;
    explanations.push({ text: `🟡 CAUTION: GPU ${input.gpuMaxTemp}°C → ${pen} pts`, type: "CAUTION", delta: pen });
  } else if (input.gpuMaxTemp > 0) {
    explanations.push({ text: `🟢 GPU ${input.gpuMaxTemp}°C — safe`, type: "GOOD", delta: 0 });
  }

  // ── RAM Stability ─────────────────────────────────────────────────────────
  if (!input.ramPass) {
    const pen = -50;
    score += pen; breakdown.ramPenalty = pen;
    explanations.push({ text: `🔴 RAM FAILED → ${pen} pts`, type: "CRITICAL", delta: pen });
  } else {
    explanations.push({ text: "🟢 RAM PASSED", type: "GOOD", delta: 0 });
  }

  // ── SSD Speed ─────────────────────────────────────────────────────────────
  if (input.ssdSeqRead < 500) {
    const pen = -25;
    score += pen; breakdown.ssdPenalty = pen;
    explanations.push({ text: `🔴 SSD read ${input.ssdSeqRead.toFixed(0)} MB/s (slow) → ${pen} pts`, type: "CRITICAL", delta: pen });
  } else if (input.ssdSeqRead < 1000) {
    const pen = -12;
    score += pen; breakdown.ssdPenalty = pen;
    explanations.push({ text: `🟠 SSD read ${input.ssdSeqRead.toFixed(0)} MB/s → ${pen} pts`, type: "WARNING", delta: pen });
  } else if (input.ssdSeqRead < 2000) {
    const pen = -4;
    score += pen; breakdown.ssdPenalty = pen;
    explanations.push({ text: `🟡 SSD read ${input.ssdSeqRead.toFixed(0)} MB/s (good) → ${pen} pts`, type: "CAUTION", delta: pen });
  } else {
    explanations.push({ text: `🟢 SSD read ${input.ssdSeqRead.toFixed(0)} MB/s — excellent`, type: "GOOD", delta: 0 });
  }

  // ── RELATIVE BENCHMARK SCORING ─────────────────────────────────────────────
  if (input.benchmarkScore > 0) {
    const max = BENCHMARK_MAX[input.cpuTier] ?? 3000;
    const ratio = Math.min(input.benchmarkScore / max, 1.0);
    const pct = Math.round(ratio * 100);

    if (ratio >= 0.80) {
      const bon = 15;
      score += bon; breakdown.benchmarkBonus = bon;
      explanations.push({ text: `🟢 Benchmark ${input.benchmarkScore.toFixed(0)}/${max.toFixed(0)} (${pct}% of tier max) → +${bon} pts`, type: "GOOD", delta: bon });
    } else if (ratio >= 0.50) {
      const bon = 10;
      score += bon; breakdown.benchmarkBonus = bon;
      explanations.push({ text: `🟢 Benchmark ${input.benchmarkScore.toFixed(0)}/${max.toFixed(0)} (${pct}% of tier max) → +${bon} pts`, type: "GOOD", delta: bon });
    } else if (ratio >= 0.25) {
      const bon = 5;
      score += bon; breakdown.benchmarkBonus = bon;
      explanations.push({ text: `🟡 Benchmark ${input.benchmarkScore.toFixed(0)}/${max.toFixed(0)} (${pct}% of tier max) → +${bon} pts`, type: "CAUTION", delta: bon });
    } else {
      explanations.push({ text: `🟡 Benchmark ${input.benchmarkScore.toFixed(0)}/${max.toFixed(0)} (${pct}% of tier max) → +2 pts`, type: "MINOR", delta: 0 });
    }
  } else {
    explanations.push({ text: "ℹ️ No benchmark score", type: "INFO", delta: 0 });
  }

  // ── Battery Health ─────────────────────────────────────────────────────────
  if (input.batteryHealth >= 0) {
    if (input.batteryHealth < 30) {
      const pen = -30;
      score += pen; breakdown.batteryPenalty = pen;
      explanations.push({ text: `🔴 Battery health critically low: ${input.batteryHealth}% → ${pen} pts`, type: "CRITICAL", delta: pen });
    } else if (input.batteryHealth < 50) {
      const pen = -20;
      score += pen; breakdown.batteryPenalty = pen;
      explanations.push({ text: `🔴 Battery health degraded: ${input.batteryHealth}% → ${pen} pts`, type: "CRITICAL", delta: pen });
    } else if (input.batteryHealth < 70) {
      const pen = -10;
      score += pen; breakdown.batteryPenalty = pen;
      explanations.push({ text: `🟠 Battery health reduced: ${input.batteryHealth}% → ${pen} pts`, type: "WARNING", delta: pen });
    } else if (input.batteryHealth < 80) {
      const pen = -5;
      score += pen; breakdown.batteryPenalty = pen;
      explanations.push({ text: `🟡 Battery health: ${input.batteryHealth}% → ${pen} pts`, type: "CAUTION", delta: pen });
    } else {
      explanations.push({ text: `🟢 Battery health: ${input.batteryHealth}% — good`, type: "GOOD", delta: 0 });
    }
  } else {
    explanations.push({ text: "ℹ️ Battery health: unknown (WMI not available)", type: "INFO", delta: 0 });
  }

  // ── Battery Drain Rate ───────────────────────────────────────────────────
  if (input.drainRate > 0) {
    if (input.drainRate > 3.0) {
      const pen = -15;
      score += pen; breakdown.batteryPenalty += pen;
      explanations.push({ text: `🔴 Extremely high drain: ${input.drainRate.toFixed(2)}%/min → ${pen} pts`, type: "CRITICAL", delta: pen });
    } else if (input.drainRate > 2.0) {
      const pen = -10;
      score += pen; breakdown.batteryPenalty += pen;
      explanations.push({ text: `🔴 High drain: ${input.drainRate.toFixed(2)}%/min → ${pen} pts`, type: "CRITICAL", delta: pen });
    } else if (input.drainRate > 1.0) {
      const pen = -5;
      score += pen; breakdown.batteryPenalty += pen;
      explanations.push({ text: `🟠 Moderate drain: ${input.drainRate.toFixed(2)}%/min → ${pen} pts`, type: "WARNING", delta: pen });
    } else {
      explanations.push({ text: `🟢 Drain rate: ${input.drainRate.toFixed(2)}%/min — normal`, type: "GOOD", delta: 0 });
    }
  } else {
    explanations.push({ text: "ℹ️ Drain rate: not measured (charging/unavailable)", type: "INFO", delta: 0 });
  }

  // ── Network Score ──────────────────────────────────────────────────────────
  if (input.networkDownMbps > 0 || input.networkUpMbps > 0) {
    if (input.networkDownMbps >= 100 && input.networkLatencyMs < 30) {
      const bon = 3;
      score += bon; breakdown.networkBonus = bon;
      explanations.push({ text: `🟢 Network: ${input.networkDownMbps.toFixed(0)}/${input.networkUpMbps.toFixed(0)} Mbps, ${input.networkLatencyMs.toFixed(0)}ms → +${bon} pts`, type: "GOOD", delta: bon });
    } else if (input.networkDownMbps >= 50) {
      const bon = 1;
      score += bon; breakdown.networkBonus = bon;
      explanations.push({ text: `🟡 Network: ${input.networkDownMbps.toFixed(0)}/${input.networkUpMbps.toFixed(0)} Mbps, ${input.networkLatencyMs.toFixed(0)}ms → +${bon} pt`, type: "INFO", delta: bon });
    } else if (input.networkDownMbps < 5) {
      const pen = -10;
      score += pen; breakdown.networkBonus = pen;
      explanations.push({ text: `🔴 Very slow network: ${input.networkDownMbps.toFixed(0)} Mbps down → ${pen} pts`, type: "CRITICAL", delta: pen });
    } else if (input.networkDownMbps < 20) {
      const pen = -5;
      score += pen; breakdown.networkBonus = pen;
      explanations.push({ text: `🟠 Slow network: ${input.networkDownMbps.toFixed(0)} Mbps down → ${pen} pts`, type: "WARNING", delta: pen });
    } else {
      explanations.push({ text: `🟡 Network: ${input.networkDownMbps.toFixed(0)}/${input.networkUpMbps.toFixed(0)} Mbps, ${input.networkLatencyMs.toFixed(0)}ms`, type: "INFO", delta: 0 });
    }
  }

  // ── CPU Usage Bonus ───────────────────────────────────────────────────────
  if (input.avgCpuUsage > 80) {
    const bon = 3;
    score += bon; breakdown.usageBonus = bon;
    explanations.push({ text: `🟢 High CPU usage ${input.avgCpuUsage.toFixed(0)}% → +${bon} pts`, type: "GOOD", delta: bon });
  }

  // ── Duration Bonus ─────────────────────────────────────────────────────────
  if (input.durationSec >= 900) {
    const bon = 5;
    score += bon; breakdown.durationBonus = bon;
    explanations.push({ text: "🟢 Full 15-min test → +5 pts", type: "GOOD", delta: bon });
  } else if (input.durationSec >= 600) {
    const bon = 3;
    score += bon; breakdown.durationBonus = bon;
    explanations.push({ text: `🟢 ${(input.durationSec / 60).toFixed(0)}-min test → +${bon} pts`, type: "GOOD", delta: bon });
  }

  // ── Clamp ─────────────────────────────────────────────────────────────────
  const clampedScore = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  return {
    score: clampedScore,
    verdict: getVerdict(clampedScore),
    recommendation: getRecommendation(clampedScore),
    explanations,
    breakdown,
  };
}