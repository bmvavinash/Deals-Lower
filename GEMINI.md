# Project Rules & Guidelines: DealsOptimised

## Core Architecture & Server Health Guidelines
Refer to [SERVER_HEALTH_OPTIMIZATION_GUIDELINES.md](./SERVER_HEALTH_OPTIMIZATION_GUIDELINES.md) for full architectural documentation.

### 1. CRITICAL MEMORY: `/health` Endpoint & Cron Job Inviolability
- `cron-job.org` enforces a strict **30-second maximum timeout**. `/health` and `/api/health` MUST respond within milliseconds (< 500ms) with HTTP 200 OK under all circumstances.
- `app.listen(PORT)` and `/health` route definitions in `server/api/index.js` must remain at the very top, before any database initialization, Firebase admin credentials loading, or background workers.
- Global `uncaughtException` and `unhandledRejection` listeners must be registered at the top of entry files to guarantee zero unhandled crashes.
- Autonomous keep-alive self-ping runs every 4 minutes (45s initial delay) to prevent Render free-tier container hibernation.
- Never place asynchronous blocking logic, network calls, or unhandled database connections in the boot critical path.
- All route mounts must use `safeMount` to prevent a single buggy route file from crashing the server.

### 2. Cloud Memory Constraints (512 MB Budget)
- Render Free Tier has a strict 512 MB RAM limit. Exceeding this causes `SIGKILL` (exit code 137) and produces `503 Service Unavailable` on Render.
- **NEVER** import Puppeteer or Selenium at top level of route or scheduler files.
- Full browser automation is disabled in cloud production (`process.env.RENDER`).
- Market hours check (`isIndianMarketOpen`) gates stock quote updates.
- All scheduled disk/database persists must be debounced.

### 3. Distributed Architecture (Render <-> Oracle Cloud & Local Daemon Redirection)
- **Render Cloud**: Acts as the central, lightweight API Gateway. Handles authentication verification, dashboard data delivery, static HTML parsing (Amazon & Myntra), and health pings.
- **Ajio & Flipkart**: Dynamic JS rendering and Akamai WAF require real Chrome automation. Render offloads these URLs to Firebase RTDB `commandsQueue`.
- **Prioritized Routing & Dynamic Failover**:
  - **Local Daemon (Priority 1)**: Preferred for residential IP when active.
  - **Oracle Cloud VM `140.245.249.227` (Priority 2 / Fallback)**: Always-on 24/7 runner with headless Chrome under PM2 (`oracle-daemon`). If Local Daemon is offline, or is running but fails to claim the task within timeout (7-8s), Render automatically fails over and reassigns the queue task to `oracle`.
  - **Client Real-time Polling**: When tasks are queued, frontend polls `/api/deals/queue-status/:commandId` for up to 45s, dynamically reporting live extraction progress, final product title, and price upon completion.
