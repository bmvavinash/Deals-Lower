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

/**
 * Normalizes user/advisor company text to standard NSE symbol.
 * Returns { symbol, isMapped, note }
 */
function normalizeSymbol(rawName) {
  if (!rawName) return { symbol: null, isMapped: false };
  const cleaned = rawName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  
  if (COMPANY_TICKER_MAP[cleaned]) {
    return { symbol: COMPANY_TICKER_MAP[cleaned], isMapped: true };
  }

  // Check partial matches in dictionary
  for (const [key, sym] of Object.entries(COMPANY_TICKER_MAP)) {
    if (cleaned.includes(key) || key.includes(cleaned)) {
      return { symbol: sym, isMapped: true, matchedAlias: key };
    }
  }

  // If already looks like an uppercase NSE ticker (e.g. INFY, TATAMOTORS, HDFCBANK)
  const uppercaseCandidate = rawName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (uppercaseCandidate.length >= 2 && uppercaseCandidate.length <= 15) {
    return { symbol: uppercaseCandidate, isMapped: false, candidate: true };
  }

  return { symbol: uppercaseCandidate, isMapped: false };
}

/**
 * Fetch live market quote for a stock from Yahoo Finance
 * @param {string} symbol - NSE Symbol without suffix, e.g. "TATAMOTORS"
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

  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 5000
    };

    const req = https.get(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.chart?.result?.[0]?.meta) {
            const meta = json.chart.result[0].meta;
            const ltp = meta.regularMarketPrice;
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
            return resolve(quoteData);
          }
          // If NSE ticker fails, try BSE fallback once
          if (exchange === 'NS') {
            return resolve(getLiveQuote(normalized, 'BO'));
          }
          resolve(null);
        } catch (e) {
          logger.warn(`Failed to parse Yahoo Finance quote for ${yahooTicker}: ${e.message}`);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      logger.warn(`Network error fetching quote for ${yahooTicker}: ${err.message}`);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
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
  clearQuoteCache,
  COMPANY_TICKER_MAP
};
