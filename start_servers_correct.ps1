# Start Frontend Dashboard Servers - CORRECT PATHS
$workspacePath = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Frontend Dashboard System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Workspace: $workspacePath" -ForegroundColor Gray
Write-Host ""

# Verify paths
if (-not (Test-Path $workspacePath)) {
    Write-Host "❌ Workspace path not found: $workspacePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$workspacePath\server\api\index.js")) {
    Write-Host "❌ API server not found" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$workspacePath\frontend\package.json")) {
    Write-Host "❌ Frontend package.json not found" -ForegroundColor Red
    exit 1
}

Write-Host "✅ All paths verified" -ForegroundColor Green
Write-Host ""

# Start API Server
Write-Host "[1/2] Starting API Server on port 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$workspacePath'; Write-Host 'API Server Starting...' -ForegroundColor Yellow; node server/api/index.js" -WindowStyle Normal

Start-Sleep -Seconds 3

# Check API Server
try {
    $health = Invoke-RestMethod "http://localhost:3001/health" -TimeoutSec 3
    Write-Host "✅ API Server is RUNNING!" -ForegroundColor Green
} catch {
    Write-Host "⚠ API Server starting (check window for status)" -ForegroundColor Yellow
}

# Start Frontend
Write-Host ""
Write-Host "[2/2] Starting Frontend Dev Server on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$workspacePath\frontend'; Write-Host 'Frontend Starting...' -ForegroundColor Yellow; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 5

# Check Frontend
try {
    $fe = Invoke-WebRequest "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Frontend is RUNNING!" -ForegroundColor Green
} catch {
    Write-Host "⚠ Frontend starting (may take 10-15 seconds to compile)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Servers Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Access Points:" -ForegroundColor White
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   API:      http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Check the PowerShell windows for:" -ForegroundColor White
Write-Host "   - API: 'API Server started on port 3001'" -ForegroundColor Gray
Write-Host "   - Frontend: 'Local: http://localhost:3000/'" -ForegroundColor Gray
Write-Host ""


















