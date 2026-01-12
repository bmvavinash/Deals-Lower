# Frontend Dashboard System

This is a comprehensive frontend dashboard for managing deals, stocks, logs, scheduler, and analytics.

## Architecture

- **Backend API**: Express.js server on port 3001
- **Frontend**: React + TypeScript with Vite on port 3000
- **Real-time**: Firebase integration for live data

## Setup Instructions

### 1. Install Backend Dependencies

```bash
npm install express cors
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Start the Backend API Server

```bash
node server/api/index.js
```

Or add to `package.json`:
```json
"scripts": {
  "api": "node server/api/index.js",
  "frontend": "cd frontend && npm run dev"
}
```

### 4. Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`
The API will be available at `http://localhost:3001`

## Features

### Dashboard
- System health overview
- Recent activity
- Quick stats

### Deals Management
- View all deals (Hot Deals & Product Deals)
- Filter by deal type and platform
- View notification status per deal
- Manual trigger for bulk updates

### Stocks Management
- Zerodha holdings table
- X Alpha crypto data
- Stock recommendations

### Logs Management
- Structured log viewer
- Filter by level, module, date
- Log statistics
- Clear logs functionality

### Scheduler Management
- View scheduler status
- Pause/Resume scheduler
- Manual trigger
- Execution history

### Analytics
- Deal analytics (platform distribution, price ranges)
- Notification analytics (success rates by platform)
- Performance metrics

## API Endpoints

### Deals
- `GET /api/deals` - List all deals
- `GET /api/deals/:productCode` - Get specific deal
- `GET /api/deals/notifications/:productCode` - Get notification status
- `POST /api/deals/manual-trigger` - Trigger bulk update

### Stocks
- `GET /api/stocks/zerodha` - Get Zerodha data
- `GET /api/stocks/xalpha` - Get X Alpha data
- `GET /api/stocks/recommendations` - Get recommendations

### Logs
- `GET /api/logs` - Get logs
- `GET /api/logs/stats` - Get log statistics
- `DELETE /api/logs` - Clear logs

### Scheduler
- `GET /api/scheduler/status` - Get status
- `POST /api/scheduler/pause` - Pause scheduler
- `POST /api/scheduler/resume` - Resume scheduler
- `POST /api/scheduler/trigger` - Trigger manually

### Notifications
- `GET /api/notifications/platform-status` - Get platform statuses
- `GET /api/notifications/deal/:productCode` - Get deal notifications
- `GET /api/notifications/failed` - Get failed notifications

### Analytics
- `GET /api/analytics/deals` - Deal analytics
- `GET /api/analytics/notifications` - Notification analytics
- `GET /api/analytics/performance` - Performance metrics

## Notification Tracking

The system tracks which deals are sent to which platforms (Telegram, WhatsApp, Facebook). This is integrated into:
- `services/notifyService.js` - Tracks Telegram/WhatsApp sends
- `postdeals.js` - Tracks all platform notifications
- `dataSources/telegram.js` - Tracks Telegram bot sends

All tracking is backward compatible - existing code continues to work without tracking.

## Backward Compatibility

- All existing services remain unchanged
- API layer acts as a facade
- Notification tracking is optional
- Existing Firebase structure preserved
- New tracking data in separate Firebase path

## Development

### Frontend Development
```bash
cd frontend
npm run dev
```

### Build for Production
```bash
cd frontend
npm run build
```

### Backend Development
The API server runs independently and can be started separately:
```bash
node server/api/index.js
```

## Configuration

Frontend API configuration is in `config/constants.js`:
```javascript
frontend: {
  apiPort: 3001,
  enableWebSocket: true,
  logRetentionDays: 30
}
```

## Notes

- The frontend requires the backend API to be running
- The backend API requires the main application's Firebase connection
- Notification tracking is additive and doesn't break existing functionality
- All changes maintain backward compatibility


















