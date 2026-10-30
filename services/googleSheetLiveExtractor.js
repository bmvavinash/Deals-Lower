const puppeteer = require('puppeteer');
const https = require('https');
const { getModuleLogger } = require('../logger/logger');
const { saveSignals } = require('../database/stocksMultiDB');
const { getLiveQuote, evaluateSignalWithCMP } = require('./marketQuoteService');
const { generateBestInsights } = require('./stockInsightsAggregator');
const { checkAndTriggerSignalNotification, evaluateAndDispatchBatch } = require('./stockAlertNotificationService');

const logger = getModuleLogger('googleSheetLiveExtractor');

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
 * Extract stock signals from Google Sheet open in Chrome (default port 9223)
 */
async function extractGoogleSheetSignals(options = {}) {
  const port = options.port || parseInt(process.env.STOCKS_CHROME_PORT || '9223', 10);
  logger.info(`Connecting to Chrome port ${port} for Google Sheet extraction...`);

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  } catch (err) {
    throw new Error(`Could not connect to Chrome on port ${port}. Ensure Chrome 9223 is running with remote debugging.`);
  }

  const pages = await browser.pages();
  const sheetPage = pages.find(p => p.url().includes('docs.google.com/spreadsheets'));
  if (!sheetPage) {
    throw new Error('No Google Sheet tab is currently open in Chrome. Please open the Google Sheet first.');
  }

  const pageTitle = await sheetPage.title();
  const currentUrl = sheetPage.url();
  logger.info(`Found open Google Sheet: "${pageTitle}" (${currentUrl})`);

  // Extract session cookies for authenticated CSV export
  const cookies = await sheetPage.cookies();
  if (!cookies || cookies.length === 0) {
    throw new Error('No session cookies found for Google Sheet page.');
  }
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Extract Spreadsheet ID from URL
  const idMatch = currentUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : '1fCXMjJSxZp8chU8q2vy94AQCEBRKtCvxo2dwJ_L6_RM';

  // Discover all sheets/tabs metadata from page HTML
  const html = await sheetPage.content();
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
    'Watchlist': '1944936862',
    'Stock list': '686195741',
    'Feb 16 2025': '1253291650',
    'Results Q2 2024': '1047831251',
    'Scripts dump': '1581395411'
  };

  const finalTabs = tabs.length > 0 ? tabs : Object.entries(knownGids).map(([name, gid], idx) => ({ index: idx, gid, name }));
  logger.info(`Discovered ${finalTabs.length} tabs in sheet.`);

  const allExtractedSignals = [];
  const tabSummary = {};

  // 1. Process "Watchlist" Tab
  const watchlistTab = finalTabs.find(t => t.name.toLowerCase().includes('watchlist')) || { gid: '1944936862', name: 'Watchlist' };
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${watchlistTab.gid}`;
    const csv = await fetchWithCookie(csvUrl, cookieHeader);
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

    let count = 0;
    // Header is row 4, data begins at row 5
    for (let i = 5; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const stockName = cols[1];
      const ticker = cols[3]?.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!ticker || ticker === 'NA' || ticker === 'N/A' || ticker.length < 2) continue;

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

      allExtractedSignals.push({
        id: `GS_WATCHLIST_${ticker}_${Date.now()}_${count}`,
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
        sourcePriority: 2,
        isSourceOfTruth: false,
        rawText: `Stock: ${stockName} (${ticker}) | Buy Range: ${rawBuy} | Conviction: ${conviction} | Horizon: ${horizon}`,
        confidence: 0.95,
        timestamp: new Date().toISOString()
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
  const stocklistTab = finalTabs.find(t => t.name.toLowerCase().includes('stock list')) || { gid: '686195741', name: 'Stock list' };
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${stocklistTab.gid}`;
    const csv = await fetchWithCookie(csvUrl, cookieHeader);
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

    let count = 0;
    // Header is row 4, data begins at row 5
    for (let i = 5; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const ticker = cols[1]?.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!ticker || ticker.length < 2) continue;

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

      allExtractedSignals.push({
        id: `GS_STOCKLIST_${ticker}_${Date.now()}_${count}`,
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
        sourcePriority: 2,
        isSourceOfTruth: false,
        rawText: `Stock: ${ticker} | Star: ${star} | Buy range: ${buyRange} | Horizon: ${horizon} | Comments: ${comments || ''}`,
        confidence: 0.95,
        timestamp: new Date().toISOString()
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

  // 3. Enrich top active signals with Live CMP from NSE/Yahoo Finance
  const enrichedSignals = [];
  for (const sig of allExtractedSignals) {
    try {
      const quote = await getLiveQuote(sig.symbol);
      const evaluated = evaluateSignalWithCMP(sig, quote) || sig;
      enrichedSignals.push(evaluated);
    } catch (e) {
      enrichedSignals.push(sig);
    }
  }

  // 4. Save to Multi-DB layer (Firebase + Local JSON fallback)
  await saveSignals(enrichedSignals);
  logger.info(`Saved ${enrichedSignals.length} Google Sheet signals to Multi-DB.`);

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
    totalSignalsFound: enrichedSignals.length,
    insightsGenerated: updatedInsights.length,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  extractGoogleSheetSignals
};
