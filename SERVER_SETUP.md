# Server Setup Guide

## Port Configuration

- **Backend API**: Port `3001` (http://localhost:3001)
- **Frontend UI**: Port `5173` (http://localhost:5173)

## Quick Start

### Option 1: Using the Startup Script
```powershell
.\start_servers.ps1
```

### Option 2: Manual Start

1. **Kill all existing Node processes:**
```powershell
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

2. **Start Backend (in a new terminal):**
```powershell
npm run api
```
This will start the backend on port 3001.

3. **Start Frontend (in a new terminal):**
```powershell
npm run frontend
```
This will start the frontend on port 5173.

## Verify Servers Are Running

### Check Ports
```powershell
netstat -ano | findstr ":3001 :5173" | findstr "LISTENING"
```

### Test Backend
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/deals?limit=1"
```

### Test Frontend
```powershell
Invoke-WebRequest -Uri "http://localhost:5173"
```

## Access URLs

- **Backend API**: http://localhost:3001/api
- **Frontend UI**: http://localhost:5173
- **Deals Page**: http://localhost:5173/deals
- **News Tab**: http://localhost:5173/deals (click News tab)
- **Reviews Tab**: http://localhost:5173/deals (click Reviews tab)

## Troubleshooting

### Port Already in Use
If you see "port already in use" errors:

1. Find the process using the port:
```powershell
netstat -ano | findstr ":3001"
```

2. Kill the process:
```powershell
Stop-Process -Id <PID> -Force
```

### Backend Not Starting
- Check if port 3001 is available
- Verify `server/api/index.js` exists
- Check for errors in the backend terminal window
- Ensure all dependencies are installed: `npm install`

### Frontend Not Starting
- Check if port 5173 is available
- Verify `frontend/vite.config.ts` has port 5173
- Check for errors in the frontend terminal window
- Ensure frontend dependencies are installed: `cd frontend && npm install`

### Multiple Ports Showing UI
If you see UI on ports 3000, 3002, 3003, or 3200:
1. Kill all Node processes
2. Verify `frontend/vite.config.ts` is set to port 5173
3. Restart the frontend server

## Configuration Files

- **Backend Port**: `config/constants.js` → `frontend.apiPort` (default: 3001)
- **Frontend Port**: `frontend/vite.config.ts` → `server.port` (set to 5173)
- **API Base URL**: `frontend/src/services/api.ts` → defaults to `http://localhost:3001/api`

## Notes

- Backend may take 10-20 seconds to fully start
- Frontend may take 30-60 seconds to compile on first run
- Both servers should run in separate terminal windows
- The frontend proxies `/api` requests to the backend automatically














