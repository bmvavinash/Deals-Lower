const { getAllSignals, saveBestInsights, getBestInsights, getSourcePriority } = require('../database/stocksMultiDB');
const { getLiveQuote, evaluateSignalWithCMP } = require('./marketQuoteService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('stockInsightsAggregator');

/**
 * Scan all stored signals, refresh live quotes, trigger alerts, and produce ranked Best Insights
 */
async function generateBestInsights() {
  logger.info('Generating best equity insights...');
  const allSignals = await getAllSignals();

  if (allSignals.length === 0) {
    return [];
  }

  // Refresh live CMP for all active signals and check alert triggers
  const refreshedSignals = [];
  const symbolMap = new Map();

  for (const sig of allSignals) {
    if (!sig.symbol) continue;
    
    // Group signals by symbol for multi-source consensus
    const symKey = sig.symbol.toUpperCase();
    if (!symbolMap.has(symKey)) {
      symbolMap.set(symKey, []);
    }
    symbolMap.get(symKey).push(sig);

    // Fetch quote
    const quote = await getLiveQuote(sig.symbol);
    const evaluated = evaluateSignalWithCMP(sig, quote) || sig;
    refreshedSignals.push(evaluated);
  }

  const actionableInsights = [];

  // 1. Triggered Exits / Targets Reached (Highest Urgency - Priority 1)
  const triggeredExits = refreshedSignals.filter(s => 
    (s.status === 'TRIGGERED' || s.status === 'TGT1_HIT' || s.status === 'TGT2_HIT') &&
    s.currentCMP && s.entryPrice
  );
  for (const sig of triggeredExits) {
    const targetLevel = Number(sig.entryPrice || sig.entryMin || sig.target1);
    const gainPercent = targetLevel && sig.currentCMP 
      ? Number((((sig.currentCMP - targetLevel) / targetLevel) * 100).toFixed(1))
      : 0;

    actionableInsights.push({
      type: 'ACTIONABLE_EXIT',
      symbol: sig.symbol,
      companyName: sig.companyName || sig.symbol,
      action: sig.action || 'SELL',
      targetLevel,
      currentCMP: sig.currentCMP,
      dayChangePercent: sig.dayChangePercent !== undefined ? sig.dayChangePercent : null,
      gainPercent,
      reason: `CMP ₹${sig.currentCMP} is +${gainPercent}% above recommended exit price of ₹${targetLevel}`,
      source: sig.source,
      rating: sig.rating,
      priority: 1,
      hasMultipleSources: Boolean(sig.hasMultipleSources),
      sourcesBreakdown: sig.sourcesBreakdown || [],
      sourceOfTruth: sig.sourceOfTruth || null,
      finalVerdict: sig.finalVerdict || null,
      signal: sig
    });
  }

  // 2. Fresh Buy Opportunities in Range (Priority 2) - EXCLUDES EXPIRED BUYS
  const buyOpportunities = refreshedSignals.filter(s => 
    s.action === 'BUY' && 
    !s.isExpired && 
    s.status !== 'EXPIRED' && 
    (s.status === 'IN_BUY_RANGE' || (s.entryMax && s.currentCMP && s.currentCMP <= s.entryMax))
  );
  for (const sig of buyOpportunities) {
    const buyUpto = Number(sig.entryMax || sig.entryPrice);
    const discountPercent = buyUpto && sig.currentCMP 
      ? Number((((buyUpto - sig.currentCMP) / buyUpto) * 100).toFixed(1))
      : 0;
    const isWA = sig.sourcePriority === 1 || getSourcePriority(sig.source) === 1;

    actionableInsights.push({
      type: 'BUY_OPPORTUNITY',
      symbol: sig.symbol,
      companyName: sig.companyName || sig.symbol,
      action: 'BUY',
      buyUpto,
      targetLevel: buyUpto,
      currentCMP: sig.currentCMP,
      dayChangePercent: sig.dayChangePercent !== undefined ? sig.dayChangePercent : null,
      discountPercent,
      rating: sig.rating,
      reason: `CMP ₹${sig.currentCMP} is trading at a ${discountPercent}% discount (Buy upto ₹${buyUpto})`,
      source: sig.source,
      sourcePriority: sig.sourcePriority || getSourcePriority(sig.source),
      isSourceOfTruth: isWA,
      sourceOfTruth: isWA ? 'WhatsApp' : sig.sourceOfTruth || null,
      priority: isWA ? 1 : (sig.rating && sig.rating >= 4 ? 2 : 3),
      hasMultipleSources: Boolean(sig.hasMultipleSources),
      sourcesBreakdown: sig.sourcesBreakdown || [],
      finalVerdict: sig.finalVerdict || null,
      signal: sig
    });
  }

  // 3. Multi-Source Consensus Analysis (WhatsApp = 1st Priority Source of Truth)
  for (const [sym, groupSignals] of symbolMap.entries()) {
    // Sort group signals so WhatsApp (1st Priority) is always first
    groupSignals.sort((a, b) => {
      const prioA = a.sourcePriority || getSourcePriority(a.source);
      const prioB = b.sourcePriority || getSourcePriority(b.source);
      return prioA - prioB;
    });

    const activeBuyCalls = groupSignals.filter(s => s.action === 'BUY' && !s.isExpired && s.status !== 'EXPIRED');
    const sellCalls = groupSignals.filter(s => s.action?.includes('SELL') || s.action?.includes('EXIT'));

    // Check if WhatsApp (1st Priority Source of Truth) issued an exit call for this symbol
    const waExitSignal = groupSignals.find(s => 
      (s.sourcePriority === 1 || getSourcePriority(s.source) === 1) &&
      (s.action?.includes('SELL') || s.action?.includes('EXIT') || s.isExitCall)
    );
    const waReinitSignal = groupSignals.find(s => 
      (s.sourcePriority === 1 || getSourcePriority(s.source) === 1) &&
      (s.action === 'REINITIATE' || s.isReinitiateCall)
    );
    const isExitActive = waExitSignal && (!waReinitSignal || new Date(waExitSignal.timestamp) > new Date(waReinitSignal.timestamp));

    const distinctSources = new Set(groupSignals.map(s => s.source)).size;
    const waSignal = groupSignals.find(s => (s.sourcePriority === 1 || getSourcePriority(s.source) === 1));
    const signalWithPrice = (isExitActive ? waExitSignal : (waSignal || groupSignals.find(s => s.entryPrice || s.entryMax || s.entryMin || s.target1))) || groupSignals[0];
    const signalWithCMP = groupSignals.find(s => s.currentCMP) || groupSignals[0];

    // If WhatsApp exit is active, dominant action is strictly SELL/EXIT regardless of Google Sheet buy rows!
    const dominantAction = isExitActive 
      ? (waExitSignal.action || 'SELL') 
      : (activeBuyCalls.length >= sellCalls.length ? 'BUY' : 'SELL');

    const targetLevel = Number(signalWithPrice.entryPrice || signalWithPrice.entryMax || signalWithPrice.entryMin || signalWithPrice.target1 || 0);
    const currentCMP = signalWithCMP.currentCMP || null;
    const dayChangePercent = signalWithCMP.dayChangePercent !== undefined ? signalWithCMP.dayChangePercent : null;

    if (groupSignals.length > 1) {
      let consensusReason = '';
      if (isExitActive) {
        consensusReason = `WhatsApp Exit Call Active (${waExitSignal.action} @ ₹${targetLevel || 'market'}). Buy call is EXPIRED unless reinitiated in WhatsApp.`;
        if (currentCMP && targetLevel) {
          if (currentCMP >= targetLevel) {
            const gain = (((currentCMP - targetLevel) / targetLevel) * 100).toFixed(1);
            consensusReason += ` • Target Met (+${gain}% above ₹${targetLevel})`;
          } else {
            consensusReason += ` • Current CMP ₹${currentCMP}`;
          }
        }
      } else {
        consensusReason = `${groupSignals.length} calls agreeing on ${dominantAction} (${distinctSources} source)`;
        if (currentCMP && targetLevel) {
          if (dominantAction === 'SELL' && currentCMP >= targetLevel) {
            const gain = (((currentCMP - targetLevel) / targetLevel) * 100).toFixed(1);
            consensusReason += ` • Target Met (+${gain}% above ₹${targetLevel})`;
          } else if (dominantAction === 'BUY' && currentCMP <= targetLevel) {
            const disc = (((targetLevel - currentCMP) / targetLevel) * 100).toFixed(1);
            consensusReason += ` • In Buy Zone (${disc}% discount, Buy upto ₹${targetLevel})`;
          } else {
            consensusReason += ` • Target Level: ₹${targetLevel}`;
          }
        } else if (targetLevel) {
          consensusReason += ` • Target Level: ₹${targetLevel}`;
        }
      }

      const hasBoth = waSignal && groupSignals.some(s => getSourcePriority(s.source) === 2);
      const sourceLabel = hasBoth
        ? 'WhatsApp (Source of Truth) • Cross-referenced with Google Sheet'
        : (distinctSources > 1 ? `Consensus (${distinctSources} sources)` : signalWithPrice.source);

      const breakdown = groupSignals.map(sib => {
        const isWA = sib.isSourceOfTruth || (sib.source && sib.source.toLowerCase().includes('whatsapp'));
        return {
          id: sib.id,
          source: sib.source,
          sourceLabel: isWA ? 'WhatsApp (Source of Truth)' : (sib.source?.includes('Watchlist') ? 'Google Sheet: Watchlist' : sib.source?.includes('Stock list') ? 'Google Sheet: Stock list' : sib.sourceLabel || sib.source),
          sourceType: isWA ? 'whatsapp' : (sib.source?.toLowerCase().includes('sheet') ? 'google_sheet' : 'telegram'),
          action: sib.action,
          price: sib.entryPrice || sib.entryMax || sib.target1,
          rating: sib.rating,
          status: sib.status,
          statusReason: sib.statusReason,
          isExpired: Boolean(sib.isExpired),
          isSourceOfTruth: Boolean(isWA),
          timestamp: sib.timestamp || sib.updatedAt,
          sender: sib.sender,
          rawText: sib.rawText
        };
      }).sort((a, b) => (b.isSourceOfTruth ? 1 : 0) - (a.isSourceOfTruth ? 1 : 0));

      actionableInsights.push({
        type: 'CONSENSUS',
        symbol: sym,
        companyName: signalWithPrice.companyName || sym,
        action: dominantAction,
        dominantAction,
        targetLevel: targetLevel || null,
        buyUpto: dominantAction === 'BUY' ? targetLevel : null,
        totalCalls: groupSignals.length,
        distinctSources,
        currentCMP: currentCMP,
        dayChangePercent: dayChangePercent,
        reason: consensusReason,
        summary: consensusReason,
        rating: signalWithPrice.rating || null,
        source: sourceLabel,
        isSourceOfTruth: Boolean(waSignal),
        sourceOfTruth: waSignal ? 'WhatsApp' : null,
        isExpiredBuy: Boolean(isExitActive),
        expiredReason: isExitActive ? `Buy expired due to WhatsApp ${waExitSignal.action} call` : null,
        hasMultipleSources: distinctSources > 1,
        sourcesBreakdown: breakdown,
        finalVerdict: consensusReason,
        signals: groupSignals,
        priority: waSignal ? 1 : 3
      });
    }
  }

  // Deduplicate insights per stock symbol: single best card per stock
  const seenSymbols = new Set();
  const dedupedInsights = [];

  // Sort by Source of Truth first (WhatsApp priority 1), then by priority
  actionableInsights.sort((a, b) => {
    const truthA = a.isSourceOfTruth ? 1 : 0;
    const truthB = b.isSourceOfTruth ? 1 : 0;
    if (truthB !== truthA) return truthB - truthA;
    return a.priority - b.priority;
  });

  for (const item of actionableInsights) {
    const key = item.symbol;
    if (!seenSymbols.has(key)) {
      seenSymbols.add(key);
      dedupedInsights.push(item);
    }
  }

  // Save to Multi-DB
  await saveBestInsights(dedupedInsights);
  logger.info(`Generated ${dedupedInsights.length} actionable insights.`);
  return dedupedInsights;
}

/**
 * Format insights into a clean Telegram Markdown message
 */
function formatTelegramInsightsMessage(insights) {
  if (!insights || insights.length === 0) {
    return '📊 *Stocks Equity Hub*: No high-conviction insights at this moment.';
  }

  let text = '🚀 *BEST EQUITY INSIGHTS & SIGNALS*\n';
  text += '━━━━━━━━━━━━━━━━━━━━━━\n';

  const exits = insights.filter(i => i.type === 'ACTIONABLE_EXIT');
  const buys = insights.filter(i => i.type === 'BUY_OPPORTUNITY');
  const consensus = insights.filter(i => i.type === 'CONSENSUS');

  if (exits.length > 0) {
    text += '\n🎯 *Actionable Exits / Targets Reached:*\n';
    exits.forEach(e => {
      text += `• *${e.symbol}* (${e.companyName})\n`;
      text += `  Target/Exit: ₹${e.targetLevel} | *CMP: ₹${e.currentCMP}* ✅\n`;
      text += `  _${e.reason}_\n`;
    });
  }

  if (buys.length > 0) {
    text += '\n🟢 *Fresh Buy Opportunities (In Range):*\n';
    buys.forEach(b => {
      const star = b.rating ? `[⭐ Rating ${b.rating}] ` : '';
      text += `• *${b.symbol}* ${star}(Buy upto ₹${b.buyUpto || b.targetLevel})\n`;
      text += `  *CMP: ₹${b.currentCMP}* (Discount: ${b.discountPercent}%)\n`;
      text += `  Source: ${b.source}\n`;
    });
  }

  if (consensus.length > 0) {
    text += '\n🤝 *Multi-Source Consensus:*\n';
    consensus.forEach(c => {
      text += `• *${c.symbol}*: ${c.totalCalls} calls agreeing on *${c.action || c.dominantAction}*\n`;
      if (c.targetLevel) text += `  Level: ₹${c.targetLevel} | `;
      if (c.currentCMP) text += `CMP: ₹${c.currentCMP}\n`;
    });
  }

  text += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
  text += `🕒 Generated: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  return text;
}

module.exports = {
  generateBestInsights,
  formatTelegramInsightsMessage
};
