/**
 * Benchmark Result Parsers — Extract scores from Cinebench R23 & CrystalDiskMark text
 */

export interface CinebenchResult {
  cpuSingleCore: number;
  cpuMultiCore: number;
  mpRatio: number;
}

export interface CrystalDiskMarkResult {
  seqRead: number;    // MB/s
  seqWrite: number;   // MB/s
  rdmReadIOPS: number;
  rdmWriteIOPS: number;
}

// ── Cinebench R23 Parser ─────────────────────────────────────────────────────

export function parseCinebenchR23(text: string): CinebenchResult | null {
  // Try to find single/multi core scores in various formats
  // Cinebench R23 output typically looks like:
  // CPU (Multi Core)        15234 pts
  // CPU (Single Core)        1892 pts
  // MP Ratio                8.06 x

  const multiMatch = text.match(/CPU\s*\(?Multi Core\)?[:\s]+([\d,.]+)\s*(?:pts?|points?|score)/i);
  const singleMatch = text.match(/CPU\s*\(?Single Core\)?[:\s]+([\d,.]+)\s*(?:pts?|points?|score)/i);
  const ratioMatch = text.match(/MP Ratio[:\s]+([\d,.]+)\s*x/i);

  if (!multiMatch && !singleMatch) {
    // Fallback: look for any large numbers that could be scores
    const numbers = text.match(/[\d,]+/g);
    if (!numbers || numbers.length < 2) return null;

    // Sort by value descending, largest is probably multi-core
    const vals = numbers
      .map((n) => parseInt(n.replace(/,/g, ""), 10))
      .filter((n) => !isNaN(n) && n > 500 && n < 100000)
      .sort((a, b) => b - a);

    if (vals.length < 1) return null;
    return {
      cpuMultiCore: vals[0],
      cpuSingleCore: vals[1] || Math.round(vals[0] / 8),
      mpRatio: vals[1] ? vals[0] / vals[1] : 8,
    };
  }

  const cpuMultiCore = multiMatch
    ? parseInt(multiMatch[1].replace(/,/g, ""), 10)
    : 0;
  const cpuSingleCore = singleMatch
    ? parseInt(singleMatch[1].replace(/,/g, ""), 10)
    : 0;

  const ratio = ratioMatch
    ? parseFloat(ratioMatch[1].replace(/,/g, ""))
    : cpuSingleCore > 0
      ? cpuMultiCore / cpuSingleCore
      : 0;

  if (cpuMultiCore <= 0 && cpuSingleCore <= 0) return null;

  return { cpuMultiCore, cpuSingleCore, mpRatio: ratio };
}

// ── CrystalDiskMark Parser ───────────────────────────────────────────────────

export function parseCrystalDiskMark(text: string): CrystalDiskMarkResult | null {
  // CrystalDiskMark output format (typical):
  // -----------------------------------------------------------------------
  // |  Test Name        | Read(MB/s) | Write(MB/s) |
  // -----------------------------------------------------------------------
  // |  SEQ1M|Q8T1      |   3456.78   |   2345.67   |
  // |  SEQ1M|Q1T1      |   1234.56   |   1234.56   |
  // |  RND4K|Q32T16    |   456.78    |   345.67    |
  // |  RND4K|Q1T1      |   67.89     |   56.78     |
  // -----------------------------------------------------------------------

  const lines = text.split("\n");
  let seqRead = 0;
  let seqWrite = 0;
  let rdmReadIOPS = 0;
  let rdmWriteIOPS = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Try various patterns for sequential read
    if (/(seq|SEQ|Seq)/.test(trimmed)) {
      const match = trimmed.match(/(\d{2,}[,.]?\d{0,2})/g);
      if (match && match.length >= 2) {
        seqRead = Math.max(seqRead, parseFloat(match[0].replace(/,/g, "")));
        seqWrite = Math.max(seqWrite, parseFloat(match[1].replace(/,/g, "")));
      }
    }

    // Parse read/write values from tabular data
    const tabMatch = trimmed.match(/(?:SEQ|RND).*[|:\t]\s*(\d[\d,.]*)\s*[|:\t]\s*(\d[\d,.]*)/);
    if (tabMatch) {
      const read = parseFloat(tabMatch[1].replace(/,/g, ""));
      const write = parseFloat(tabMatch[2].replace(/,/g, ""));
      if (read > seqRead) seqRead = read;
      if (write > seqWrite) seqWrite = write;
    }

    // IOPS patterns
    if (/(iops|IOPS|Iops)/.test(trimmed)) {
      const iopsMatch = trimmed.match(/(\d{2,}[,.]?\d{0,2})/g);
      if (iopsMatch && iopsMatch.length >= 2) {
        rdmReadIOPS = Math.max(rdmReadIOPS, parseFloat(iopsMatch[0].replace(/,/g, "")));
        rdmWriteIOPS = Math.max(rdmWriteIOPS, parseFloat(iopsMatch[1].replace(/,/g, "")));
      }
    }
  }

  // Second pass: look for any clear sequential numbers if first pass failed
  if (seqRead === 0 && seqWrite === 0) {
    const allNumbers = text.match(/(\d{3,}[,.]?\d{0,2})\s*(?:MB\/s|mb\/s)/gi);
    if (allNumbers && allNumbers.length >= 2) {
      const vals = allNumbers.map((n) =>
        parseFloat(n.replace(/,/g, "").replace(/\s*MB\/s/i, ""))
      );
      // In most benchmark results, first half are read, second half are write
      seqRead = vals[0] || 0;
      seqWrite = vals[1] || 0;
    }
  }

  if (seqRead <= 0 && seqWrite <= 0) return null;

  return { seqRead, seqWrite, rdmReadIOPS, rdmWriteIOPS };
}

// ── Paste Detection ────────────────────────────────────────────────────────────

export type BenchmarkType = "cinebench" | "crystaldiskmark" | "unknown";

export function detectBenchmarkType(text: string): BenchmarkType {
  const lower = text.toLowerCase();
  if (lower.includes("cinebench") || lower.includes("maxon")) return "cinebench";
  if (lower.includes("crystaldiskmark") || lower.includes("crystal disk")) return "crystaldiskmark";
  if (lower.includes("seq") && lower.includes("read") && lower.includes("write")) return "crystaldiskmark";
  if (lower.includes("single core") && lower.includes("multi core")) return "cinebench";
  return "unknown";
}

export function parseBenchmark(text: string): {
  type: BenchmarkType;
  cinebench: CinebenchResult | null;
  crystalDisk: CrystalDiskMarkResult | null;
} {
  const type = detectBenchmarkType(text);

  switch (type) {
    case "cinebench":
      return { type, cinebench: parseCinebenchR23(text), crystalDisk: null };
    case "crystaldiskmark":
      return { type, cinebench: null, crystalDisk: parseCrystalDiskMark(text) };
    default:
      // Try both parsers
      const cb = parseCinebenchR23(text);
      const cd = parseCrystalDiskMark(text);
      if (cb) return { type: "cinebench", cinebench: cb, crystalDisk: null };
      if (cd) return { type: "crystaldiskmark", cinebench: null, crystalDisk: cd };
      return { type: "unknown", cinebench: null, crystalDisk: null };
  }
}

// ── Sample data for testing ──────────────────────────────────────────────────

export const CINEBENCH_SAMPLE = `Cinebench R23

CPU (Multi Core)        15234 pts
CPU (Single Core)        1892 pts
MP Ratio                8.06 x`;

export const CRYSTALDISK_SAMPLE = `CrystalDiskMark 8.0.4 x64

-----------------------------------------------------------------------
|  Test Name        | Read(MB/s) | Write(MB/s) |
-----------------------------------------------------------------------
|  SEQ1M|Q8T1      |   3456.78   |   2345.67   |
|  SEQ1M|Q1T1      |   1234.56   |   1234.56   |
|  RND4K|Q32T16    |   456.78    |   345.67    |
|  RND4K|Q1T1      |   67.89     |   56.78     |
-----------------------------------------------------------------------`;
