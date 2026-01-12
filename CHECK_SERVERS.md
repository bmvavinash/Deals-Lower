# Server Status Check

## Servers Started

Two PowerShell windows should have opened:
1. **API Server** - Running `node server/api/index.js` on port 3001
2. **Frontend Dev Server** - Running `npm run dev` in frontend directory on port 3000

## How to Verify

### 1. Check PowerShell Windows
Look at the two PowerShell windows that opened. They should show:
- **API Server window**: Should show "API Server started on port 3001"
- **Frontend window**: Should show Vite dev server output with "Local: http://localhost:3000/"

### 2. Test in Browser
- Open: http://localhost:3000
- You should see the Deals Dashboard

### 3. Test API Directly
- Open: http://localhost:3001/health
- Should return: `{"status":"ok","timestamp":"...","version":"1.0.0"}`

## Common Issues

### API Server Not Starting
**Possible causes:**
- Port 3001 already in use
- Firebase credentials not configured
- Missing dependencies

**Check the API server PowerShell window for errors**

### Frontend Not Starting
**Possible causes:**
- Port 3000 already in use
- TypeScript compilation errors
- Missing dependencies (should be installed now)

**Check the frontend PowerShell window for errors**

## Manual Start (if needed)

### Start API Server:
```powershell
cd "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn"
node server/api/index.js
```

### Start Frontend:
```powershell
cd "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn\frontend"
npm run dev
```

## Next Steps

1. Check the PowerShell windows for any error messages
2. Share any errors you see and I'll help fix them
3. Once both are running, access http://localhost:3000 in your browser


















