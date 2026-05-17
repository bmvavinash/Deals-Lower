/**
 * Trigger bulk update via API and poll execution status until complete.
 * Requires: Backend API running on port 3001 (npm run api).
 *
 * Usage:
 *   node scripts/triggerBulkUpdateAndMonitor.js
 *   node scripts/triggerBulkUpdateAndMonitor.js --no-trigger   # only poll status
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

async function triggerBulkUpdate() {
  const res = await fetch(`${API_BASE}/api/deals/manual-trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceType: 'website', targetDb: 'productdeals' })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trigger failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  console.log('[trigger]', data.message || data);
  return data;
}

async function getExecutionStatus() {
  const res = await fetch(`${API_BASE}/api/execution/status?type=all`);
  if (!res.ok) throw new Error(`Status failed ${res.status}`);
  const json = await res.json();
  return json.success ? json.data : null;
}

async function getExecutionHistory(limit = 5) {
  const res = await fetch(`${API_BASE}/api/execution/history?limit=${limit}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.success && Array.isArray(json.data)) ? json.data : [];
}

async function main() {
  const onlyMonitor = process.argv.includes('--no-trigger');

  console.log('API base:', API_BASE);
  console.log('');

  if (!onlyMonitor) {
    try {
      await triggerBulkUpdate();
      console.log('Bulk update triggered. Polling execution status every 15s...\n');
    } catch (e) {
      console.error('Could not trigger bulk update. Is the API running? (npm run api)');
      console.error(e.message);
      process.exit(1);
    }
  } else {
    console.log('Monitoring only (--no-trigger). Polling every 15s...\n');
  }

  const pollMs = 15000;
  let lastExecutionId = null;
  let hadBulkRun = false;

  for (;;) {
    try {
      const status = await getExecutionStatus();
      if (!status) {
        console.log(new Date().toISOString(), '| No status');
        await sleep(pollMs);
        continue;
      }

      const exec = status.currentExecution;
      if (exec) {
        hadBulkRun = hadBulkRun || exec.type === 'bulk_update';
        if (exec.id !== lastExecutionId) {
          lastExecutionId = exec.id;
          console.log('\n--- New execution ---');
          console.log('Type:', exec.type, '| Started:', exec.startedAt || '');
        }
        console.log(
          new Date().toISOString(),
          '|',
          exec.type,
          '|',
          exec.currentPlatform || '-',
          exec.currentCategory ? `| ${exec.currentCategory}` : ''
        );
      } else {
        if (hadBulkRun) {
          const history = await getExecutionHistory(5);
          const lastBulk = history.find((e) => e.type === 'bulk_update');
          if (lastBulk) {
            console.log('\n--- Bulk update completed ---');
            console.log('Completed:', lastBulk.completedAt || '');
            console.log('Total products:', lastBulk.totalProducts ?? 'N/A');
            console.log('Success rate:', lastBulk.successRate ?? 'N/A');
          }
          break;
        }
        console.log(new Date().toISOString(), '| Idle (no current execution)');
      }
    } catch (e) {
      console.error(new Date().toISOString(), '| Error:', e.message);
    }
    await sleep(pollMs);
  }

  console.log('\nDone. To run Telegram bot in another terminal: node run_telegram_bot.js');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
