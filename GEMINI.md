# Project Rules & Guidelines: DealsOptimised

## Core Architecture & Server Health Guidelines
Refer to [SERVER_HEALTH_OPTIMIZATION_GUIDELINES.md](./SERVER_HEALTH_OPTIMIZATION_GUIDELINES.md) for full architectural documentation.

### 1. `/health` Endpoint & Fast-Boot Performance
- `cron-job.org` enforces a strict **30-second maximum timeout**. `/health` MUST respond within milliseconds (< 500ms).
- Port binding `app.listen(PORT)` in `server/api/index.js` must execute immediately before any heavy modules or DB initialization.
- Keep-alive self-ping runs every 4 minutes (45s initial delay) to prevent Render free-tier container hibernation.
- Never place asynchronous blocking logic or unhandled database connections in the boot critical path.

### 2. Cloud Memory Constraints (512 MB Budget)
- Render Free Tier has 512 MB RAM limit. Exceeding this causes `SIGKILL` (exit code 137) and produces `503 Service Unavailable` on Render.
- **NEVER** import Puppeteer or Selenium at top level of route or scheduler files.
- Full browser automation is disabled in cloud production (`process.env.RENDER`).
- Market hours check (`isIndianMarketOpen`) gates stock quote updates.
- All scheduled disk/database persists must be debounced.

### 3. Product Processing & Local Daemon Fallback
- **Amazon & Myntra**: Processable on cloud server via lightweight Cheerio / JSON-LD extraction.
- **Ajio**: Akamai EdgeSuite WAF blocks datacenter IPs (HTTP 403). Requires `localDaemon` (residential IP).
- **Flipkart**: React SPA renders price via client-side JavaScript. Cheerio cannot extract price from initial SSR HTML. Requires `localDaemon` (browser execution).
- When cloud extraction fails or is blocked, `/api/deals/process-product` automatically pushes to Firebase `commandsQueue` for `localDaemon` pickup.
