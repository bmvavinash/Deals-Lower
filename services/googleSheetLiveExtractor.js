const crypto = require('crypto');
const https = require('https');
const { listChromeTargets, connectCdpSocket, createChromeTab } = require('./chromeCdpHelper');
const { getModuleLogger } = require('../logger/logger');
const {
  saveSignals,
  saveSheetSnapshots,
  saveNotification,
  isAlertOnCooldown,
  recordAlertSent,
  getWhatsAppStockStates,
  memoryDB
} = require('../database/stocksMultiDB');
const { resolveSignalTickerAndQuote } = require('./marketQuoteService');
const { generateBestInsights } = require('./stockInsightsAggregator');
const { evaluateAndDispatchBatch } = require('./stockAlertNotificationService');
const { sendRawTelegramMessage, resolveDestination } = require('./genericTelegramDispatcher');

const logger = getModuleLogger('googleSheetLiveExtractor');

const DEFAULT_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1fCXMjJSxZp8chU8q2vy94AQCEBRKtCvxo2dwJ_L6_RM';
const DEFAULT_WATCHLIST_GID = '1944936862';
const DEFAULT_STOCKLIST_GID = '686195741';

/**
 * Fetch URL following redirects using authenticated session cookie
 */
function fetchWithCookie(url, cookieHeader) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Cookie': cookieHeader } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 307) {
        return fetchWithCookie(res.headers.location, cookieHeader).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} while fetching Google Sheet CSV`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

/**
 * Parse CSV line handling quoted fields with commas
 */
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Capture a lightweight JPEG screenshot of a specific Google Sheet tab (Watchlist / Stock list)
 */
async function captureTabScreenshot(sheetCdp, spreadsheetId, gid, tabName) {
  try {
    const targetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`;
    const curUrl = await sheetCdp.evaluate(() => window.location.href).catch(() => '');
    await sheetCdp.bringToFront();
    if (!curUrl || !curUrl.includes(`gid=${gid}`)) {
      await sheetCdp.navigate(targetUrl, 2200);
    } else {
      await new Promise(r => setTimeout(r, 700));
    }

    const base64 = await sheetCdp.captureScreenshot({
      format: 'jpeg',
      quality: 62
    });

    return {
      tab: tabName,
      gid: String(gid),
      url: targetUrl,
      capturedAt: new Date().toISOString(),
      dataUrl: `data:image/jpeg;base64,${base64}`
    };
  } catch (err) {
    logger.warn(`Could not capture Google Sheet screenshot for "${tabName}" (gid=${gid}): ${err.message}`);
    return null;
  }
}

/**
 * Attempt to locate an authenticated Google Sheet tab across candidate Chrome debugging ports (default [9223, 9222]).
 * Never captures or overwrites snapshots if redirected to accounts.google.com Sign-In.
 */
async function connectAuthenticatedSheetPort(portsToTry, targetSheetUrl, primaryPort) {
  let lastSignInPort = null;

  for (const port of portsToTry) {
    let targets;
    try {
      targets = await listChromeTargets(port);
    } catch (_) {
      continue;
    }

    const pageTargets = targets.filter(t => t.type === 'page');
    const waTarget = pageTargets.find(t => (t.url || '').includes('web.whatsapp.com'));
    let sheetTarget = pageTargets.find(t => (t.url || '').includes('docs.google.com/spreadsheets'));

    if (!sheetTarget && port === primaryPort) {
      logger.info(`No Google Sheet tab currently open on Chrome port ${port} — opening SOIC spreadsheet...`);
      sheetTarget = await createChromeTab(port, targetSheetUrl).catch(() => null);
      if (sheetTarget) await new Promise(r => setTimeout(r, 4200));
    }

    if (!sheetTarget?.webSocketDebuggerUrl) continue;

    const cdp = await connectCdpSocket(sheetTarget.webSocketDebuggerUrl, 20000);
    const meta = await cdp.evaluate(() => ({
      title: document.title || '',
      url: window.location.href || ''
    })).catch(() => ({ title: '', url: '' }));

    const isSignIn =
      (meta.url || '').includes('accounts.google.com') ||
      (meta.title || '').toLowerCase().includes('sign-in') ||
      !(meta.url || '').includes('docs.google.com/spreadsheets');

    if (isSignIn) {
      logger.warn(`Chrome port ${port} is not signed into Google Sheets ("${meta.title || 'Sign-in'}").`);
      lastSignInPort = port;
      await cdp.close().catch(() => {});
      continue;
    }

    return { port, cdp, meta, waTarget };
  }

  return { needsSignIn: true, lastSignInPort };
}

/**
 * Extract stock signals from Google Sheet open in Chrome (checks port 9223, falls back to 9222 if not signed in)
 */
async function extractGoogleSheetSignals(options = {}) {
  const primaryPort = options.port || parseInt(process.env.STOCKS_CHROME_PORT || '9223', 10);
  const portsToTry = options.port ? [options.port, 9222].filter((v, i, a) => a.indexOf(v) === i) : [primaryPort, 9222];
  logger.info(`Connecting via CDP (ports ${portsToTry.join(', ')}) for Google Sheet extraction...`);

  let pageTitle = 'SOIC Google Sheet';
  let currentUrl = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit#gid=${DEFAULT_WATCHLIST_GID}`;
  let cookieHeader = '';
  let spreadsheetId = DEFAULT_SPREADSHEET_ID;
  let finalTabs = [];
  const snapshots = {};

  let sheetCdp = null;
  let waTarget = null;
  let activePort = primaryPort;

  try {
    const conn = await connectAuthenticatedSheetPort(portsToTry, currentUrl, primaryPort);
    if (conn.needsSignIn || !conn.cdp) {
      const msg = `Google Sheets requires sign-in on Chrome ${conn.lastSignInPort || primaryPort} (please sign into Google once in Chrome 9223/9222 or keep the Sheet open).`;
      logger.warn(msg);
      return {
        success: false,
        needsGoogleSignIn: true,
        message: msg,
        tabsProcessed: {},
        snapshotsCaptured: [],
        sheetChangesDetected: 0,
        totalSignalsFound: 0
      };
    }

    activePort = conn.port;
    sheetCdp = conn.cdp;
    waTarget = conn.waTarget;
    pageTitle = conn.meta?.title || pageTitle;
    currentUrl = conn.meta?.url || currentUrl;
    logger.info(`Using authenticated Google Sheet on Chrome ${activePort}: "${pageTitle}" (${currentUrl})`);

    // Extract session cookies for authenticated CSV export (without calling Network.enable)
    const cookies = await sheetCdp.getCookies([
      'https://docs.google.com',
      'https://accounts.google.com',
      currentUrl
    ]);
    if (!cookies || cookies.length === 0) {
      throw new Error('No session cookies found for Google Sheet page. Ensure Chrome is signed into Google.');
    }
    const dedupCookies = new Map();
    for (const c of cookies) dedupCookies.set(c.name, c.value);
    cookieHeader = Array.from(dedupCookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    // Extract Spreadsheet ID from URL
    const idMatch = currentUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    spreadsheetId = idMatch ? idMatch[1] : DEFAULT_SPREADSHEET_ID;

    // Discover all sheets/tabs metadata from page HTML
    const html = await sheetCdp.evaluate(() => document.documentElement?.innerHTML || '');
    const regex = /\[(\d+),\s*0,\s*\\?"(\d+)\\?",\s*\[\{\\?"1\\?":\[\[0,\s*0,\s*\\?"([^"\\]+)\\?"/g;
    const tabs = [];
    let m;
    while ((m = regex.exec(html)) !== null) {
      tabs.push({
        index: parseInt(m[1], 10),
        gid: m[2],
        name: m[3]
      });
    }

    // Fallback known tabs if dynamic regex is incomplete
    const knownGids = {
      'Watchlist': DEFAULT_WATCHLIST_GID,
      'Stock list': DEFAULT_STOCKLIST_GID,
      'Feb 16 2025': '1253291650',
      'Results Q2 2024': '1047831251',
      'Scripts dump': '1581395411'
    };

    finalTabs = tabs.length > 0 ? tabs : Object.entries(knownGids).map(([name, gid], idx) => ({ index: idx, gid, name }));
    logger.info(`Discovered ${finalTabs.length} tabs in sheet.`);

    // Capture compressed visual screenshots of Watchlist & Stock list tabs ONLY when authenticated on spreadsheets URL
    const watchlistTabMeta = finalTabs.find(t => t.name.toLowerCase().includes('watchlist')) || { gid: DEFAULT_WATCHLIST_GID, name: 'Watchlist' };
    const stocklistTabMeta = finalTabs.find(t => t.name.toLowerCase().includes('stock list')) || { gid: DEFAULT_STOCKLIST_GID, name: 'Stock list' };

    const wlSnap = await captureTabScreenshot(sheetCdp, spreadsheetId, watchlistTabMeta.gid, watchlistTabMeta.name);
    if (wlSnap) snapshots.watchlist = { ...wlSnap, title: pageTitle };

    const slSnap = await captureTabScreenshot(sheetCdp, spreadsheetId, stocklistTabMeta.gid, stocklistTabMeta.name);
    if (slSnap) snapshots.stock_list = { ...slSnap, title: pageTitle };

    // Return focus to WhatsApp tab if it was open
    if (waTarget?.webSocketDebuggerUrl) {
      const waCdp = await connectCdpSocket(waTarget.webSocketDebuggerUrl, 5000).catch(() => null);
      if (waCdp) {
        await waCdp.bringToFront();
        await waCdp.close();
      }
    }
  } finally {
    if (sheetCdp) {
      await sheetCdp.close().catch(() => {});
    }
  }

  if (Object.keys(snapshots).length > 0) {
    saveSheetSnapshots(snapshots).catch(err => {
      logger.warn('Failed to save Google Sheet screenshots:', { error: err.message });
    });
  }

  const allExtractedSignals = [];
  const tabSummary = {};

  // 1. Process "Watchlist" Tab
  const watchlistTab = finalTabs.find(t => t.name.toLowerCase().includes('watchlist')) || { gid: DEFAULT_WATCHLIST_GID, name: 'Watchlist' };
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${watchlistTab.gid}`;
    const csv = await fetchWithCookie(csvUrl, cookieHeader);
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

    let count = 0;
    // Header is row 4, data begins at row 5
    for (let i = 5; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const stockName = cols[1];
      const ticker = cols[3]?.toUpperCase().replace(/[^A-Z0-9&-]/g, '');
      if (!ticker || ticker.length < 2 || ticker.length > 18 || ticker === 'NA' || ticker === 'N/A' || ticker.includes('WHEREWEEXPECT') || ticker.includes('MAXQTY')) continue;

      // Check for buy range: Col 6 is "Updated Buy range", Col 5 is "Avg Price Recommended", Col 11 is previous buy price
      // Note: Col 10 is CMP (Market price) in Google Sheet Watchlist tab - NEVER fall back to Col 10 for buy ceiling!
      let rawBuy = cols[6] || cols[5] || cols[11];
      let cleanPrice = parseFloat(rawBuy?.replace(/,/g, ''));

      // User confirmed rule: AARTIPHARM buy ceiling is strictly ₹770 (938 is wrong / CMP)
      if (ticker === 'AARTIPHARM') {
        cleanPrice = 770;
        rawBuy = '770';
      }

      const conviction = cols[8] || 'Medium';
      const horizon = cols[9] || 'Medium term';
      const sheetRowNum = i + 1;
      const rowUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${watchlistTab.gid}&range=A${sheetRowNum}:L${sheetRowNum}`;
      const rawText = `Stock: ${stockName} (${ticker}) | Buy Range: ${rawBuy} | Conviction: ${conviction} | Horizon: ${horizon}`;
      const id = `GS_WATCHLIST_${ticker.replace(/[^A-Z0-9_-]/g, '')}`;
      const sheetHash = crypto.createHash('sha1').update(`${id}|${cleanPrice || ''}|${rawText}`).digest('hex').slice(0, 12);
      const existing = memoryDB.signals ? memoryDB.signals[id] : null;

      allExtractedSignals.push({
        id,
        symbol: ticker,
        companyName: stockName || ticker,
        exchange: 'NSE',
        action: 'BUY',
        callType: horizon.toLowerCase().includes('long') ? 'POSITIONAL' : 'SWING',
        entryPrice: !isNaN(cleanPrice) ? cleanPrice : null,
        entryMax: !isNaN(cleanPrice) ? cleanPrice : null,
        target1: null,
        stopLoss: null,
        rating: conviction === 'High' ? 5 : conviction === 'Medium' ? 3 : 2,
        requiresClarification: false,
        source: `Google Sheet: ${watchlistTab.name}`,
        sourceLabel: `Google Sheet: ${watchlistTab.name}`,
        sourcePriority: 2,
        isSourceOfTruth: false,
        sheetTab: watchlistTab.name,
        sheetRow: sheetRowNum,
        sheetUrl: rowUrl,
        rawHeader: `Google Sheet (${watchlistTab.name}) • Row ${sheetRowNum}`,
        rawText,
        lastSheetHash: sheetHash,
        confidence: 0.95,
        timestamp: (existing?.lastSheetHash === sheetHash && existing?.timestamp) ? existing.timestamp : new Date().toISOString()
      });
      count++;
    }
    tabSummary[watchlistTab.name] = count;
    logger.info(`Extracted ${count} signals from "${watchlistTab.name}" tab.`);
  } catch (err) {
    logger.error(`Error processing Watchlist tab: ${err.message}`);
    tabSummary[watchlistTab.name] = 0;
  }

  // 2. Process "Stock list" Tab
  const stocklistTab = finalTabs.find(t => t.name.toLowerCase().includes('stock list')) || { gid: DEFAULT_STOCKLIST_GID, name: 'Stock list' };
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${stocklistTab.gid}`;
    const csv = await fetchWithCookie(csvUrl, cookieHeader);
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

    let count = 0;
    // Header is row 4, data begins at row 5
    for (let i = 5; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const ticker = cols[1]?.toUpperCase().replace(/[^A-Z0-9&-]/g, '');
      if (!ticker || ticker.length < 2 || ticker.length > 18 || ticker === 'NA' || ticker === 'N/A' || ticker.includes('WHEREWEEXPECT') || ticker.includes('MAXQTY')) continue;

      const star = parseInt(cols[2], 10);
      const horizon = cols[4] || '2-3 years';
      let buyRange = cols[6];
      let cleanPrice = parseFloat(buyRange?.replace(/,/g, ''));
      const comments = cols[11];

      // Aarti Pharmalabs specific check: User confirmed ₹770 is correct
      if (ticker === 'AARTIPHARM') {
        cleanPrice = 770;
        buyRange = '770';
      }

      const sheetRowNum = i + 1;
      const rowUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${stocklistTab.gid}&range=A${sheetRowNum}:L${sheetRowNum}`;
      const rawText = `Stock: ${ticker} | Star: ${star} | Buy range: ${buyRange} | Horizon: ${horizon} | Comments: ${comments || ''}`;
      const id = `GS_STOCKLIST_${ticker.replace(/[^A-Z0-9_-]/g, '')}`;
      const sheetHash = crypto.createHash('sha1').update(`${id}|${cleanPrice || ''}|${star || ''}|${rawText}`).digest('hex').slice(0, 12);
      const existing = memoryDB.signals ? memoryDB.signals[id] : null;

      allExtractedSignals.push({
        id,
        symbol: ticker,
        companyName: ticker === 'AARTIPHARM' ? 'Aarti Pharmalabs Limited' : ticker,
        exchange: 'NSE',
        action: 'BUY',
        callType: horizon.toLowerCase().includes('year') ? 'POSITIONAL' : 'SWING',
        entryPrice: !isNaN(cleanPrice) ? cleanPrice : null,
        entryMax: !isNaN(cleanPrice) ? cleanPrice : null,
        target1: null,
        stopLoss: null,
        rating: !isNaN(star) ? star : null,
        requiresClarification: false,
        source: `Google Sheet: ${stocklistTab.name}`,
        sourceLabel: `Google Sheet: ${stocklistTab.name}`,
        sourcePriority: 2,
        isSourceOfTruth: false,
        sheetTab: stocklistTab.name,
        sheetRow: sheetRowNum,
        sheetUrl: rowUrl,
        rawHeader: `Google Sheet (${stocklistTab.name}) • Row ${sheetRowNum}`,
        rawText,
        lastSheetHash: sheetHash,
        confidence: 0.95,
        timestamp: (existing?.lastSheetHash === sheetHash && existing?.timestamp) ? existing.timestamp : new Date().toISOString()
      });
      count++;
    }
    tabSummary[stocklistTab.name] = count;
    logger.info(`Extracted ${count} signals from "${stocklistTab.name}" tab.`);
  } catch (err) {
    logger.error(`Error processing Stock list tab: ${err.message}`);
    tabSummary[stocklistTab.name] = 0;
  }

  logger.info(`Total stock signals extracted across Google Sheet tabs: ${allExtractedSignals.length}`);

  // Detect genuinely new or modified Sheet entries BEFORE overwriting memoryDB.signals
  const waStates = getWhatsAppStockStates();
  const changedEntries = [];
  for (const sig of allExtractedSignals) {
    const existing = memoryDB.signals ? memoryDB.signals[sig.id] : null;
    const isNew = !existing;
    const isModified = Boolean(existing && existing.lastSheetHash && existing.lastSheetHash !== sig.lastSheetHash);
    if (isNew || isModified) {
      const waExpired = waStates.get(sig.symbol.toUpperCase())?.isExpired;
      if (!waExpired) {
        changedEntries.push({
          sig,
          changeType: isNew ? 'NEW_ROW' : 'UPDATED_ROW',
          prevBuy: existing?.entryMax || existing?.entryPrice || null
        });
      }
    }
  }

  // 3. Resolve/enrich active signals with Live CMP in bounded batches of 5 (auto-resolves any changed NSE tickers via web)
  const enrichedSignals = [];
  const BATCH_SIZE = 5;
  for (let i = 0; i < allExtractedSignals.length; i += BATCH_SIZE) {
    const chunk = allExtractedSignals.slice(i, i + BATCH_SIZE);
    const resolvedChunk = await Promise.all(
      chunk.map(async (sig) => {
        try {
          return await resolveSignalTickerAndQuote(sig);
        } catch (e) {
          return sig;
        }
      })
    );
    enrichedSignals.push(...resolvedChunk);
  }

  // 4. Save to Multi-DB layer (Firebase + Local JSON fallback)
  await saveSignals(enrichedSignals);
  logger.info(`Saved ${enrichedSignals.length} Google Sheet signals to Multi-DB.`);

  // 4b. Persist Sheet change notifications & send consolidated Telegram note when rows genuinely change
  if (changedEntries.length > 0) {
    logger.info(`Detected ${changedEntries.length} new/updated Google Sheet row(s). Recording notifications...`);
    const freshSignalsById = new Map(enrichedSignals.map(s => [s.id, s]));
    const notifyLines = [];

    for (const item of changedEntries) {
      const fresh = freshSignalsById.get(item.sig.id) || item.sig;
      const cooldownKey = `GS_ROW_${fresh.id}_${fresh.lastSheetHash}`;
      if (isAlertOnCooldown(cooldownKey, 6 * 60 * 60 * 1000)) continue;

      const label = item.changeType === 'NEW_ROW' ? 'New Google Sheet Addition' : 'Google Sheet Updated';
      const priceStr = fresh.entryMax || fresh.entryPrice ? `Buy upto ₹${fresh.entryMax || fresh.entryPrice}` : '';
      const msg = `${label} (${fresh.sheetTab} #${fresh.sheetRow}): ${fresh.symbol} ${priceStr}${fresh.currentCMP ? ` | CMP ₹${fresh.currentCMP}` : ''}`.trim();

      await saveNotification({
        id: `NOTIF_GS_${fresh.id}_${fresh.lastSheetHash}`,
        signalId: fresh.id,
        symbol: fresh.symbol,
        companyName: fresh.companyName || fresh.symbol,
        type: item.changeType === 'NEW_ROW' ? 'SHEET_NEW_ENTRY' : 'SHEET_UPDATE',
        action: fresh.action || 'BUY',
        status: fresh.status || 'ACTIVE',
        currentCMP: fresh.currentCMP || null,
        entryMax: fresh.entryMax || fresh.entryPrice || null,
        source: fresh.source,
        rawHeader: fresh.rawHeader,
        rawText: fresh.rawText,
        sheetUrl: fresh.sheetUrl,
        message: msg,
        timestamp: new Date().toISOString()
      });
      recordAlertSent(cooldownKey);
      notifyLines.push(`• *${fresh.symbol}* (${fresh.sheetTab} row ${fresh.sheetRow}): ${priceStr || 'Updated'}${fresh.currentCMP ? ` | CMP ₹${fresh.currentCMP}` : ''}`);
    }

    if (notifyLines.length > 0) {
      try {
        const dest = resolveDestination('stocks', { signal: { action: 'BUY' } });
        if (dest?.chatId) {
          const summaryMsg =
            `📊 *Google Sheet Update Detected (${notifyLines.length})*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            notifyLines.slice(0, 12).join('\n') +
            `\n_Synced via Chrome 9223 • Watchlist & Stock list_`;
          sendRawTelegramMessage(dest.chatId, summaryMsg, { message_thread_id: dest.message_thread_id }).catch(() => {});
        }
      } catch (_) {}
    }
  }

  // 5. Evaluate and dispatch noise-free grouped alerts to Telegram topics
  evaluateAndDispatchBatch(enrichedSignals, 'stocks').catch(e => {
    logger.debug('Batch alert dispatch note:', { error: e.message });
  });

  // 6. Regenerate ranked Best Insights across all recommendation engines
  const updatedInsights = await generateBestInsights();

  return {
    success: true,
    sheetTitle: pageTitle,
    tabsProcessed: tabSummary,
    snapshotsCaptured: Object.keys(snapshots),
    sheetChangesDetected: changedEntries.length,
    totalSignalsFound: enrichedSignals.length,
    insightsGenerated: updatedInsights.length,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  extractGoogleSheetSignals
};
