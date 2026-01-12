# Quick Start Guide - Frontend Dashboard

## Prerequisites
- Node.js installed
- Main application dependencies installed
- Firebase credentials configured

## Step 1: Install Dependencies

### Backend API Dependencies
```bash
npm install express cors
```

### Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

## Step 2: Start the System

### Option A: Start Separately

**Terminal 1 - Start API Server:**
```bash
node server/api/index.js
```
You should see: `API Server started on port 3001`

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```
You should see: `Local: http://localhost:3000/`

### Option B: Use npm scripts (if concurrently installed)
```bash
npm install -g concurrently
npm run start:all
```

## Step 3: Access the Dashboard

- **Frontend Dashboard**: http://localhost:3000
- **API Health Check**: http://localhost:3001/health

## Troubleshooting

### API Server won't start
- Check if port 3001 is available
- Verify Firebase credentials are configured
- Check `config/constants.js` has `frontend.apiPort` set

### Frontend won't start
- Make sure you're in the `frontend` directory
- Run `npm install` in the frontend directory
- Check Node.js version (should be 16+)

### API returns errors
- Ensure the main application's Firebase is initialized
- Check that `database/firebaseDB/productDealsDB.js` is working
- Verify Firebase service account path in `config/config.js`

### No data showing
- Ensure the main application has run at least once
- Check Firebase database has data in `deals` and `productdeals` nodes
- Verify API endpoints are accessible: http://localhost:3001/api/deals

## Features Available

1. **Dashboard** - System overview and quick stats
2. **Deals** - View and manage all deals with notification status
3. **Stocks** - View Zerodha holdings and X Alpha crypto data
4. **Logs** - View and filter application logs
5. **Scheduler** - Control scheduler (pause/resume/trigger)
6. **Analytics** - View analytics and performance metrics

## Next Steps

- Review `README_FRONTEND.md` for detailed documentation
- Check `server/api/README.md` for API documentation
- Customize the frontend styling in `frontend/src/components/`


















