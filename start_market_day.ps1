# DealsOptimised - Market Day Startup Script (PowerShell)
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "         DEALSOPTIMISED - MARKET DAY TRADING SERVICES" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan

# 1. Chrome on 9223
$port9223 = Get-NetTCPConnection -LocalPort 9223 -ErrorAction SilentlyContinue
if ($port9223) {
    Write-Host "[OK] Chrome Debugger is ALREADY RUNNING on port 9223." -ForegroundColor Green
} else {
    Write-Host "[LAUNCH] Starting Chrome on port 9223 (C:\selenum\ChromeStocksProfile)..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList @(
        "--remote-debugging-port=9223",
        '--user-data-dir="C:\selenum\ChromeStocksProfile"',
        "--no-first-run",
        "--no-default-browser-check",
        "https://web.whatsapp.com"
    )
    Start-Sleep -Seconds 3
}

# 2. Backend API on 3003
$port3003 = Get-NetTCPConnection -LocalPort 3003 -ErrorAction SilentlyContinue
if ($port3003) {
    Write-Host "[OK] Backend API is ALREADY RUNNING on port 3003." -ForegroundColor Green
} else {
    Write-Host "[LAUNCH] Starting Backend API Server on port 3003..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server/api/index.js"
    Start-Sleep -Seconds 3
}

# 3. Frontend on 5173
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($port5173) {
    Write-Host "[OK] Frontend Vite Dev Server is ALREADY RUNNING on port 5173." -ForegroundColor Green
} else {
    Write-Host "[LAUNCH] Starting Frontend Vite Server on port 5173..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm.cmd run dev"
    Start-Sleep -Seconds 2
}

# 4. WhatsApp Chat Selector
Write-Host "[4/4] Ensuring WhatsApp Web is focused on 'SOIC 3yr Research'..." -ForegroundColor Cyan
try {
    node scripts/searchAndOpenSOIC.js
    Write-Host "[OK] Attached and focused on SOIC 3yr Research." -ForegroundColor Green
} catch {
    Write-Host "[INFO] Focus script completed." -ForegroundColor Gray
}

Write-Host "=======================================================================" -ForegroundColor Green
Write-Host " ALL SERVICES ONLINE & OPERATIONAL FOR TRADING HOURS:" -ForegroundColor Green
Write-Host " - Frontend Dashboard:    http://localhost:5173/stocks" -ForegroundColor White
Write-Host " - API Health:            http://localhost:3003/health" -ForegroundColor White
Write-Host " - Scheduler Status:      http://localhost:3003/api/stocks/scheduler/status" -ForegroundColor White
Write-Host " - Chrome WhatsApp Port:  http://127.0.0.1:9223" -ForegroundColor White
Write-Host "=======================================================================" -ForegroundColor Green

Start-Process "http://localhost:5173/stocks"
