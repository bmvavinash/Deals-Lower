# DealsOptimised - Server Health & Architecture Guidelines

> [!IMPORTANT]
> **CRITICAL ARCHITECTURAL CONSTRAINTS FOR CLOUD DEPLOYMENTS (Render Free Tier)**
> 
> All agents, developers, and workflows modifying `DealsOptimised` MUST strictly enforce these guidelines to prevent downtime, 503 errors, and cron-job timeouts.

---

## 1. Cron-Job.org 30-Second Hard Timeout Limit
- **Constraint**: `cron-job.org` enforces a strict **maximum timeout of 30 seconds**. Any request taking > 30 seconds triggers `Failed (timeout)`.
- **Render Free Tier Cold Start**: If a container is allowed to hibernate (after 15 minutes of inactivity), cold-booting Node.js and binding ports takes 35–50 seconds, guaranteed to exceed the 30-second timeout.
- **Rule**:
  1. The server must ALWAYS maintain an autonomous keep-alive self-ping (every 4 minutes, with a 45-second initial delay) to prevent hibernation.
  2. Port binding (`app.listen(PORT)`) must happen **immediately on boot** (within < 100ms) before any asynchronous tasks, database connections, or scrapers are initialized.
  3. The `/health` and `/api/health` endpoints must return an immediate HTTP 200 JSON response with zero blocking I/O:
     ```javascript
     app.all(['/health', '/api/health'], (req, res) => {
       res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
       res.status(200).json({ 
         status: 'ok', 
         uptime: Math.round(process.uptime()),
         timestamp: new Date().toISOString(),
         version: '1.0.0'
       });
     });
     ```

---

## 2. 512 MB Container RAM Budget & OOM Prevention
- **Constraint**: Render Free Tier allocates **512 MB of RAM**. If memory exceeds 512 MB, Linux OOM killer sends `SIGKILL` (exit code 137).
- **503 Service Unavailable Cause**: When the container is killed by OOM or restarting after a crash, Render's reverse proxy returns `503 Service Unavailable`.
- **Rules**:
  1. **NEVER import Puppeteer or Selenium at top-level** in route files (`deals.js`, `scheduler.js`, `news.js`, `banners.js`, `stocks.js`) or startup scripts.
  2. All heavy libraries MUST be **lazy-loaded inside handler functions** only when invoked.
  3. **No Chromium In Cloud**: Full browser automation (Puppeteer / Selenium) is disabled in cloud production (`process.env.RENDER`). Browser-based scraping must run on `localDaemon`.
  4. **Single Telegram Poller**: Never run Telegram polling in multiple processes or cloud instances. Cloud uses Webhooks or passive dispatch; continuous polling runs on local PC to prevent 409 Conflict crash loops.
  5. **CMP Market-Hours Guard**: Do not run intensive stock CMP quote refreshes on weekends or outside Indian market hours (Mon–Fri 09:15–15:30 IST).
  6. **Debounced Persistence**: Any disk or RTDB writes in recurring intervals must be debounced (minimum 500ms) to prevent event-loop starvation.

---

## 3. Product Extraction Architecture & Merchant Capabilities
| Merchant | Server Headless (Cloud) | Local Daemon (PC) | Mechanism / Reason |
| :--- | :---: | :---: | :--- |
| **Amazon** | ✅ Yes | ✅ Yes | Cheerio / JSON-LD / HTML parser |
| **Myntra** | ✅ Yes | ✅ Yes | Static JSON-LD (`@type: "Product"`) embedded in initial HTML |
| **Ajio** | ❌ Blocked (403) | ✅ Yes | Protected by **Akamai EdgeSuite WAF**; blocks cloud datacenter IPs. Requires residential IP on `localDaemon`. |
| **Flipkart** | ❌ No Price (JS) | ✅ Yes | React SPA; static HTML has layout & title but prices are rendered via client-side JS bundles. Requires Chrome on `localDaemon`. |

- **Fallback Protocol**:
  When processing products on server (`/api/deals/process-product`), if server extraction fails or is blocked (Ajio 403 / Flipkart missing price), the system:
  1. Checks `daemonHeartbeat` in Firebase RTDB (`lowerdealhub`).
  2. Pushes the job to `commandsQueue`: `node scripts/processSingleProduct.js "<url>" <postProduct> <saleName>`.
  3. If `localDaemon` is active, waits up to 8s for completion; otherwise returns `{ status: 'queued', isDaemonAlive }`.
