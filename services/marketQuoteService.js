const https = require('https');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('marketQuoteService');

// In-memory quote cache (TTL: 30 seconds)
const quoteCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

// Common company name / alias to NSE ticker symbol mapping
const COMPANY_TICKER_MAP = {
  // From user's current WhatsApp messages
  'samhi': 'SAMHI',
  'samhi hotels': 'SAMHI',
  'nuvama': 'NUVAMA',
  'nuvama wealth': 'NUVAMA',
  'td power': 'TDPOWERSYS',
  'td power systems': 'TDPOWERSYS',
  'tdpowersys': 'TDPOWERSYS',
  'hind zinc': 'HINDZINC',
  'hindustan zinc': 'HINDZINC',
  'neuland labs': 'NEULANDLAB',
  'neuland laboratories': 'NEULANDLAB',
  'neulandlab': 'NEULANDLAB',
  'llyods metal': 'LLOYDSME',
  'llyods metal and energy': 'LLOYDSME',
  'llyods metal and energy limited': 'LLOYDSME',
  'lloyds metals': 'LLOYDSME',
  'snasera engineering': 'SANSERA',
  'sansera': 'SANSERA',
  'sansera engineering': 'SANSERA',
  'welspun corp': 'WELCORP',
  'welspun': 'WELCORP',
  'welcorp': 'WELCORP',

  // Watchlist & SOIC Research stocks
  'ge vernova': 'GVT&D',
  'ge vernova td': 'GVT&D',
  'ge vernova td india': 'GVT&D',
  'ge vernova td india limited': 'GVT&D',
  'ge td': 'GVT&D',
  'ge td india': 'GVT&D',
  'gvtd': 'GVT&D',
  'redington': 'REDINGTON',
  'redington india': 'REDINGTON',
  'redington india limited': 'REDINGTON',
  'redington limited': 'REDINGTON',
  'aarti pharma': 'AARTIPHARM',
  'aarti pharmalabs': 'AARTIPHARM',
  'aarti pharmalabs limited': 'AARTIPHARM',
  'acutaas': 'ACUTAAS',
  'acutaas chemicals': 'ACUTAAS',
  'acutaas chemicals limited': 'ACUTAAS',
  'ellanbarrie': 'ELLANBARRIE',
  'ellanbarrie indust': 'ELLANBARRIE',
  'ellanbarrie industrial': 'ELLANBARRIE',
  'divi laboratory': 'DIVISLAB',
  'divislab': 'DIVISLAB',
  'divis laboratories': 'DIVISLAB',
  'divis labs': 'DIVISLAB',
  'astra micro': 'ASTRAMICRO',
  'astra microwave': 'ASTRAMICRO',
  'arman financial': 'ARMANFIN',
  'csb bank': 'CSBBANK',
  'e2e networks': 'E2E',
  'entero healthcare': 'ENTERO',
  'gala precision': 'GALAPREC',
  'gravita': 'GRAVITA',
  'gravita india': 'GRAVITA',
  'garware hi-tech': 'GRWRHITECH',
  'garware hitech': 'GRWRHITECH',
  'hbl power': 'HBLENGINE',
  'hbl engineering': 'HBLENGINE',
  'imfa': 'IMFA',
  'intellect design': 'INTELLECT',
  'interarch': 'INTERARCH',
  'interarch building': 'INTERARCH',
  'jash': 'JASH',
  'jash engineering': 'JASH',
  'jayaswal neco': 'JAYNECOIND',
  'kddl': 'KDDL',
  'knowledge marine': 'KMEW',
  'ksh international': 'KSHINTL',
  'kusumgar': 'KUSUMGAR',
  'lumax auto': 'LUMAXTECH',
  'lumax autotechnologies': 'LUMAXTECH',
  'manorama': 'MANORAMA',
  'manorama industries': 'MANORAMA',
  'mcx': 'MCX',
  'navin fluorine': 'NAVINFLUOR',
  'nrb bearings': 'NRBBEARING',
  'paytm': 'PAYTM',
  'privi speciality': 'PRIVISCL',
  'physicswallah': 'PWL',
  'ramkrishna forgings': 'RKFORGE',
  'sai life': 'SAILIFE',
  'sai life sciences': 'SAILIFE',
  'saregama': 'SAREGAMA',
  'shivalik bimetal': 'SBCL',
  'shilpa medicare': 'SHILPAMED',
  'steelcast': 'STEELCAS',
  'sterlite tech': 'STLTECH',
  'supriya lifesc': 'SUPRIYA',
  'supriya lifesc limited': 'SUPRIYA',
  'thyrocare': 'THYROCARE',
  'venus pipes': 'VENUSPIPES',
  'viyash': 'VIYASH',
  'windlas': 'WINDLAS',
  'windlas biotech': 'WINDLAS',
  
  // High volume stocks & bluechips
  'reliance': 'RELIANCE',
  'tcs': 'TCS',
  'infosys': 'INFY',
  'infy': 'INFY',
  'hdfc bank': 'HDFCBANK',
  'hdfc': 'HDFCBANK',
  'icici bank': 'ICICIBANK',
  'icici': 'ICICIBANK',
  'sbi': 'SBIN',
  'sbin': 'SBIN',
  'tata motors': 'TATAMOTORS',
  'tatamotors': 'TATAMOTORS',
  'tata steel': 'TATASTEEL',
  'tatasteel': 'TATASTEEL',
  'itc': 'ITC',
  'bharti airtel': 'BHARTIARTL',
  'airtel': 'BHARTIARTL',
  'l&t': 'LT',
  'larsen': 'LT',
  'polycab': 'POLYCAB',
  'zomato': 'ZOMATO',
  'swiggy': 'SWIGGY',
  'bhel': 'BHEL',
  'bel': 'BEL',
  'hal': 'HAL',
  'suzlon': 'SUZLON',
  'ircon': 'IRCON',
  'irfc': 'IRFC',
  'rvnl': 'RVNL'
};

const webSymbolCache = new Map();
const WEB_CACHE_HIT_MS = 24 * 60 * 60 * 1000;
const WEB_CACHE_MISS_MS = 30 * 60 * 1000;

const NON_STOCK_CANDIDATES = new Set([
  'fast', 'now', 'max', 'qty', 'quantity', 'max qty', 'max quantity',
  'loot', 'deal', 'deals', 'gifting', 'diwali', 'buy', 'sell', 'exit',
  'hold', 'wait', 'alert', 'note', 'update', 'market', 'stock', 'share'
]);

/**
 * Shared lightweight HTTPS JSON getter with timeout and headers.
 */
function httpGetJson(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) return resolve(null);
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function cleanCompanyKey(rawName) {
  return (rawName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function hasTokenOverlap(queryName, targetName) {
  const stopWords = new Set(['ltd', 'limited', 'india', 'ind', 'corp', 'inc', 'co', 'company', 'and', 'the', 'of']);
  const qTokens = cleanCompanyKey(queryName).split(' ').filter(t => t.length >= 2 && !stopWords.has(t));
  const tKey = cleanCompanyKey(targetName);
  const tCompact = tKey.replace(/\s+/g, '');
  if (qTokens.length === 0) return false;
  return qTokens.some(tok => tKey.includes(tok) || tCompact.includes(tok));
}

/**
 * Normalizes user/advisor company text to standard NSE symbol.
 * Returns { symbol, isMapped, note }
 */
function normalizeSymbol(rawName) {
  if (!rawName) return { symbol: null, isMapped: false };
  const cleaned = cleanCompanyKey(rawName);
  if (!cleaned || cleaned.length < 2) {
    return { symbol: null, isMapped: false };
  }

  if (COMPANY_TICKER_MAP[cleaned]) {
    return { symbol: COMPANY_TICKER_MAP[cleaned], isMapped: true };
  }

  // Check partial matches in dictionary (guarded against short/empty noise)
  for (const [key, sym] of Object.entries(COMPANY_TICKER_MAP)) {
    if (cleaned.includes(key) || (cleaned.length >= 4 && key.includes(cleaned))) {
      return { symbol: sym, isMapped: true, matchedAlias: key };
    }
  }

  // If already looks like an NSE ticker (preserve & and - for tickers like GVT&D, M&M, BAJAJ-AUTO)
  const uppercaseCandidate = rawName.trim().toUpperCase().replace(/[^A-Z0-9&-]/g, '');
  if (uppercaseCandidate.length >= 2 && uppercaseCandidate.length <= 15) {
    return { symbol: uppercaseCandidate, isMapped: false, candidate: true };
  }

  return { symbol: uppercaseCandidate, isMapped: false };
}

/**
 * Fetch live market quote for a stock from Yahoo Finance
 * @param {string} symbol - NSE Symbol without suffix, e.g. "TATAMOTORS" or "GVT&D"
 * @param {string} [exchange='NS'] - 'NS' for NSE, 'BO' for BSE
 */
async function getLiveQuote(symbol, exchange = 'NS', forceRefresh = false) {
  if (!symbol) return null;
  const normalized = symbol.toUpperCase().replace(/\.NS$|\.BO$/, '');
  const yahooTicker = `${normalized}.${exchange}`;

  // Check cache unless forceRefresh
  if (!forceRefresh) {
    const cached = quoteCache.get(yahooTicker);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=1d`;
  const json = await httpGetJson(url, 5000);
  if (json?.chart?.result?.[0]?.meta) {
    const meta = json.chart.result[0].meta;
    const ltp = meta.regularMarketPrice;
    if (typeof ltp === 'number' && !isNaN(ltp)) {
      const prevClose = meta.chartPreviousClose || meta.previousClose || ltp;
      const dayChange = ltp - prevClose;
      const dayChangePercent = prevClose > 0 ? (dayChange / prevClose) * 100 : 0;

      const quoteData = {
        symbol: normalized,
        ticker: yahooTicker,
        exchange: exchange === 'NS' ? 'NSE' : 'BSE',
        ltp: Number(ltp.toFixed(2)),
        prevClose: Number(prevClose.toFixed(2)),
        dayChange: Number(dayChange.toFixed(2)),
        dayChangePercent: Number(dayChangePercent.toFixed(2)),
        dayHigh: meta.regularMarketDayHigh || null,
        dayLow: meta.regularMarketDayLow || null,
        currency: meta.currency || 'INR',
        updatedAt: new Date().toISOString()
      };

      quoteCache.set(yahooTicker, { timestamp: Date.now(), data: quoteData });
      return quoteData;
    }
  }

  // If NSE ticker fails, try BSE fallback once
  if (exchange === 'NS') {
    return getLiveQuote(normalized, 'BO', forceRefresh);
  }
  return null;
}

/**
 * Primary trusted web search: Yahoo Finance NSI/BSE equity autocomplete.
 */
async function resolveViaYahooSearch(rawName) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(rawName)}&quotesCount=8&newsCount=0&enableFuzzyQuery=true`;
  const data = await httpGetJson(url, 5000);
  const quotes = Array.isArray(data?.quotes) ? data.quotes : [];

  const indianEquities = quotes.filter(q =>
    q.quoteType === 'EQUITY' &&
    q.symbol &&
    (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO') || q.exchange === 'NSI' || q.exchange === 'BSE' || q.exchange === 'BOM')
  );

  // Prefer NSE (.NS) matches that share tokens with query
  indianEquities.sort((a, b) => (b.symbol.endsWith('.NS') ? 1 : 0) - (a.symbol.endsWith('.NS') ? 1 : 0));

  for (const q of indianEquities) {
    const baseSym = q.symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
    const displayName = `${q.longname || ''} ${q.shortname || ''} ${baseSym}`;
    if (hasTokenOverlap(rawName, displayName)) {
      return {
        symbol: baseSym,
        exchange: q.symbol.endsWith('.BO') ? 'BO' : 'NS',
        companyName: q.longname || q.shortname || rawName,
        source: 'yahoo_search'
      };
    }
  }
  return null;
}

/**
 * Secondary trusted web search: Screener.in Indian equity company search API.
 */
async function resolveViaScreenerSearch(rawName) {
  const url = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(rawName)}`;
  const items = await httpGetJson(url, 5000);
  if (!Array.isArray(items)) return null;

  for (const item of items) {
    const match = (item.url || '').match(/\/company\/([^/]+)\//);
    if (!match || !item.name) continue;
    const candidateSym = decodeURIComponent(match[1]).toUpperCase();
    // Skip purely numeric BSE-only codes unless verified; prefer NSE alphanumeric symbols
    if (/^\d+$/.test(candidateSym)) continue;
    if (hasTokenOverlap(rawName, `${item.name} ${candidateSym}`)) {
      return {
        symbol: candidateSym,
        exchange: 'NS',
        companyName: item.name,
        source: 'screener_search'
      };
    }
  }
  return null;
}

/**
 * Resolve an unknown/unmapped stock company name to a verified live NSE/BSE ticker
 * using trusted web sources (Yahoo Finance Search + Screener.in) + live quote check.
 */
async function resolveTickerFromWeb(rawName) {
  const cleaned = cleanCompanyKey(rawName);
  if (!cleaned || cleaned.length < 2 || NON_STOCK_CANDIDATES.has(cleaned)) {
    return null;
  }

  const local = normalizeSymbol(rawName);
  if (local.isMapped && local.symbol) {
    const quote = await getLiveQuote(local.symbol);
    return {
      symbol: local.symbol,
      companyName: rawName,
      exchange: quote?.exchange || 'NSE',
      quote,
      source: 'local_map'
    };
  }

  const cached = webSymbolCache.get(cleaned);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  let match = await resolveViaYahooSearch(rawName);
  if (!match) {
    match = await resolveViaScreenerSearch(rawName);
  }

  // Last check: if candidate itself is an exact live NSE symbol, verify with Yahoo quote
  if (!match && local.candidate && local.symbol) {
    const directQuote = await getLiveQuote(local.symbol);
    if (directQuote?.ltp > 0) {
      match = {
        symbol: directQuote.symbol,
        exchange: directQuote.exchange === 'BSE' ? 'BO' : 'NS',
        companyName: rawName,
        source: 'yahoo_direct_quote',
        quote: directQuote
      };
    }
  }

  if (match && match.symbol) {
    const quote = match.quote || await getLiveQuote(match.symbol, match.exchange || 'NS');
    if (quote && quote.ltp > 0) {
      const result = {
        symbol: match.symbol,
        companyName: match.companyName || rawName,
        exchange: quote.exchange || 'NSE',
        quote,
        source: match.source
      };
      COMPANY_TICKER_MAP[cleaned] = match.symbol;
      webSymbolCache.set(cleaned, { value: result, expiresAt: Date.now() + WEB_CACHE_HIT_MS });
      logger.info(`🌐 Auto-resolved "${rawName}" ➔ ${result.symbol} (₹${quote.ltp}) via ${result.source}`);
      return result;
    }
  }

  webSymbolCache.set(cleaned, { value: null, expiresAt: Date.now() + WEB_CACHE_MISS_MS });
  return null;
}

/**
 * Shared helper for all ingestion paths: auto-resolves unmapped/unquoted ticker from web,
 * clears clarification flags once confirmed, and evaluates signal against live CMP.
 */
async function resolveSignalTickerAndQuote(signal) {
  if (!signal) return signal;
  let working = { ...signal };
  let quote = null;

  if (working.requiresClarification || !working.symbol) {
    const webResolved = await resolveTickerFromWeb(working.companyName || working.symbol);
    if (webResolved) {
      working.symbol = webResolved.symbol;
      working.requiresClarification = false;
      working.clarificationReason = null;
      working.tickerResolvedVia = webResolved.source;
      quote = webResolved.quote;
    }
  }

  if (!quote && working.symbol) {
    quote = await getLiveQuote(working.symbol);
    // If guessed symbol failed to return a quote (e.g. GEVERNOVATD), try web resolution
    if (!quote && working.companyName) {
      const webResolved = await resolveTickerFromWeb(working.companyName);
      if (webResolved) {
        working.symbol = webResolved.symbol;
        working.requiresClarification = false;
        working.clarificationReason = null;
        working.tickerResolvedVia = webResolved.source;
        quote = webResolved.quote;
      }
    }
  }

  return evaluateSignalWithCMP(working, quote) || working;
}

/**
 * Compare an advisory signal with the current market price (CMP)
 */
function evaluateSignalWithCMP(signal, quote) {
  if (!signal) return null;
  const ltp = quote ? quote.ltp : null;

  let status = 'ACTIVE';
  let statusReason = 'Signal active';
  let pnlPercent = 0;
  let target1Distance = null;
  let stopLossDistance = null;

  const action = (signal.action || 'BUY').toUpperCase();
  const entry = Number(signal.entryPrice || signal.entryMax || signal.entryMin || signal.cmpAtCall);
  const target1 = Number(signal.target1 || (signal.targets && signal.targets[0]));
  const target2 = Number(signal.target2 || (signal.targets && signal.targets[1]));
  const stopLoss = Number(signal.stopLoss);

  if (ltp && entry) {
    if (signal.isExpired || signal.status === 'EXPIRED') {
      pnlPercent = Number((((ltp - entry) / entry) * 100).toFixed(2));
      status = 'EXPIRED';
      statusReason = signal.statusReason || `Buy expired: WhatsApp exit call issued`;
    } else if (action === 'BUY') {
      pnlPercent = Number((((ltp - entry) / entry) * 100).toFixed(2));
      
      // Target hit check
      if (target2 && ltp >= target2) {
        status = 'TGT2_HIT';
        statusReason = `Target 2 (₹${target2}) achieved! (+${pnlPercent}%)`;
      } else if (target1 && ltp >= target1) {
        status = 'TGT1_HIT';
        statusReason = `Target 1 (₹${target1}) achieved! (+${pnlPercent}%)`;
      } else if (stopLoss && ltp <= stopLoss) {
        status = 'SL_HIT';
        statusReason = `Stop loss (₹${stopLoss}) triggered (${pnlPercent}%)`;
      } else if (signal.entryMax && ltp <= signal.entryMax) {
        status = 'IN_BUY_RANGE';
        statusReason = `Currently in buy range (CMP ₹${ltp} <= ₹${signal.entryMax})`;
      } else if (signal.entryMax && ltp > signal.entryMax) {
        status = 'ABOVE_ENTRY';
        statusReason = `Above recommended buy ceiling (CMP ₹${ltp} > ₹${signal.entryMax})`;
      }
    } else if (action === 'SELL' || action === 'EXIT') {
      const exitThreshold = Number(signal.entryMin || signal.entryPrice || signal.target1);
      if (exitThreshold && ltp >= exitThreshold) {
        status = 'TRIGGERED';
        statusReason = `Exit condition met: CMP ₹${ltp} is above ₹${exitThreshold}`;
      } else {
        status = 'MONITORING';
        statusReason = `Waiting for CMP ₹${ltp} to reach exit level ₹${exitThreshold}`;
      }
    }

    if (target1) {
      target1Distance = Number((((target1 - ltp) / ltp) * 100).toFixed(2));
    }
    if (stopLoss) {
      stopLossDistance = Number((((ltp - stopLoss) / ltp) * 100).toFixed(2));
    }
  }

  // Calculate Risk to Reward ratio
  let riskRewardRatio = null;
  if (entry && target1 && stopLoss && (entry - stopLoss) > 0) {
    const risk = entry - stopLoss;
    const reward = target1 - entry;
    riskRewardRatio = Number((reward / risk).toFixed(2));
  }

  return {
    ...signal,
    currentCMP: ltp,
    cmpUpdatedAt: quote?.updatedAt || null,
    dayChangePercent: quote?.dayChangePercent || null,
    status,
    statusReason,
    pnlPercent,
    target1Distance,
    stopLossDistance,
    riskRewardRatio
  };
}

function clearQuoteCache() {
  quoteCache.clear();
}

module.exports = {
  normalizeSymbol,
  getLiveQuote,
  evaluateSignalWithCMP,
  resolveTickerFromWeb,
  resolveSignalTickerAndQuote,
  clearQuoteCache,
  COMPANY_TICKER_MAP
};
