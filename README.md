# AI Laptop Tester Pro

A comprehensive desktop hardware testing suite with AI-powered laptop evaluation. Built with **Tauri + Next.js + Tailwind CSS**.

## Features

### Hardware Testing Integration
- **Cinebench** — CPU Benchmark
- **FurMark** — GPU Stress Test
- **MemTest64** — RAM Stability Test
- **CrystalDiskMark** — SSD Speed Test

### System Monitoring
- Real-time CPU temperature
- Real-time GPU temperature
- RAM usage + CPU usage tracking
- MAX value tracking during tests
- Sparkline temperature trend charts

### AI Evaluation System
Rule-based scoring engine (no external API needed):

| Metric | Penalty/Bonus | Level |
|--------|---------------|-------|
| CPU temp > 95°C | -40 | CRITICAL |
| GPU temp > 85°C | -30 | CRITICAL |
| RAM FAIL | -50 | AUTO-FAIL |
| SSD < 500 MB/s | -25 | Slow |
| Benchmark > 20k | +15 | Excellent |

**Score 80–100:** GOOD ✅ → BUY
**Score 50–79:** ACCEPTABLE ⚠️ → CONSIDER
**Score 0–49:** AVOID ❌ → AVOID

### Auto Test Mode
- Launches all 4 tools simultaneously
- Runs for 15 minutes
- Collects metrics every 2 seconds
- Tracks peak temperatures
- Auto-saves logs to `Documents/AI-Laptop-Tester/`

### Export System
- `result.txt` — formatted ASCII report
- `result.json` — structured data
- `test-{timestamp}.json` — telemetry logs

---

## Setup

### Prerequisites
- Node.js 18+
- Rust 1.77+
- npm

### Install & Run Dev

```bash
cd ai-laptop-tester-pro
npm install
npm run tauri dev
```

### Build .exe

```bash
npm run tauri build
```

Output:
- Executable: `src-tauri/target/release/ai-laptop-tester-pro.exe`
- Installer: `src-tauri/target/release/bundle/nsis/`

### Configure Tool Paths

Edit `src/lib/tauri.ts` → `TOOL_PATHS`:

```typescript
export const TOOL_PATHS: Record<string, string> = {
  Cinebench: "C:\\Toolkit\\Cinebench\\Cinebench.exe",
  FurMark: "C:\\Toolkit\\GPU\\FurMark\\furmark.exe",
  MemTest64: "C:\\Toolkit\\MemTest64\\memtest64.exe",
  CrystalDiskMark: "C:\\Toolkit\\DiskMark\\DiskMark64.exe",
};
```

---

## Project Structure

```
ai-laptop-tester-pro/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Main dashboard
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── TestControls.tsx      # Launch test tools
│   │   ├── LiveMonitoring.tsx     # Real-time metrics
│   │   ├── AIEvaluationPanel.tsx  # AI scoring + export
│   │   ├── ChecklistPanel.tsx    # Test checklist
│   │   └── AutoTestController.tsx # 15-min auto test
│   └── lib/
│       ├── ai-scoring.ts    # Rule-based AI scoring engine
│       └── tauri.ts         # Tauri IPC wrapper
├── src-tauri/
│   ├── src/lib.rs           # Rust backend
│   ├── Cargo.toml           # Rust dependencies
│   ├── tauri.conf.json      # Tauri config
│   └── capabilities/default.json
├── SPEC.md                  # Full specification
└── README.md
```

---

## Color System

| Zone | Hex | Range |
|------|-----|-------|
| Safe | `#22c55e` | < 70°C |
| Warm | `#f59e0b` | 70–85°C |
| Hot | `#f97316` | 85–95°C |
| Critical | `#ef4444` | > 95°C |

---

## Architecture

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS v4 + Framer Motion + Lucide icons
- **Backend**: Rust + Tauri v2 + sysinfo crate
- **AI**: Pure TypeScript rule-based scoring engine, weighted penalties/bonuses, 0–100 score with verdict + recommendation + detailed explanations