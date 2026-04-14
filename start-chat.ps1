# TianshangChat Auto Start Script

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "       TianshangChat Auto Start"
Write-Host "========================================"
Write-Host ""

# Get all network interfaces and find the best one (prefer WLAN/Ethernet)
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch "Loopback" -and 
    $_.IPAddress -notmatch "^127" -and
    $_.IPAddress -notmatch "^169.254"
}

$primaryIP = ""
$allIPs = @()

foreach ($adapter in $adapters) {
    $allIPs += $adapter.IPAddress
    if ($adapter.InterfaceAlias -match "WLAN|Ethernet|LAN|Wi-Fi" -and -not $primaryIP) {
        $primaryIP = $adapter.IPAddress
    }
}

if (-not $primaryIP -and $allIPs.Count -gt 0) {
    $primaryIP = $allIPs[0]
}

if (-not $primaryIP) {
    $primaryIP = "Unable to detect"
}

Write-Host "[INFO] Detected Network Addresses:"
foreach ($ip in $allIPs) {
    Write-Host "         - $ip"
}
Write-Host ""
Write-Host "[INFO] Primary IP: $primaryIP"
Write-Host ""

# Kill existing processes
Write-Host "[INFO] Checking for existing processes..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*TianshangChat*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "TianshangChat" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Ensure firewall rules exist
Write-Host "[INFO] Checking firewall rules..."
$fw1 = Get-NetFirewallRule -DisplayName "TianshangChat-Backend" -ErrorAction SilentlyContinue
$fw2 = Get-NetFirewallRule -DisplayName "TianshangChat-Frontend" -ErrorAction SilentlyContinue

if (-not $fw1) {
    New-NetFirewallRule -DisplayName "TianshangChat-Backend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null
    Write-Host "[OK] Backend firewall rule created"
}
if (-not $fw2) {
    New-NetFirewallRule -DisplayName "TianshangChat-Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow | Out-Null
    Write-Host "[OK] Frontend firewall rule created"
}

Write-Host ""

# Start Backend
Write-Host "[1/3] Starting Backend Service (Port 3000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd F:/Projects/Project09/TianshangChat/backend; npm start" -WindowStyle Normal
Write-Host "[OK] Backend window opened"

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "[2/3] Starting Frontend Service (Port 5173)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd F:/Projects/Project09/TianshangChat/frontend; npm run dev" -WindowStyle Normal
Write-Host "[OK] Frontend window opened"

Start-Sleep -Seconds 3

# Start Desktop Client
$clientPath = "F:\Projects\Project09\TianshangChat\electron\dist\win-unpacked\TianshangChat.exe"
if (Test-Path $clientPath) {
    Write-Host "[3/3] Starting Desktop Client..."
    Start-Process $clientPath
    Write-Host "[OK] Desktop client started"
} else {
    Write-Host "[WARN] Desktop client not found at: $clientPath"
    Write-Host "[WARN] Run 'npm run build:win' in electron folder to build it"
}

Start-Sleep -Seconds 2

# Open browser
Write-Host ""
Write-Host "[OK] Opening browser..."
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================"
Write-Host "       Services Started!"
Write-Host "========================================"
Write-Host ""
Write-Host "Access URLs:"
Write-Host "  Web App:    http://localhost:5173"
if ($primaryIP) {
    Write-Host "  Mobile:     http://$primaryIP`:5173"
}
Write-Host ""
Write-Host "Desktop Client:"
Write-Host "  $clientPath"
Write-Host ""
Write-Host "Notes:"
Write-Host "  - Keep the backend/frontend windows open"
Write-Host "  - Close them with Ctrl+C to stop"
Write-Host "========================================"

Read-Host "Press Enter to exit"
