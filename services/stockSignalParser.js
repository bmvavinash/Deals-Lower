const { normalizeSymbol, COMPANY_TICKER_MAP } = require('./marketQuoteService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('stockSignalParser');

// Noise patterns for individual lines that are administrative, greeting, or conversational chatter
const NOISE_LINE_PATTERNS = [
  /^good\s*(morning|afternoon|evening|day)\b/i,
  /^hello\b/i,
  /^hi\b(\s+(all|team|everyone|guys))?[\s!.]*$/i,
  /^hey\b/i,
  /^thank(s|\s+you)\b/i,
  /subscription\s+(ends|renewal|charge|fee)/i,
  /offering\s+to\s+extend/i,
  /\bwebinar\b/i,
  /\bmasterclass\b/i,
  /\bworkshop\b/i,
  /\bregister\s+now\b/i,
  /zoom\.us/i,
  /youtube\.com|youtu\.be/i,
  /instagram\.com/i,
  /amzn\.in|amazon\.in/i,
  /fkrt\.co|flipkart\.com/i,
  /reserve\s+bank\s+of\s+india/i,
  /నామినేషన్/i,
  /^replied\s+to/i,
  /^welcome\s+to/i,
  /disclaimer\s*:/i,
  /educational\s+purposes?\s+only/i,
  /^please\s+(note|maintain|check|follow|dm|reach\s+out|clarify)/i,
  /\b(tonight\s+at|tomorrow\s+at)\b/i,
  /\bloot\b/i,
  /\bdeal(s)?\b/i,
  /\bcoupon(s)?\b/i,
  /\bdiscount(s)?\b/i,
  /\bfree\s+delivery\b/i,
  /\bgifting\b/i,
  /\bdry\s+fruits?\b/i,
  /\bkitchen\b/i,
  /\bpack\s+of\b/i,
  /\bmax\s+qty\b/i,
  /\bmax\s+quantity\b/i,
  /\bbuy\s+(?:fast|now)\b/i,
  /\blowest\s+price\b/i,
  /https?:\/\//i
];

const NON_TICKER_BLACKLIST = new Set([
  'FAST', 'NOW', 'MAX', 'QUANTITY', 'MAXQUANTITY', 'MAXQTY', 'LOOT', 'DEAL', 'DEALS',
  'GIFTING', 'DIWALI', 'PACK', 'BUY', 'SELL', 'CALL', 'STOCK', 'SHARE', 'MARKET',
  'INDEX', 'ALERT', 'NOTE', 'UPDATE', 'CHECK', 'WAIT', 'HOLD', 'EXIT', 'ENTRY',
  'ZONE', 'RANGE', 'CHART', 'GRAPH', 'TODAY', 'SOON', 'HERE', 'FREE', 'BEST'
]);

/**
 * Check if a specific single line is noise / conversational filler
 */
function isNoiseLine(line) {
  if (!line || line.trim().length === 0) return true;
  const trimmed = line.trim();

  // If the line is a known stock or alias, it's NEVER noise!
  const cleaned = trimmed.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  if (COMPANY_TICKER_MAP[cleaned]) {
    return false;
  }

  for (const pattern of NOISE_LINE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function generateSignalId(symbol, action, price, dateStr) {
  const safeDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '');
  const cleanPrice = String(price || '0').replace(/[^0-9]/g, '');
  return `${(symbol || 'UNKNOWN').toUpperCase()}_${(action || 'CALL').toUpperCase()}_${cleanPrice}_${safeDate}`;
}

function parsePrice(str) {
  if (!str) return null;
  const num = parseFloat(str.replace(/,/g, '').replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * State-machine sequential parser: handles multi-line, multi-stock messages
 * where irrelevant chatter and valid stock signals may coexist in the same message.
 */
function parseStockMessage(rawText, meta = {}) {
  if (!rawText || rawText.trim().length < 4) {
    return {
      isTradeSignal: false,
      reason: 'Message too short or empty',
      signals: [],
      rawText,
      meta
    };
  }

  const cleanText = rawText.trim();
  const allLines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (allLines.length === 0) {
    return { isTradeSignal: false, signals: [], rawText, meta };
  }

  const signals = [];
  let defaultAction = null;

  let currentItem = {
    companyName: null,
    action: null,
    price: null,
    rating: null,
    rawLines: []
  };

  function flushCurrentItem() {
    if (currentItem.companyName && (currentItem.price || currentItem.action || defaultAction)) {
      const normalized = normalizeSymbol(currentItem.companyName);
      const symbol = (normalized.symbol || currentItem.companyName.toUpperCase().replace(/[^A-Z0-9]/g, '')).trim();
      
      // Reject non-ticker words or deals chatter
      if (!symbol || symbol.length < 2 || symbol.length > 15 || NON_TICKER_BLACKLIST.has(symbol) || symbol.includes('WHEREWEEXPECT') || symbol.includes('MAXQTY')) {
        logger.debug(`Rejected non-ticker candidate: "${symbol}"`);
        currentItem = { companyName: null, action: null, price: null, rating: null, target: null, stopLoss: null, horizon: null, rawLines: [] };
        return;
      }

      const action = currentItem.action || defaultAction || 'WATCH';
      const price = currentItem.price;

      signals.push({
        id: generateSignalId(symbol, action, price, meta.timestamp),
        companyName: currentItem.companyName,
        symbol: symbol,
        exchange: 'NSE',
        action,
        callType: currentItem.horizon ? currentItem.horizon.toUpperCase() : 'SWING',
        entryPrice: price,
        entryMin: action === 'BUY' ? null : price,
        entryMax: action === 'BUY' ? price : null,
        target1: currentItem.target || (action === 'SELL' ? price : null),
        stopLoss: currentItem.stopLoss || null,
        rating: currentItem.rating,
        requiresClarification: !normalized.isMapped,
        clarificationReason: !normalized.isMapped ? `Unconfirmed ticker mapping for "${currentItem.companyName}"` : null,
        source: meta.source || 'WhatsApp',
        sender: meta.sender || 'Unknown',
        timestamp: meta.timestamp || new Date().toISOString(),
        rawText: currentItem.rawLines.join('\n'),
        confidence: normalized.isMapped ? 0.95 : 0.70
      });
    }

    currentItem = {
      companyName: null,
      action: null,
      price: null,
      rating: null,
      target: null,
      stopLoss: null,
      horizon: null,
      rawLines: []
    };
  }

  // Pre-clean: strip markdown decorators for robust line matching
  for (let i = 0; i < allLines.length; i++) {
    const rawLine = allLines[i];
    const line = rawLine.replace(/[*_~`]/g, '').trim();

    // 1. Directives: update defaultAction
    if (/^stocks?\s+to\s+sell:?$/i.test(line)) {
      defaultAction = 'SELL';
      continue;
    }
    if (/^new\s+stocks?:?$/i.test(line)) {
      defaultAction = 'BUY';
      continue;
    }
    if (/^partial\s+exit:?$/i.test(line)) {
      if (currentItem.companyName && (currentItem.price || currentItem.action)) flushCurrentItem();
      currentItem.action = 'PARTIAL_EXIT';
      currentItem.rawLines.push(rawLine);
      continue;
    }
    if (/^complete\s+exit:?$/i.test(line)) {
      if (currentItem.companyName && (currentItem.price || currentItem.action)) flushCurrentItem();
      currentItem.action = 'COMPLETE_EXIT';
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 2. Discard individual noise lines (conversational chatter, subscription talk, ads, webinar invites)
    if (isNoiseLine(line)) {
      logger.debug(`Filtered noise line: "${line}"`);
      continue;
    }

    // 2b. Labelled Stock/Company name (e.g. "Stock: Archean Chemical (ARCHEAN)" or "Company: Tata Motors")
    const stockLabelMatch = line.match(/^(?:STOCK|COMPANY|SYMBOL|SCRIP|NAME)\s*[:\-]\s*(.+)$/i);
    if (stockLabelMatch) {
      if (currentItem.companyName && (currentItem.price || currentItem.action)) flushCurrentItem();
      const rawVal = stockLabelMatch[1].trim();
      const parenMatch = rawVal.match(/\(([^)]+)\)/);
      currentItem.companyName = parenMatch ? parenMatch[1].trim() : rawVal;
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 2c. Standalone Action: "Action: BUY" or "Call: BUY"
    const standaloneActionMatch = line.match(/^(?:ACTION|CALL|RECOMMENDATION)\s*[:\-]\s*(BUY|SELL|ACCUMULATE|EXIT|HOLD|WATCH)\b/i);
    if (standaloneActionMatch) {
      currentItem.action = standaloneActionMatch[1].toUpperCase();
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 3. Action Check: Sell
    const sellMatch = line.match(/^sell\s+(?:above|upto|at)?\s*[:\-]?\s*(?:₹\s*)?([\d,]+(?:\.\d+)?(?:\/-)?)/i);
    if (sellMatch) {
      currentItem.action = currentItem.action || 'SELL';
      currentItem.price = parsePrice(sellMatch[1]);
      currentItem.rawLines.push(rawLine);
      flushCurrentItem();
      continue;
    }

    // 4. Action Check: Buy
    const buyMatch = line.match(/^buy\s+(?:upto|above|at|around)?\s*[:\-]?\s*(?:₹\s*)?([\d,]+(?:\.\d+)?(?:\/-)?)/i);
    if (buyMatch) {
      currentItem.action = currentItem.action || 'BUY';
      currentItem.price = parsePrice(buyMatch[1]);
      currentItem.rawLines.push(rawLine);
      flushCurrentItem();
      continue;
    }

    // 5. Explicit action headers (e.g. "BUY TATAMOTORS", "SELL RELIANCE")
    const headerActionMatch = line.match(/^(?:ACTION\s*[:\-]?\s*)?(BUY|SELL|ACCUMULATE|EXIT)\s+(?!range\b|zone\b|price\b|level\b|above\b|below\b|at\b|upto\b)(.+)$/i);
    if (headerActionMatch) {
      if (currentItem.companyName && currentItem.price) flushCurrentItem();
      currentItem.action = headerActionMatch[1].toUpperCase();
      const rawSym = headerActionMatch[2].trim();
      const paren = rawSym.match(/\(([^)]+)\)/);
      currentItem.companyName = paren ? paren[1].trim() : rawSym;
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 6. CMP / Entry Level Check
    const entryMatch = line.match(/^(?:CMP|ENTRY|BUY\s*RANGE|PRICE|LEVEL)\s*[:\-]?\s*(?:₹\s*)?([\d,]+(?:\.\d+)?)/i);
    if (entryMatch) {
      currentItem.price = parsePrice(entryMatch[1]);
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 7. Target Level Check
    const tgtMatch = line.match(/^(?:TARGETS?|TGT|TP)\s*[:\-]?\s*(?:₹\s*)?([\d,]+(?:\.\d+)?)/i);
    if (tgtMatch) {
      currentItem.target = parsePrice(tgtMatch[1]);
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 8. Stop Loss Check
    const slLineMatch = line.match(/^(?:STOP\s*LOSS|SL|STOPLOSS)\s*[:\-]?\s*(?:₹\s*)?([\d,]+(?:\.\d+)?)/i);
    if (slLineMatch) {
      currentItem.stopLoss = parsePrice(slLineMatch[1]);
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 9. Exit Level Check: Above / Below
    const aboveMatch = line.match(/^(?:above|below|at|upto)\s*[:\-]?\s*(?:₹\s*)?([\d,]+(?:\.\d+)?(?:\/-)?)/i);
    if (aboveMatch) {
      currentItem.price = parsePrice(aboveMatch[1]);
      currentItem.rawLines.push(rawLine);
      flushCurrentItem();
      continue;
    }

    // 10. Rating Check
    const ratingMatch = line.match(/(?:reduced\s+to\s+)?(\d+(?:\.\d+)?)\s*star|(?:star\s+)?rating\s*[-:]?\s*(\d+(?:\.\d+)?)/i);
    if (ratingMatch) {
      currentItem.rating = parseFloat(ratingMatch[1] || ratingMatch[2]);
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 11. Horizon Check
    const horizonMatch = line.match(/^(?:HORIZON|DURATION|TERM|TIMEFRAME)\s*[:\-]?\s*(.+)$/i);
    if (horizonMatch) {
      currentItem.horizon = horizonMatch[1].trim();
      currentItem.rawLines.push(rawLine);
      continue;
    }

    // 12. If companyName is already set and has a price, flush previous item before starting new
    if (currentItem.companyName && currentItem.price && (line.toLowerCase().startsWith('buy') || line.toLowerCase().startsWith('sell') || COMPANY_TICKER_MAP[line.toLowerCase()])) {
      flushCurrentItem();
    }

    // 13. Capture company name if line is not pure numbers or noise
    if (!currentItem.companyName) {
      if (!/^\d+$/.test(line) && line.split(' ').length <= 6 && !line.includes(':')) {
        currentItem.companyName = line.replace(/[:\-]+$/, '').trim();
        currentItem.rawLines.push(rawLine);
      }
    } else {
      currentItem.rawLines.push(rawLine);
    }
  }

  // Flush trailing item
  flushCurrentItem();

  // Fallback: Check standard single-line trade pattern if nothing parsed
  if (signals.length === 0) {
    const stdMatch = cleanText.match(/(BUY|SELL|ACCUMULATE)\s+([A-Z0-9&.-]+)\s+(?:CMP|ENTRY|AT)?\s*[:\-]?\s*₹?(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/i);
    if (stdMatch) {
      const action = stdMatch[1].toUpperCase();
      const rawStockName = stdMatch[2].trim();
      const entryMin = parseFloat(stdMatch[3]);
      const entryMax = stdMatch[4] ? parseFloat(stdMatch[4]) : entryMin;
      const entryPrice = entryMax;

      const targetMatch = cleanText.match(/(?:TGT|TARGETS?|TP)\s*[:\-]?\s*₹?([\d\s,.\/-]+)/i);
      const targets = targetMatch 
        ? targetMatch[1].split(/[,/\s]+/).map(t => parseFloat(t)).filter(t => !isNaN(t)) 
        : [];

      const slMatch = cleanText.match(/(?:SL|STOP\s*LOSS|STOPLOSS)\s*[:\-]?\s*₹?(\d+(?:\.\d+)?)/i);
      const stopLoss = slMatch ? parseFloat(slMatch[1]) : null;

      const normalized = normalizeSymbol(rawStockName);

      signals.push({
        id: generateSignalId(normalized.symbol || rawStockName, action, entryPrice, meta.timestamp),
        companyName: rawStockName,
        symbol: normalized.symbol || rawStockName.toUpperCase(),
        exchange: 'NSE',
        action,
        callType: /intraday/i.test(cleanText) ? 'INTRADAY' : 'SWING',
        entryPrice,
        entryMin,
        entryMax,
        target1: targets[0] || null,
        target2: targets[1] || null,
        targets,
        stopLoss,
        rating: null,
        requiresClarification: !normalized.isMapped,
        clarificationReason: !normalized.isMapped ? `Unconfirmed ticker mapping for "${rawStockName}"` : null,
        source: meta.source || 'Telegram',
        sender: meta.sender || 'Unknown',
        timestamp: meta.timestamp || new Date().toISOString(),
        rawText: cleanText,
        confidence: 0.95
      });
    }
  }

  return {
    isTradeSignal: signals.length > 0,
    signals,
    rawText,
    meta,
    reason: signals.length === 0 ? 'No stock parameters recognized after noise removal' : undefined
  };
}

module.exports = {
  parseStockMessage,
  isNoiseLine,
  generateSignalId
};
