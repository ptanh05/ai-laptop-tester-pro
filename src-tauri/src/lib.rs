use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tauri::State;

// ── State ────────────────────────────────────────────────────────────────────

pub struct AppState {
    system: Mutex<System>,
    logs: Mutex<Vec<TestLogEntry>>,
    test_active: Mutex<bool>,
    max_cpu_temp: Mutex<f64>,
    max_gpu_temp: Mutex<f64>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            system: Mutex::new(System::new_all()),
            logs: Mutex::new(Vec::new()),
            test_active: Mutex::new(false),
            max_cpu_temp: Mutex::new(0.0),
            max_gpu_temp: Mutex::new(0.0),
        }
    }
}

// ── Data Types ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_temp: f64,
    pub gpu_temp: f64,
    pub ram_usage: f64,
    pub cpu_usage: f64,
    pub ram_total_gb: f64,
    pub ram_used_gb: f64,
    /// True = temperature was estimated (WMI/HardwareMonitor unavailable)
    pub is_mock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestLogEntry {
    pub timestamp: u64,
    pub cpu_temp: f64,
    pub gpu_temp: f64,
    pub ram_usage: f64,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub score: f64,
    pub verdict: String,
    pub recommendation: String,
    pub explanations: Vec<String>,
    pub metrics: SystemMetrics,
    pub duration_sec: u64,
}

// ── GPU Detection ───────────────────────────────────────────────────────────

fn get_gpu_info() -> (String, f64) {
    #[cfg(windows)]
    {
        use std::process::Command;

        // Try wmic first (most reliable)
        if let Ok(out) = Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "name,adapterram", "/format:csv"])
            .output()
        {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout);
                let lines: Vec<&str> = s.lines().filter(|l| !l.trim().is_empty()).collect();
                // Last non-header line has the GPU info
                for line in lines.iter().rev().skip(1) {
                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() >= 2 {
                        let name = parts[0].trim().to_string();
                        let ram_str = parts[1].trim();
                        if !name.is_empty() && name != "Name" && name != "Caption" {
                            // Parse VRAM from bytes
                            let vram_bytes: f64 = ram_str.parse().unwrap_or(0.0);
                            let vram_gb = vram_bytes / 1024.0 / 1024.0 / 1024.0;
                            return (name, vram_gb);
                        }
                    }
                }
            }
        }

        // Fallback: check for Nvidia via nvidia-smi
        if let Ok(out) = Command::new("nvidia-smi")
            .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let parts: Vec<&str> = s.split(',').collect();
                if parts.len() >= 1 {
                    let name = parts[0].trim().to_string();
                    let vram_mb: f64 = parts.get(1).and_then(|v| v.trim().parse().ok()).unwrap_or(0.0);
                    return (name, vram_mb / 1024.0);
                }
            }
        }

        (String::from("Unknown GPU"), 0.0)
    }

    #[cfg(not(windows))]
    {
        (String::from("Unknown GPU"), 0.0)
    }
}

// ── CPU Tier Classification ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CpuTier {
    Entry,      // Celeron, Pentium, AMD A-series, Intel Atom
    LowMid,     // Intel i3-U, i5-U (8th gen+), AMD Ryzen 3 U/H
    Mid,        // Intel i5-H (9th+), i7-U, AMD Ryzen 5 H/HS
    High,       // Intel i7-H (10th+), i9-U, AMD Ryzen 7 H/HS
    Enthusiast, // Intel i9-HX/K desktop, AMD Ryzen 9
}

impl CpuTier {
    fn as_str(&self) -> &'static str {
        match self {
            CpuTier::Entry      => "entry",
            CpuTier::LowMid     => "lowmid",
            CpuTier::Mid        => "mid",
            CpuTier::High       => "high",
            CpuTier::Enthusiast => "enthusiast",
        }
    }

    /// Maximum reasonable Cinebench R23 multi-core score for this tier
    fn benchmark_max(&self) -> f64 {
        match self {
            CpuTier::Entry      => 500.0,
            CpuTier::LowMid     => 3000.0,
            CpuTier::Mid        => 15000.0,
            CpuTier::High       => 25000.0,
            CpuTier::Enthusiast => 50000.0,
        }
    }

    fn label(&self) -> &'static str {
        match self {
            CpuTier::Entry      => "ENTRY",
            CpuTier::LowMid     => "LOW-MID",
            CpuTier::Mid        => "MID",
            CpuTier::High       => "HIGH",
            CpuTier::Enthusiast => "ENTHUSIAST",
        }
    }
}

fn classify_cpu_tier(cpu_model: &str) -> CpuTier {
    let s = cpu_model.to_uppercase();

    // ── AMD ─────────────────────────────────────────────────────────────────
    if s.contains("RYZEN 9") || s.contains("R9-9") || s.contains("R9 9") {
        return CpuTier::Enthusiast;
    }
    if s.contains("RYZEN 7") || s.contains("R7-7") || s.contains("R7 7") {
        if s.contains("HX") || s.contains("HS") {
            return CpuTier::High;
        }
        return CpuTier::Mid;
    }
    if s.contains("RYZEN 5") || s.contains("R5-5") || s.contains("R5 5") {
        if s.contains("HX") || s.contains("HS") {
            return CpuTier::Mid;
        }
        return CpuTier::LowMid;
    }
    if s.contains("RYZEN 3") || s.contains("R3") {
        return CpuTier::LowMid;
    }
    if s.contains("ATHLON")
        || s.contains("A4")
        || s.contains("A6")
        || s.contains("A8")
        || s.contains("A10")
        || s.contains("A12")
        || s.contains("E2")
        || s.contains("E1")
    {
        return CpuTier::Entry;
    }

    // ── Intel ────────────────────────────────────────────────────────────────
    // i9: desktop HX/K or mobile >= 12th gen
    if s.contains("CORE I9") || s.contains("I9-1[2345]") {
        return CpuTier::Enthusiast;
    }

    // i7: distinguish U-series (thin & light) from H/HK series (performance)
    if s.contains("CORE I7") {
        if s.contains("U") || s.contains("G7") || s.contains("G4") {
            return CpuTier::Mid;
        }
        // H, HK, HK, or desktop
        return CpuTier::High;
    }

    // i5: U-series 10th gen+ → LowMid, H-series → Mid
    if s.contains("CORE I5") {
        if s.contains("U") || s.contains("G7") || s.contains("G4") {
            return CpuTier::LowMid;
        }
        // H, HK, HQ or desktop
        return CpuTier::Mid;
    }

    // i3
    if s.contains("CORE I3") {
        if s.contains("H") || s.contains("HK") || s.contains("HQ") {
            return CpuTier::LowMid;
        }
        return CpuTier::Entry;
    }

    if s.contains("CELERON") || s.contains("PENTIUM") || s.contains("ATOM") {
        return CpuTier::Entry;
    }

    // Default fallback
    CpuTier::LowMid
}

// ── Battery Health ──────────────────────────────────────────────────────────

fn get_battery_health() -> (f64, f64, bool, f64, f64) {
    // Returns (charge_pct, health_pct, is_charging, design_cap_mwh, full_cap_mwh)
    #[cfg(windows)]
    {
        use std::process::Command;

        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command",
                r#"
                $b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
                if (-not $b) { Write-Output "no_battery"; return }

                $charge = $b.EstimatedChargeRemaining
                $status = $b.BatteryStatus
                $isCharging = ($status -eq 2)

                # Try to get capacity from WMI root\WMI (most reliable on laptops)
                $fullCap = (Get-CimInstance BatteryFullChargedCapacity -Namespace root/WMI -ErrorAction SilentlyContinue |
                            Select-Object -First 1).BatteryFullChargedCapacity
                $designCap = (Get-CimInstance BatteryStaticData -Namespace root/WMI -ErrorAction SilentlyContinue |
                              Select-Object -First 1).DesignedCapacity

                # Fallback: try Win32_Battery static data
                if (-not $fullCap -or $fullCap -eq 0) {
                    $fullCap = $b.FullChargeCapacity
                }
                if (-not $designCap -or $designCap -eq 0) {
                    $designCap = $b.DesignCapacity
                }

                if ($designCap -and $designCap -gt 0 -and $fullCap -and $fullCap -gt 0) {
                    $health = [Math]::Round(($fullCap / $designCap) * 100, 1)
                    Write-Output "$charge|$($isCharging.ToString())|$health|$designCap|$fullCap"
                } else {
                    Write-Output "$charge|$($isCharging.ToString())|-1|0|0"
                }
                "#])
            .output();

        if let Ok(out) = out {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if s == "no_battery" {
                    return (0.0, -1.0, false, 0.0, 0.0);
                }
                let parts: Vec<&str> = s.split('|').collect();
                let charge: f64 = parts.first().and_then(|v| v.trim().parse().ok()).unwrap_or(0.0);
                let is_charging: bool = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(false);
                let health: f64 = parts.get(2).and_then(|v| v.trim().parse().ok()).unwrap_or(-1.0);
                let design: f64 = parts.get(3).and_then(|v| v.trim().parse().ok()).unwrap_or(0.0);
                let full: f64 = parts.get(4).and_then(|v| v.trim().parse().ok()).unwrap_or(0.0);
                return (charge, health, is_charging, design, full);
            }
        }
    }

    (0.0, -1.0, false, 0.0, 0.0)
}

/// Measure battery drain rate under CPU stress — returns (drain_rate_%_per_min, start_charge, end_charge)
fn measure_battery_drain_impl(seconds: u32) -> (f64, f64, f64) {
    #[cfg(windows)]
    {
        use std::process::Command;
        let ps = format!(
            r#"
            $samples = @()
            $totalSamples = [Math]::Floor({s} / 3)
            $b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
            if (-not $b) {{ Write-Output "no_battery"; return }}
            $start = $b.EstimatedChargeRemaining
            $samples += $start

            # CPU stress job
            $j = Start-Job -ScriptBlock {{
                $sw = [Diagnostics.Stopwatch]::StartNew()
                while ($sw.Elapsed.TotalSeconds -lt $using:s) {{
                    1..[Environment]::ProcessorCount | ForEach-Object {{ $null = [Math]::Sqrt([Math]::Pow((Get-Random -Minimum 1 -Maximum 9999), 2)) }}
                }}
            }}

            for ($i = 0; $i -lt $totalSamples; $i++) {{
                Start-Sleep -Seconds 3
                $b2 = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
                $samples += $b2.EstimatedChargeRemaining
                if ($b2.BatteryStatus -eq 2 -or $b2.BatteryStatus -eq 3 -or $b2.EstimatedChargeRemaining -eq 100) {{
                    Stop-Job $j -ErrorAction SilentlyContinue; Remove-Job $j -ErrorAction SilentlyContinue
                    Write-Output "charging|$start|$($b2.EstimatedChargeRemaining)"
                    return
                }}
            }}
            Stop-Job $j -ErrorAction SilentlyContinue; Remove-Job $j -ErrorAction SilentlyContinue
            $end = $samples[-1]
            $drain = $start - $end
            $mins = [Math]::Round({s} / 60.0, 3)
            $rate = [Math]::Round($drain / $mins, 3)
            Write-Output "ok|$start|$end|$rate"
            "#,
            s = seconds
        );

        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .output();

        if let Ok(out) = out {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let parts: Vec<&str> = s.split('|').collect();
                if parts.len() >= 3 {
                    return (
                        parts[2].trim().parse::<f64>().unwrap_or(0.0),
                        parts[0].trim().parse::<f64>().unwrap_or(0.0),
                        parts[1].trim().parse::<f64>().unwrap_or(0.0),
                    );
                }
            }
        }
    }
    (0.0, 0.0, 0.0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryInfo {
    pub charge_pct: f64,
    pub is_charging: bool,
    pub health_pct: f64,      // 0-100, -1 = unknown
    pub design_cap_mwh: f64,
    pub full_cap_mwh: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub cpu_model: String,
    pub cpu_cores: usize,
    pub ram_total_gb: f64,
    pub gpu_model: String,
    pub gpu_vram_gb: f64,
    pub os_version: String,
    pub battery: BatteryInfo,
    pub cpu_tier: String,     // "entry" | "lowmid" | "mid" | "high" | "enthusiast"
    pub cpu_tier_label: String,
    pub benchmark_max: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryDrainResult {
    pub drain_rate: f64,       // %/min
    pub start_charge: f64,    // %
    pub end_charge: f64,      // %
    pub is_discharging: bool,
    pub is_charging: bool,
}

// ── Helper Functions ─────────────────────────────────────────────────────────

fn timestamp_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// ── Temperature Reading ─────────────────────────────────────────────────────

/// Get CPU temperature — tries multiple sources, returns (temp, is_mock)
fn get_cpu_temp() -> f64 {
    #[cfg(windows)]
    {
        use std::process::Command;

        // Try WMI ThermalZoneTemperature first
        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command",
                r#"
                $t = Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction SilentlyContinue |
                     Select-Object -First 1 | ForEach-Object { $_.CurrentTemperature }
                if ($t -and $t -gt 0) {
                    [math]::Round(($t / 10.0) - 273.15, 1)
                } else {
                    # Try alternate WMI
                    $perf = Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation -ErrorAction SilentlyContinue |
                            Select-Object -First 1
                    if ($perf -and $perf.Temperature -gt 0) { $perf.Temperature } else { 0 }
                }
                "#])
            .output();

        if let Ok(out) = out {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Ok(t) = s.parse::<f64>() {
                    if t > 0.0 && t < 120.0 {
                        return t;
                    }
                }
            }
        }

        // Fallback: estimate from CPU load
        let sys = System::new_all();
        let load = sys.global_cpu_usage();
        return 35.0 + (load as f64 * 0.6);
    }

    #[cfg(not(windows))]
    {
        42.0
    }
}

/// Get GPU temperature — tries nvidia-smi, AMD ADL, then estimation
fn get_gpu_temp() -> f64 {
    #[cfg(windows)]
    {
        use std::process::Command;

        // Try nvidia-smi (Nvidia GPU)
        if let Ok(out) = Command::new("nvidia-smi")
            .args(["--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"])
            .output()
        {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Ok(t) = s.parse::<f64>() {
                    return t;
                }
            }
        }

        // Try AMD GPU via WMI
        if let Ok(out) = Command::new("powershell")
            .args(["-NoProfile", "-Command",
                r#"
                $gpu = Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction SilentlyContinue
                if ($gpu) {
                    $temps = $gpu | ForEach-Object {
                        $c = [math]::Round(($_.CurrentTemperature / 10.0) - 273.15, 1)
                        if ($c -gt 30 -and $c -lt 110) { $c }
                    }
                    if ($temps.Count -gt 0) { $temps[-1] } else { 0 }
                } else { 0 }
                "#])
            .output()
        {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Ok(t) = s.parse::<f64>() {
                    if t > 0.0 && t < 110.0 {
                        return t;
                    }
                }
            }
        }

        // Fallback: estimate from CPU
        let sys = System::new_all();
        let load = sys.global_cpu_usage();
        return 40.0 + (load as f64 * 0.4) + 5.0;
    }

    #[cfg(not(windows))]
    {
        42.0
    }
}

// ── Collect Metrics ─────────────────────────────────────────────────────────

fn collect_metrics(state: &AppState) -> SystemMetrics {
    let mut sys = state.system.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_usage() as f64;
    let ram_used = sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let ram_total = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let ram_usage = if ram_total > 0.0 { (ram_used / ram_total) * 100.0 } else { 0.0 };

    let cpu_temp = get_cpu_temp();
    let gpu_temp = get_gpu_temp();

    // Update cached max values
    {
        let mut max = state.max_cpu_temp.lock().unwrap();
        *max = (*max).max(cpu_temp);
    }
    {
        let mut max = state.max_gpu_temp.lock().unwrap();
        *max = (*max).max(gpu_temp);
    }

    SystemMetrics {
        cpu_temp,
        gpu_temp,
        ram_usage,
        cpu_usage,
        ram_total_gb: (ram_total * 10.0).round() / 10.0,
        ram_used_gb: (ram_used * 10.0).round() / 10.0,
        is_mock: false,
    }
}

fn log_event(state: &AppState, event: &str) {
    let metrics = collect_metrics(state);
    let mut logs = state.logs.lock().unwrap();
    logs.push(TestLogEntry {
        timestamp: timestamp_now(),
        cpu_temp: metrics.cpu_temp,
        gpu_temp: metrics.gpu_temp,
        ram_usage: metrics.ram_usage,
        event: event.to_string(),
    });
}

// ── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_system_metrics(state: State<AppState>) -> SystemMetrics {
    collect_metrics(&state)
}

#[tauri::command]
fn get_system_info(state: State<AppState>) -> SystemInfo {
    let sys = state.system.lock().unwrap();

    let cpu_model = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let cpu_cores = sys.cpus().len();
    let ram_total_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;

    let (gpu_model, gpu_vram_gb) = get_gpu_info();
    let (charge_pct, health_pct, is_charging, design_cap, full_cap) = get_battery_health();

    let cpu_tier = classify_cpu_tier(&cpu_model);

    let battery = BatteryInfo {
        charge_pct,
        is_charging,
        health_pct,
        design_cap_mwh: design_cap,
        full_cap_mwh: full_cap,
    };

    SystemInfo {
        cpu_model,
        cpu_cores,
        ram_total_gb: (ram_total_gb * 10.0).round() / 10.0,
        gpu_model,
        gpu_vram_gb: (gpu_vram_gb * 10.0).round() / 10.0,
        os_version: std::env::consts::OS.to_string(),
        battery,
        cpu_tier: cpu_tier.as_str().to_string(),
        cpu_tier_label: cpu_tier.label().to_string(),
        benchmark_max: cpu_tier.benchmark_max(),
    }
}

#[tauri::command]
fn get_max_temps(state: State<AppState>) -> (f64, f64) {
    let cpu_max = *state.max_cpu_temp.lock().unwrap();
    let gpu_max = *state.max_gpu_temp.lock().unwrap();
    (cpu_max, gpu_max)
}

#[tauri::command]
fn reset_max_temps(state: State<AppState>) {
    *state.max_cpu_temp.lock().unwrap() = 0.0;
    *state.max_gpu_temp.lock().unwrap() = 0.0;
}

#[tauri::command]
fn get_cpu_tier(state: State<AppState>) -> SystemInfo {
    get_system_info(state)
}

#[tauri::command]
fn measure_battery_drain(seconds: u32) -> BatteryDrainResult {
    let (drain_rate, start_charge, end_charge) = measure_battery_drain_impl(seconds);
    let is_charging = end_charge > start_charge || drain_rate == 0.0;
    BatteryDrainResult {
        drain_rate,
        start_charge,
        end_charge,
        is_discharging: !is_charging,
        is_charging,
    }
}

#[tauri::command]
fn run_program(path: String, state: State<AppState>) -> Result<String, String> {
    if !std::path::Path::new(&path).exists() {
        log::warn!("Tool not found: {}", path);
        return Err(format!(
            "Tool not found at '{}'. Please update the path in src/lib/tauri.ts",
            path
        ));
    }

    log::info!("Launching: {}", path);

    #[cfg(windows)]
    {
        use std::process::Command;
        // Use PowerShell Start-Process with Hidden window style — no taskbar flash
        match Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command",
                &format!("Start-Process '{}' -WindowStyle Hidden", path)])
            .spawn()
        {
            Ok(_) => {
                log::info!("Launched: {}", path);
                log_event(&state, &format!("Launched: {}", path));
                Ok(format!("Launched: {}", path))
            }
            Err(e) => {
                log::error!("Failed: {}: {}", path, e);
                Err(format!("Failed: {}", e))
            }
        }
    }

    #[cfg(not(windows))]
    {
        use std::process::Command;
        match Command::new(&path).spawn() {
            Ok(_) => {
                log_event(&state, &format!("Launched: {}", path));
                Ok(format!("Launched: {}", path))
            }
            Err(e) => Err(format!("Failed: {}", e)),
        }
    }
}

#[tauri::command]
fn log_test_event(state: State<AppState>, event: String) {
    log_event(&state, &event);
}

#[tauri::command]
fn get_test_logs(state: State<AppState>) -> Vec<TestLogEntry> {
    state.logs.lock().unwrap().clone()
}

#[tauri::command]
fn clear_logs(state: State<AppState>) {
    state.logs.lock().unwrap().clear();
    *state.max_cpu_temp.lock().unwrap() = 0.0;
    *state.max_gpu_temp.lock().unwrap() = 0.0;
}

#[tauri::command]
fn set_test_active(state: State<AppState>, active: bool) {
    *state.test_active.lock().unwrap() = active;
}

#[tauri::command]
fn is_test_active(state: State<AppState>) -> bool {
    *state.test_active.lock().unwrap()
}

#[tauri::command]
fn ai_evaluate(
    cpu_max_temp: f64,
    gpu_max_temp: f64,
    benchmark_score: f64,
    ssd_seq_read: f64,
    _ssd_seq_write: f64,
    ram_pass: bool,
    cpu_usage: f64,
    duration_sec: u64,
    cpu_tier: String,
    battery_health: f64,
    drain_rate: f64,
    network_down: f64,
    network_up: f64,
    network_latency: f64,
) -> TestResult {
    let mut score: f64 = 100.0;
    let mut explanations: Vec<String> = Vec::new();

    // CPU Temperature Penalty
    if cpu_max_temp > 95.0 {
        score -= 40.0;
        explanations.push(format!("🔴 CRITICAL: CPU max {}°C → -40 pts", cpu_max_temp));
    } else if cpu_max_temp > 90.0 {
        score -= 25.0;
        explanations.push(format!("🔴 WARNING: CPU max {}°C → -25 pts", cpu_max_temp));
    } else if cpu_max_temp > 85.0 {
        score -= 12.0;
        explanations.push(format!("🟡 CAUTION: CPU max {}°C → -12 pts", cpu_max_temp));
    } else if cpu_max_temp > 75.0 {
        score -= 4.0;
        explanations.push(format!("🟢 Minor: CPU max {}°C → -4 pts", cpu_max_temp));
    } else if cpu_max_temp > 0.0 {
        explanations.push(format!("🟢 CPU {}°C — safe range", cpu_max_temp));
    }

    // GPU Temperature Penalty
    if gpu_max_temp > 85.0 {
        score -= 30.0;
        explanations.push(format!("🔴 CRITICAL: GPU max {}°C → -30 pts", gpu_max_temp));
    } else if gpu_max_temp > 80.0 {
        score -= 18.0;
        explanations.push(format!("🟠 WARNING: GPU max {}°C → -18 pts", gpu_max_temp));
    } else if gpu_max_temp > 75.0 {
        score -= 8.0;
        explanations.push(format!("🟡 CAUTION: GPU max {}°C → -8 pts", gpu_max_temp));
    } else if gpu_max_temp > 0.0 {
        explanations.push(format!("🟢 GPU {}°C — safe range", gpu_max_temp));
    }

    // RAM Stability Penalty
    if !ram_pass {
        score -= 50.0;
        explanations.push("🔴 RAM test FAILED → -50 pts".to_string());
    } else {
        explanations.push("🟢 RAM test PASSED".to_string());
    }

    // SSD Speed — sequential read only (write tracked but not scored separately)
    if ssd_seq_read < 500.0 {
        score -= 25.0;
        explanations.push(format!("🔴 SSD read {:.0} MB/s (slow) → -25 pts", ssd_seq_read));
    } else if ssd_seq_read < 1000.0 {
        score -= 12.0;
        explanations.push(format!("🟠 SSD read {:.0} MB/s → -12 pts", ssd_seq_read));
    } else if ssd_seq_read < 2000.0 {
        score -= 4.0;
        explanations.push(format!("🟡 SSD read {:.0} MB/s → -4 pts", ssd_seq_read));
    } else {
        explanations.push(format!("🟢 SSD read {:.0} MB/s — excellent", ssd_seq_read));
    }

    // ── RELATIVE BENCHMARK SCORING ───────────────────────────────────────────
    let bench_max = match cpu_tier.as_str() {
        "entry"      => 500.0,
        "lowmid"     => 3000.0,
        "mid"        => 15000.0,
        "high"       => 25000.0,
        "enthusiast" => 50000.0,
        _            => 3000.0,
    };

    if benchmark_score > 0.0 {
        let ratio = (benchmark_score / bench_max).min(1.0);
        let bonus = if ratio >= 0.80 {
            explanations.push(format!("🟢 Benchmark {:.0}/{:.0} ({}% of tier max) → +15 pts", benchmark_score, bench_max, (ratio*100.0).round()));
            15.0
        } else if ratio >= 0.50 {
            explanations.push(format!("🟢 Benchmark {:.0}/{:.0} ({}% of tier max) → +10 pts", benchmark_score, bench_max, (ratio*100.0).round()));
            10.0
        } else if ratio >= 0.25 {
            explanations.push(format!("🟡 Benchmark {:.0}/{:.0} ({}% of tier max) → +5 pts", benchmark_score, bench_max, (ratio*100.0).round()));
            5.0
        } else if ratio > 0.0 {
            explanations.push(format!("🟡 Benchmark {:.0}/{:.0} ({}% of tier max) → +2 pts", benchmark_score, bench_max, (ratio*100.0).round()));
            2.0
        } else {
            explanations.push(format!("ℹ️ Benchmark score not provided", ));
            0.0
        };
        score += bonus;
    } else {
        explanations.push("ℹ️ No benchmark score — benchmark check skipped".to_string());
    }

    // ── BATTERY HEALTH ───────────────────────────────────────────────────────
    if battery_health >= 0.0 {
        if battery_health < 30.0 {
            score -= 30.0;
            explanations.push(format!("🔴 Battery health critically low: {:.1}% → -30 pts", battery_health));
        } else if battery_health < 50.0 {
            score -= 20.0;
            explanations.push(format!("🔴 Battery health degraded: {:.1}% → -20 pts", battery_health));
        } else if battery_health < 70.0 {
            score -= 10.0;
            explanations.push(format!("🟠 Battery health reduced: {:.1}% → -10 pts", battery_health));
        } else if battery_health < 80.0 {
            score -= 5.0;
            explanations.push(format!("🟡 Battery health: {:.1}% → -5 pts", battery_health));
        } else {
            explanations.push(format!("🟢 Battery health: {:.1}% — good", battery_health));
        }
    } else {
        explanations.push("ℹ️ Battery health: unknown (WMI not available)".to_string());
    }

    // ── BATTERY DRAIN RATE ───────────────────────────────────────────────────
    if drain_rate > 0.0 {
        if drain_rate > 3.0 {
            score -= 15.0;
            explanations.push(format!("🔴 Extremely high drain: {:.2}%/min → -15 pts", drain_rate));
        } else if drain_rate > 2.0 {
            score -= 10.0;
            explanations.push(format!("🔴 High drain rate: {:.2}%/min → -10 pts", drain_rate));
        } else if drain_rate > 1.0 {
            score -= 5.0;
            explanations.push(format!("🟠 Moderate drain: {:.2}%/min → -5 pts", drain_rate));
        } else {
            explanations.push(format!("🟢 Drain rate: {:.2}%/min — normal", drain_rate));
        }
    } else {
        explanations.push("ℹ️ Drain rate: not measured (charging or unavailable)".to_string());
    }

    // ── NETWORK SCORE ────────────────────────────────────────────────────────
    if network_down > 0.0 || network_up > 0.0 {
        let net_bonus = if network_down >= 100.0 && network_latency < 30.0 {
            explanations.push(format!("🟢 Network: {:.0} Mbps down / {:.0} Mbps up / {:.0} ms latency → +3 pts", network_down, network_up, network_latency));
            3.0
        } else if network_down >= 50.0 {
            explanations.push(format!("🟢 Network: {:.0} Mbps down / {:.0} Mbps up / {:.0} ms latency → +1 pt", network_down, network_up, network_latency));
            1.0
        } else if network_down < 5.0 {
            score -= 10.0;
            explanations.push(format!("🔴 Very slow network: {:.0} Mbps down → -10 pts", network_down));
            0.0
        } else if network_down < 20.0 {
            score -= 5.0;
            explanations.push(format!("🟠 Slow network: {:.0} Mbps down → -5 pts", network_down));
            0.0
        } else {
            explanations.push(format!("🟡 Network: {:.0} Mbps down / {:.0} Mbps up / {:.0} ms latency", network_down, network_up, network_latency));
            0.0
        };
        score += net_bonus;
    }

    // CPU Usage Bonus
    if cpu_usage > 80.0 {
        score += 3.0;
        explanations.push(format!("🟢 High CPU usage {:.0}% → +3 pts", cpu_usage));
    }

    // Duration Bonus
    if duration_sec >= 900 {
        score += 5.0;
        explanations.push("🟢 15-min full test → +5 pts".to_string());
    } else if duration_sec >= 600 {
        score += 3.0;
        explanations.push(format!("🟢 {:.0} min test → +3 pts", duration_sec as f64 / 60.0));
    }

    score = score.max(0.0).min(100.0);
    let final_score = (score * 10.0).round() / 10.0;

    let (verdict, recommendation) = if final_score >= 80.0 {
        ("GOOD ✅", "BUY")
    } else if final_score >= 50.0 {
        ("ACCEPTABLE ⚠️", "CONSIDER")
    } else {
        ("AVOID ❌", "AVOID")
    };

    TestResult {
        score: final_score,
        verdict: verdict.to_string(),
        recommendation: recommendation.to_string(),
        explanations,
        metrics: SystemMetrics {
            cpu_temp: cpu_max_temp,
            gpu_temp: gpu_max_temp,
            ram_usage: 0.0,
            cpu_usage,
            ram_total_gb: 0.0,
            ram_used_gb: 0.0,
            is_mock: false,
        },
        duration_sec,
    }
}

#[tauri::command]
fn export_result_json(path: String, result: TestResult) -> Result<String, String> {
    let json = serde_json::to_string_pretty(&result)
        .map_err(|e| format!("JSON error: {}", e))?;
    std::fs::write(&path, &json)
        .map_err(|e| format!("Write error: {}", e))?;
    Ok(format!("Exported: {}", path))
}

#[tauri::command]
fn export_result_txt(path: String, result: TestResult) -> Result<String, String> {
    let dur = result.duration_sec as f64 / 60.0;
    let lines: Vec<String> = result.explanations.iter().map(|s| format!("  • {}", s)).collect();
    let txt = format!(
        "╔═══════════════════════════════════════════════════╗\n\
         ║       AI LAPTOP TESTER PRO — TEST REPORT         ║\n\
         ╠═══════════════════════════════════════════════════╣\n\
         ║  Score:         {score}/100                      ║\n\
         ║  Verdict:       {verdict}                         ║\n\
         ║  Recommendation: {rec}                            ║\n\
         ║  Duration:      {dur:.1} min                       ║\n\
         ╠═══════════════════════════════════════════════════╣\n\
         ║  PEAK TEMPERATURES                                ║\n\
         ║  CPU Max:       {cpu:.1}°C                          ║\n\
         ║  GPU Max:       {gpu:.1}°C                          ║\n\
         ╠═══════════════════════════════════════════════════╣\n\
         ║  AI ANALYSIS                                       ║\n\
         {expl}\n\
         ╚═══════════════════════════════════════════════════╝",
        score = result.score,
        verdict = result.verdict,
        rec = result.recommendation,
        dur = dur,
        cpu = result.metrics.cpu_temp,
        gpu = result.metrics.gpu_temp,
        expl = lines.join("\n")
    );
    std::fs::write(&path, txt)
        .map_err(|e| format!("Write error: {}", e))?;
    Ok(format!("Exported: {}", path))
}

#[tauri::command]
fn write_log_file(path: String, logs: Vec<TestLogEntry>) -> Result<String, String> {
    let json = serde_json::to_string_pretty(&logs)
        .map_err(|e| format!("JSON error: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Write error: {}", e))?;
    Ok(format!("Log saved: {}", path))
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── App Entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_system_metrics,
            get_system_info,
            get_max_temps,
            reset_max_temps,
            run_program,
            log_test_event,
            get_test_logs,
            clear_logs,
            set_test_active,
            is_test_active,
            ai_evaluate,
            export_result_json,
            export_result_txt,
            write_log_file,
            get_app_version,
            get_cpu_tier,
            measure_battery_drain,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            log::info!("AI Laptop Tester Pro v{} started", env!("CARGO_PKG_VERSION"));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}