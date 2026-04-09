Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AI LAPTOP TESTER - FULL HW SCAN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/6] CPU INFO" -ForegroundColor Magenta
Get-CimInstance Win32_Processor | ForEach-Object {
    Write-Host "  Model    : $($_.Name)" -ForegroundColor White
    Write-Host "  Cores    : $($_.NumberOfCores) cores / $($_.NumberOfLogicalProcessors) threads" -ForegroundColor White
    Write-Host "  Max Speed: $($_.MaxClockSpeed) MHz" -ForegroundColor White
    Write-Host "  Load     : $($_.LoadPercentage)%" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[2/6] RAM INFO" -ForegroundColor Magenta
$totalRam = [Math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1MB, 2)
$freeRam = [Math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
$usedRam = [Math]::Round($totalRam - $freeRam, 2)
$ramPct = [Math]::Round(($usedRam / $totalRam) * 100, 1)
Write-Host "  Total    : $totalRam GB" -ForegroundColor White
Write-Host "  Used     : $usedRam GB ($ramPct%)" -ForegroundColor Yellow
Write-Host "  Free     : $freeRam GB" -ForegroundColor Green
$physMem = Get-CimInstance Win32_PhysicalMemory
$ramSlots = ($physMem | Measure-Object).Count
$ramSpeed = ($physMem | Select-Object -First 1).Speed
Write-Host "  Slots    : $ramSlots x $ramSpeed MHz" -ForegroundColor White
Write-Host ""

Write-Host "[3/6] GPU INFO" -ForegroundColor Magenta
Get-CimInstance Win32_VideoController | ForEach-Object {
    $vramGB = [Math]::Round($_.AdapterRAM / 1GB, 2)
    Write-Host "  Name     : $($_.Name)" -ForegroundColor White
    Write-Host "  VRAM     : $vramGB GB" -ForegroundColor White
    Write-Host "  Driver   : $($_.DriverVersion)" -ForegroundColor White
    Write-Host "  Refresh  : $($_.CurrentRefreshRate) Hz" -ForegroundColor White
}
Write-Host ""

Write-Host "[4/6] STORAGE INFO" -ForegroundColor Magenta
Get-CimInstance Win32_DiskDrive | ForEach-Object {
    $sizeGB = [Math]::Round($_.Size / 1GB, 0)
    Write-Host "  Model    : $($_.Model)" -ForegroundColor White
    Write-Host "  Size     : $sizeGB GB ($($_.InterfaceType))" -ForegroundColor White
    Write-Host "  Media    : $($_.MediaType)" -ForegroundColor White
}
Write-Host ""
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
    $totalGB = [Math]::Round($_.Size / 1GB, 0)
    $freeGB = [Math]::Round($_.FreeSpace / 1GB, 0)
    $usedGB = $totalGB - $freeGB
    $pct = [Math]::Round(($usedGB / $totalGB) * 100, 1)
    Write-Host "  Partition $($_.DeviceID) -> Total: $totalGB GB | Used: $usedGB GB ($pct%) | Free: $freeGB GB" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[5/6] BATTERY INFO" -ForegroundColor Magenta
$battery = Get-CimInstance Win32_Battery
if ($battery) {
    Write-Host "  Charge   : $($battery.EstimatedChargeRemaining)%" -ForegroundColor Yellow
    Write-Host "  Runtime  : $($battery.EstimatedRunTime) min" -ForegroundColor White
    $statusMap = @{0="Unknown";1="Discharging";2="On AC";3="Fully Charged";4="Low";5="Critical";6="Charging";7="Charging High";8="Charging Low";9="Charging Critical"}
    Write-Host "  Status   : $($statusMap[$battery.BatteryStatus])" -ForegroundColor White
    if ($battery.DesignCapacity -and $battery.FullChargeCapacity) {
        $health = [Math]::Round(($battery.FullChargeCapacity / $battery.DesignCapacity) * 100, 1)
        Write-Host "  Health   : $health%" -ForegroundColor Yellow
    }
} else {
    Write-Host "  No battery detected (Desktop)" -ForegroundColor Gray
}
Write-Host ""

Write-Host "[6/6] OS INFO" -ForegroundColor Magenta
$os = Get-CimInstance Win32_OperatingSystem
Write-Host "  OS       : $($os.Caption)" -ForegroundColor White
Write-Host "  Version  : $($os.Version) (Build $($os.BuildNumber))" -ForegroundColor White
Write-Host "  Arch     : $($os.OSArchitecture)" -ForegroundColor White
Write-Host "  PC Name  : $($os.CSName)" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DONE - Press Enter to exit" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
