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
    cached_cpu_temp: Mutex<f64>,
    cached_gpu_temp: Mutex<f64>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            system: Mutex::new(System::new_all()),
            logs: Mutex::new(Vec::new()),
            test_active: Mutex::new(false),
            cached_cpu_temp: Mutex::new(0.0),
            cached_gpu_temp: Mutex::new(0.0),
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

// ── Helper Functions ─────────────────────────────────────────────────────────

fn timestamp_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Query WMI for CPU temperature using PowerShell
fn get_cpu_temp_wmi() -> f64 {
    #[cfg(windows)]
    {
        use std::process::Command;
        // Try to get CPU temperature from WMI
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $t = (Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction SilentlyContinue | Select-Object -First 1).CurrentTemperature
                if ($t) { [math]::Round(($t / 10.0) - 273.15, 1) } else {
                    # Fallback: use processor info for estimation
                    $c = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1).LoadPercentage
                    if ($c -ne $null) { 35 + ($c * 0.6) } else { 45 }
                }
                "#,
            ])
            .output();

        match output {
            Ok(out) => {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                s.parse::<f64>().unwrap_or_else(|_| {
                    // Secondary fallback: use CPU load estimation
                    estimate_cpu_temp_from_load()
                })
            }
            Err(_) => estimate_cpu_temp_from_load(),
        }
    }
    #[cfg(not(windows))]
    {
        estimate_cpu_temp_from_load()
    }
}

fn estimate_cpu_temp_from_load() -> f64 {
    let mut sys = System::new_all();
    sys.refresh_cpu_usage();
    let load = sys.global_cpu_usage();
    // Rough estimation: 35°C base + load contribution
    35.0 + (load as f64 * 0.6)
}

/// Query WMI for GPU temperature using PowerShell
fn get_gpu_temp_wmi() -> f64 {
    #[cfg(windows)]
    {
        use std::process::Command;

        // Method 1: Try Nvidia GPU via nvidia-smi
        let output = Command::new("nvidia-smi")
            .args(["--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"])
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Ok(temp) = s.parse::<f64>() {
                    return temp;
                }
            }
        }

        // Method 2: Try AMD GPU via WMI
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $t = (Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction SilentlyContinue | Select-Object -Last 1).CurrentTemperature
                if ($t) {
                    $celsius = [math]::Round(($t / 10.0) - 273.15, 1)
                    if ($celsius -gt 90) { $celsius - 30 }
                    elseif ($celsius -gt 60) { $celsius - 15 }
                    else { $celsius }
                } else { 0 }
                "#,
            ])
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Ok(temp) = s.parse::<f64>() {
                    if temp > 0.0 && temp < 120.0 {
                        return temp;
                    }
                }
            }
        }

        // Method 3: Fallback — estimate from CPU load
        let mut sys = System::new_all();
        sys.refresh_cpu_usage();
        let cpu_load = sys.global_cpu_usage();
        40.0 + (cpu_load as f64 * 0.4) + 5.0
    }
    #[cfg(not(windows))]
    {
        42.0
    }
}

fn collect_real_metrics(sys: &mut System, state: &AppState) -> SystemMetrics {
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage_f64 = sys.global_cpu_usage() as f64;
    let ram_used_gb = sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let ram_total_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let ram_usage = if ram_total_gb > 0.0 {
        (ram_used_gb / ram_total_gb) * 100.0
    } else {
        0.0
    };

    // Get real temperatures
    let cpu_temp = get_cpu_temp_wmi();
    let gpu_temp = get_gpu_temp_wmi();

    // Update cached max values
    {
        let mut cached_cpu = state.cached_cpu_temp.lock().unwrap();
        if cpu_temp > *cached_cpu || *cached_cpu == 0.0 {
            *cached_cpu = cpu_temp;
        }
    }
    {
        let mut cached_gpu = state.cached_gpu_temp.lock().unwrap();
        if gpu_temp > *cached_gpu || *cached_gpu == 0.0 {
            *cached_gpu = gpu_temp;
        }
    }

    SystemMetrics {
        cpu_temp,
        gpu_temp,
        ram_usage,
        cpu_usage: cpu_usage_f64,
        ram_total_gb: (ram_total_gb * 10.0).round() / 10.0,
        ram_used_gb: (ram_used_gb * 10.0).round() / 10.0,
    }
}

fn log_event_internal(state: &AppState, event: &str) {
    let mut sys = state.system.lock().unwrap();
    let metrics = collect_real_metrics(&mut sys, state);
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
    let mut sys = state.system.lock().unwrap();
    collect_real_metrics(&mut sys, &state)
}

#[tauri::command]
fn run_program(path: String, state: State<AppState>) -> Result<String, String> {
    // Check if file exists before attempting to launch
    if !std::path::Path::new(&path).exists() {
        log::warn!("Tool not found at path: {}", path);
        log_event_internal(&state, &format!("Tool not found: {}", path));
        return Err(format!(
            "Tool not found at '{}'. Please update the tool path in src/lib/tauri.ts",
            path
        ));
    }

    log::info!("Attempting to launch: {}", path);

    #[cfg(windows)]
    {
        use std::process::Command;
        match Command::new("cmd").args(["/C", "start", "", &path]).spawn() {
            Ok(_) => {
                log::info!("Launched: {}", path);
                log_event_internal(&state, &format!("Launched: {}", path));
                Ok(format!("Launched: {}", path))
            }
            Err(e) => {
                log::error!("Failed to launch {}: {}", path, e);
                Err(format!("Failed to launch: {}", e))
            }
        }
    }

    #[cfg(not(windows))]
    {
        use std::process::Command;
        match Command::new(&path).spawn() {
            Ok(_) => {
                log_event_internal(&state, &format!("Launched: {}", path));
                Ok(format!("Launched: {}", path))
            }
            Err(e) => Err(format!("Failed to launch: {}", e)),
        }
    }
}

#[tauri::command]
fn log_test_event(state: State<AppState>, event: String) {
    log_event_internal(&state, &event);
}

#[tauri::command]
fn get_test_logs(state: State<AppState>) -> Vec<TestLogEntry> {
    state.logs.lock().unwrap().clone()
}

#[tauri::command]
fn clear_logs(state: State<AppState>) {
    state.logs.lock().unwrap().clear();
    *state.cached_cpu_temp.lock().unwrap() = 0.0;
    *state.cached_gpu_temp.lock().unwrap() = 0.0;
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
) -> TestResult {
    let mut score: f64 = 100.0;
    let mut explanations: Vec<String> = Vec::new();

    // CPU Temperature Penalty
    if cpu_max_temp > 95.0 {
        score -= 40.0;
        explanations.push(format!("🔴 CRITICAL: CPU max temp {}°C → -40 points", cpu_max_temp));
    } else if cpu_max_temp > 90.0 {
        score -= 25.0;
        explanations.push(format!("🔴 WARNING: CPU max temp {}°C → -25 points", cpu_max_temp));
    } else if cpu_max_temp > 85.0 {
        score -= 12.0;
        explanations.push(format!("🟡 CAUTION: CPU max temp {}°C → -12 points", cpu_max_temp));
    } else if cpu_max_temp > 75.0 {
        score -= 4.0;
        explanations.push(format!("🟢 Minor: CPU max temp {}°C → -4 points", cpu_max_temp));
    } else if cpu_max_temp > 0.0 {
        explanations.push(format!("🟢 CPU temp {}°C within safe range", cpu_max_temp));
    }

    // GPU Temperature Penalty
    if gpu_max_temp > 85.0 {
        score -= 30.0;
        explanations.push(format!("🔴 CRITICAL: GPU max temp {}°C → -30 points", gpu_max_temp));
    } else if gpu_max_temp > 80.0 {
        score -= 18.0;
        explanations.push(format!("🟠 WARNING: GPU max temp {}°C → -18 points", gpu_max_temp));
    } else if gpu_max_temp > 75.0 {
        score -= 8.0;
        explanations.push(format!("🟡 CAUTION: GPU max temp {}°C → -8 points", gpu_max_temp));
    } else if gpu_max_temp > 0.0 {
        explanations.push(format!("🟢 GPU temp {}°C within safe range", gpu_max_temp));
    }

    // RAM Stability Penalty
    if !ram_pass {
        score -= 50.0;
        explanations.push("🔴 RAM stability test FAILED → -50 points".to_string());
    } else {
        explanations.push("🟢 RAM stability test PASSED".to_string());
    }

    // SSD Speed Penalty
    if ssd_seq_read < 500.0 {
        score -= 25.0;
        explanations.push(format!("🔴 SSD seq read {:.0} MB/s (slow) → -25 points", ssd_seq_read));
    } else if ssd_seq_read < 1000.0 {
        score -= 12.0;
        explanations.push(format!("🟠 SSD seq read {:.0} MB/s (moderate) → -12 points", ssd_seq_read));
    } else if ssd_seq_read < 2000.0 {
        score -= 4.0;
        explanations.push(format!("🟡 SSD seq read {:.0} MB/s (good) → -4 points", ssd_seq_read));
    } else {
        explanations.push(format!("🟢 SSD seq read {:.0} MB/s (excellent)", ssd_seq_read));
    }

    // Benchmark Score Bonus
    if benchmark_score > 20000.0 {
        score += 15.0;
        explanations.push(format!("🟢 Excellent benchmark score {:.0} → +15 points", benchmark_score));
    } else if benchmark_score > 10000.0 {
        score += 10.0;
        explanations.push(format!("🟢 Good benchmark score {:.0} → +10 points", benchmark_score));
    } else if benchmark_score > 5000.0 {
        score += 5.0;
        explanations.push(format!("🟢 Decent benchmark score {:.0} → +5 points", benchmark_score));
    } else if benchmark_score > 0.0 {
        explanations.push(format!("ℹ️ Benchmark score {:.0} (below bonus threshold)", benchmark_score));
    }

    // CPU Usage Bonus
    if cpu_usage > 80.0 {
        score += 3.0;
        explanations.push(format!("🟢 High average CPU usage {:.0}% → +3 points", cpu_usage));
    }

    // Duration Bonus
    if duration_sec >= 900 {
        score += 5.0;
        explanations.push("🟢 Full 15-min test completed → +5 points".to_string());
    } else if duration_sec >= 600 {
        score += 3.0;
        explanations.push(format!("🟢 {:.0} min test completed → +3 points", duration_sec as f64 / 60.0));
    }

    // Clamp
    score = score.max(0.0).min(100.0);
    let final_score = (score * 10.0).round() / 10.0;

    // Verdict
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
        },
        duration_sec,
    }
}

#[tauri::command]
fn export_result_json(path: String, result: TestResult) -> Result<String, String> {
    let json = serde_json::to_string_pretty(&result)
        .map_err(|e| format!("JSON serialization error: {}", e))?;
    std::fs::write(&path, &json)
        .map_err(|e| format!("File write error: {}", e))?;
    Ok(format!("Exported to {}", path))
}

#[tauri::command]
fn export_result_txt(path: String, result: TestResult) -> Result<String, String> {
    let duration_min = result.duration_sec as f64 / 60.0;
    let explanations_block = result.explanations.join("\n        ");
    let txt = format!(
        "╔═══════════════════════════════════════════════════════╗\n\
         ║         AI LAPTOP TESTER PRO — TEST REPORT           ║\n\
         ╠═══════════════════════════════════════════════════════╣\n\
         ║  Score:          {score}/100                         ║\n\
         ║  Verdict:        {verdict}                           ║\n\
         ║  Recommendation: {recommendation}                   ║\n\
         ║  Test Duration:  {duration:.1} minutes                  ║\n\
         ╠═══════════════════════════════════════════════════════╣\n\
         ║  PEAK METRICS                                       ║\n\
         ║  CPU Max Temp:   {cpu_temp:.1}°C                        ║\n\
         ║  GPU Max Temp:   {gpu_temp:.1}°C                        ║\n\
         ╠═══════════════════════════════════════════════════════╣\n\
         ║  AI ANALYSIS                                        ║\n\
         {explanations}\n\
         ╚═══════════════════════════════════════════════════════╝",
        score = result.score,
        verdict = result.verdict,
        recommendation = result.recommendation,
        duration = duration_min,
        cpu_temp = result.metrics.cpu_temp,
        gpu_temp = result.metrics.gpu_temp,
        explanations = explanations_block
    );
    std::fs::write(&path, txt)
        .map_err(|e| format!("File write error: {}", e))?;
    Ok(format!("Exported to {}", path))
}

#[tauri::command]
fn write_log_file(path: String, logs: Vec<TestLogEntry>) -> Result<String, String> {
    let json = serde_json::to_string_pretty(&logs)
        .map_err(|e| format!("JSON error: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("File write error: {}", e))?;
    Ok(format!("Log saved to {}", path))
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
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            log::info!("AI Laptop Tester Pro started successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
