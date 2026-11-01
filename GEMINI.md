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

### 3. Distributed Architecture (Render <-> Oracle Cloud Redirection)
- **Render Cloud**: Acts as the central, lightweight API Gateway. Handles authentication verification, dashboard data delivery, static HTML parsing (Amazon & Myntra), and health pings.
- **Ajio & Flipkart**: React client-side rendering and Akamai WAF block datacenter cloud scrapers. Render immediately offloads these URLs to Firebase RTDB `commandsQueue` and generates the deal URL without waiting for browser automation.
- **Oracle Cloud VM (`140.245.249.227`)**: Runs `oracle-daemon` via PM2, pulling pending jobs from `commandsQueue` to perform headless Chrome and Selenium scraping, subsequently writing results directly to Firebase RTDB (`deals` and `products`).
