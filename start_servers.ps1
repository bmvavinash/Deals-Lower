# Clean Start Script for Backend and Frontend Servers
Write-Host "=== CLEAN SERVER STARTUP ===" -ForegroundColor Cyan
Write-Host ""

# Kill any existing Node processes
Write-Host "1. Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | ForEach-Object {
    Write-Host "   Killing process $($_.Id)" -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Kill processes on specific ports
Write-Host "2. Clearing ports 3000-3003, 3200, 5173..." -ForegroundColor Yellow
$ports = @(3000, 3001, 3002, 3003, 3200, 5173)
foreach ($port in $ports) {
    $connections = netstat -ano | findstr ":$port" | findstr "LISTENING"
    if ($connections) {
        $connections | ForEach-Object {
            $parts = $_ -split '\s+'
            $pid = $parts[-1]
            if ($pid -match '^\d+$') {
                Write-Host "   Killing process $pid on port $port" -ForegroundColor Gray
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
Start-Sleep -Seconds 2

Write-Host "3. Starting Backend Server (Port 3001)..." -ForegroundColor Green
$backendScript = "cd '$PWD'; Write-Host '=== BACKEND SERVER (Port 3001) ===' -ForegroundColor Cyan; Write-Host 'Starting on: http://localhost:3001' -ForegroundColor White; npm run api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

Write-Host "4. Waiting 5 seconds for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "5. Starting Frontend Server (Port 5173)..." -ForegroundColor Green
$frontendScript = "cd '$PWD'; Write-Host '=== FRONTEND SERVER (Port 5173) ===' -ForegroundColor Cyan; Write-Host 'Starting on: http://localhost:5173' -ForegroundColor White; npm run frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

Write-Host ""
Write-Host "=== SERVER STARTUP COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Server URLs:" -ForegroundColor Cyan
Write-Host "   Backend API:  http://localhost:3001" -ForegroundColor White
Write-Host "   Frontend UI:  http://localhost:5173" -ForegroundColor White
Write-Host "   Deals Page:   http://localhost:5173/deals" -ForegroundColor White
Write-Host ""
Write-Host "Waiting 15 seconds for servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "=== TESTING SERVERS ===" -ForegroundColor Cyan

# Test Backend
Write-Host "Testing Backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/deals?limit=1" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "   Backend is running! Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   Backend not responding yet (check terminal window)" -ForegroundColor Yellow
}

# Test Frontend
Write-Host "Testing Frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "   Frontend is running! Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   Frontend not responding yet (check terminal window)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete! Check the terminal windows for server logs." -ForegroundColor Green
Write-Host ""
