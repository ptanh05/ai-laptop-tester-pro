param(
    [int]$DurationSeconds = 60,
    [int]$SampleIntervalSeconds = 3
)

$startCharge = (Get-CimInstance Win32_Battery).EstimatedChargeRemaining
$startTime = Get-Date
$readings = @()
$sampleCount = [Math]::Floor($DurationSeconds / $SampleIntervalSeconds)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BATTERY PERFORMANCE STRESS TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Duration : $DurationSeconds seconds" -ForegroundColor Yellow
Write-Host "Interval : $SampleIntervalSeconds seconds" -ForegroundColor Yellow
Write-Host "Samples  : $sampleCount" -ForegroundColor Yellow
Write-Host ""
Write-Host "Measuring battery drain under stress load..." -ForegroundColor Gray
Write-Host ""

# CPU Stress to increase power draw
Write-Host "[STRESS] Starting CPU stress to simulate real usage..." -ForegroundColor Magenta
$stressJob = Start-Job -ScriptBlock {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $using:DurationSeconds) {
        $null = [Math]::Sqrt([Math]::Pow((Get-Random -Minimum 1 -Maximum 10000), 2))
    }
}

# Sample battery every interval
for ($i = 1; $i -le $sampleCount; $i++) {
    Start-Sleep -Seconds $SampleIntervalSeconds

    $battery = Get-CimInstance Win32_Battery
    $charge = $battery.EstimatedChargeRemaining
    $elapsed = $i * $SampleIntervalSeconds

    $readings += [PSCustomObject]@{
        Time        = $elapsed
        Charge      = $charge
        DrainPerMin = 0
    }

    $barLen = [Math]::Max(0, [Math]::Round($charge / 2))
    $bar = "#" * $barLen + "-" * (50 - $barLen)
    Write-Host ("  [{0,2}s] {1,3}% |{2}|" -f $elapsed, $charge, $bar) -ForegroundColor Green

    # Check if battery is full/charging
    if ($charge -eq 100 -or $battery.BatteryStatus -eq 2 -or $battery.BatteryStatus -eq 3) {
        Write-Host ""
        Write-Host "[!] Battery is charging or at 100% - cannot measure drain rate!" -ForegroundColor Red
        Write-Host "    Please unplug charger and run again." -ForegroundColor Yellow
        Stop-Job $stressJob -ErrorAction SilentlyContinue
        Remove-Job $stressJob -ErrorAction SilentlyContinue
        return
    }
}

# Stop stress
Stop-Job $stressJob -ErrorAction SilentlyContinue
Remove-Job $stressJob -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BATTERY PERFORMANCE RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Calculate drain rate
$firstReading = $readings[0].Charge
$lastReading = $readings[-1].Charge
$totalDrain = $firstReading - $lastReading
$totalMinutes = $readings[-1].Time / 60
$drainPerMin = [Math]::Round($totalDrain / $totalMinutes, 3)
$estimatedRuntime = if ($drainPerMin -gt 0) { [Math]::Round($lastReading / $drainPerMin, 0) } else { 0 }

# Power estimation (typical battery ~50000 mWh)
$batInfo = Get-CimInstance Win32_Battery
$designCap = $batInfo.DesignCapacity
$fullCap = $batInfo.FullChargeCapacity

Write-Host ""
Write-Host "[CHARGE]" -ForegroundColor Magenta
Write-Host "  Start        : $firstReading%" -ForegroundColor White
Write-Host "  End          : $lastReading%" -ForegroundColor White
Write-Host "  Total drain  : $totalDrain% in $totalMinutes minutes" -ForegroundColor Yellow

Write-Host ""
Write-Host "[DRAIN RATE]" -ForegroundColor Magenta
Write-Host "  Drain/Min    : $drainPerMin%/min" -ForegroundColor Yellow

if ($drainPerMin -gt 0) {
    $verdict = if ($drainPerMin -le 0.3) { "EXCELLENT" }
               elseif ($drainPerMin -le 0.6) { "GOOD" }
               elseif ($drainPerMin -le 1.0) { "FAIR - Moderate drain" }
               elseif ($drainPerMin -le 1.5) { "POOR - High drain" }
               else { "VERY POOR - Extremely high drain" }
    $color = if ($drainPerMin -le 0.6) { "Green" }
             elseif ($drainPerMin -le 1.0) { "Yellow" }
             else { "Red" }

    Write-Host "  Verdict      : $verdict" -ForegroundColor $color
    Write-Host "  Est. Runtime : ~$estimatedRuntime mins from $lastReading%" -ForegroundColor White
}

Write-Host ""
Write-Host "[BATTERY HEALTH]" -ForegroundColor Magenta
if ($designCap -and $fullCap -and $designCap -gt 0) {
    $health = [Math]::Round(($fullCap / $designCap) * 100, 1)
    $healthColor = if ($health -ge 80) { "Green" } elseif ($health -ge 50) { "Yellow" } else { "Red" }
    Write-Host "  Design Cap   : $designCap mWh" -ForegroundColor White
    Write-Host "  Full Cap     : $fullCap mWh" -ForegroundColor White
    Write-Host "  Health       : $health% $healthColor" -ForegroundColor $healthColor
} else {
    Write-Host "  Cannot read capacity (may be charging or not supported)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[STRESS TEST LOAD]" -ForegroundColor Magenta
Write-Host "  Type         : CPU compute stress (sqrt loop)" -ForegroundColor White
Write-Host "  Duration     : $DurationSeconds seconds" -ForegroundColor White
Write-Host "  Samples      : $($readings.Count)" -ForegroundColor White

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
