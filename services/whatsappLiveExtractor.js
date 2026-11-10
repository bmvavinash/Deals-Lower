const crypto = require('crypto');
const { listChromeTargets, connectCdpSocket } = require('./chromeCdpHelper');
const { parseStockMessage, generateSignalId } = require('./stockSignalParser');
const { resolveSignalTickerAndQuote } = require('./marketQuoteService');
const { saveRawMessage, saveSignals, saveNotification, memoryDB } = require('../database/stocksMultiDB');
const { dispatchWhatsAppAdvisoryAlert } = require('./genericTelegramDispatcher');
const { generateBestInsights } = require('./stockInsightsAggregator');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('whatsappLiveExtractor');

/**
 * Parse WhatsApp Web `data-pre-plain-text` header (e.g. "[10:30 am, 10/11/2026] SOIC Research: ")
 * into an accurate ISO timestamp (IST +05:30) + sender name, with domIndex ms tie-breaker so
 * newer chat rows always sort strictly ahead of older ones in the same minute.
 */
function parseWhatsAppHeader(headerStr, domIndex = 0, existingTimestamp = null, totalMessages = 1) {
  let sender = null;
  let parsedMs = null;

  if (headerStr && typeof headerStr === 'string') {
    const bracketMatch = headerStr.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (bracketMatch) {
      const dtPart = bracketMatch[1].trim();
      const rawSender = (bracketMatch[2] || '').replace(/:\s*$/, '').trim();
      if (rawSender) sender = rawSender;

      // Expected dtPart formats:
      // "10:30 am, 10/11/2026" | "14:05, 10/11/2026" | "10/11/2026, 10:30 am" | "10:30 am, 10/11/26"
      const timeMatch = dtPart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
      const dateMatch = dtPart.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);

      if (timeMatch && dateMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
        const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : null;

        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        const p1 = parseInt(dateMatch[1], 10);
        const p2 = parseInt(dateMatch[2], 10);
        let year = parseInt(dateMatch[3], 10);
        if (year < 100) year += 2000;

        const buildIstMs = (y, m, d) => {
          if (m < 1 || m > 12 || d < 1 || d > 31) return NaN;
          const pad = n => String(n).padStart(2, '0');
          return Date.parse(`${y}-${pad(m)}-${pad(d)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`);
        };

        // When both DD/MM and MM/DD are valid and <= now + 24h, choose the one closest to today (handles US & India WA locales)
        const nowPlusDay = Date.now() + 24 * 60 * 60 * 1000;
        const ddmmyyyy = buildIstMs(year, p2, p1);
        const mmddyyyy = buildIstMs(year, p1, p2);
        const candidates = [ddmmyyyy, mmddyyyy].filter(ms => !isNaN(ms) && ms <= nowPlusDay);

        if (candidates.length > 0) {
          parsedMs = Math.max(...candidates);
        } else if (!isNaN(ddmmyyyy)) {
          parsedMs = ddmmyyyy;
        } else if (!isNaN(mmddyyyy)) {
          parsedMs = mmddyyyy;
        }
      }
    }
  }

  if (parsedMs && !isNaN(parsedMs)) {
    // Sub-second domIndex ordering keeps same-minute messages strictly ordered bottom-to-top
    return {
      timestamp: new Date(parsedMs + (domIndex % 900)).toISOString(),
      sender
    };
  }

  // Fallback for headerless DOM messages: preserve prior stored timestamp so old messages don't jump to top
  if (existingTimestamp) {
    return { timestamp: existingTimestamp, sender };
  }
  const offsetBackMs = Math.max(0, (totalMessages - domIndex)) * 1000;
  return {
    timestamp: new Date(Date.now() - offsetBackMs).toISOString(),
    sender
  };
}

/**
 * Helper to auto-search and open a specific WhatsApp chat/group (e.g. "SOIC Research")
 */
async function searchAndSelectChat(waCdp, searchQuery) {
  if (!searchQuery) return false;
  try {
    const isTargetAlreadyOpen = await waCdp.evaluate((q) => {
      const headerTitle = document.querySelector('#main header span[dir="auto"]')?.innerText.toLowerCase() || '';
      return headerTitle.includes(q.toLowerCase());
    }, searchQuery);

    if (isTargetAlreadyOpen) {
      logger.info(`Target chat matching "${searchQuery}" is already active in #main.`);
      return true;
    }

    logger.info(`Searching for chat matching "${searchQuery}" in WhatsApp...`);
    const searchFound = await waCdp.evaluate((query) => {
      const input = document.querySelector('input[placeholder*="Search"]') ||
                    document.querySelector('input[aria-label*="Search"]') ||
                    document.querySelector('input[role="textbox"]');
      if (!input) return false;
      input.focus();
      input.value = query;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, searchQuery);

    if (searchFound) {
      await new Promise(r => setTimeout(r, 2000));

      const matchRect = await waCdp.evaluate((q) => {
        const nodes = document.querySelectorAll('span[title], div[data-testid="cell-frame-container"], div[role="listitem"]');
        for (const el of nodes) {
          const text = el.getAttribute('title') || el.innerText || '';
          if (text.toLowerCase().includes(q.toLowerCase())) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
          }
        }
        return null;
      }, searchQuery);

      if (matchRect) {
        await waCdp.clickPoint(matchRect.x, matchRect.y);
      } else {
        await waCdp.pressKey('ArrowDown');
        await new Promise(r => setTimeout(r, 500));
        await waCdp.pressKey('Enter');
      }

      await new Promise(r => setTimeout(r, 2500));
      logger.info(`Successfully selected search result for "${searchQuery}".`);
      return true;
    }
  } catch (err) {
    logger.warn('Could not auto-search chat in WhatsApp:', { error: err.message });
  }
  return false;
}

/**
 * Connect to active Chrome session on debugger port and extract current chat messages
 * @param {object} options - { port: 9223, limit: 50, chatQuery: 'SOIC Research' }
 */
async function extractActiveWhatsAppChat(options = {}) {
  const port = options.port || parseInt(process.env.STOCKS_CHROME_PORT || process.env.CHROME_DEBUGGER_PORT || '9223', 10);
  logger.info(`Connecting via CDP to Chrome port ${port} for WhatsApp extraction...`);

  let waCdp;
  try {
    const targets = await listChromeTargets(port);
    const pageTargets = targets.filter(t => t.type === 'page');
    const waTarget = pageTargets.find(t => (t.url || '').includes('web.whatsapp.com'));

    if (!waTarget?.webSocketDebuggerUrl) {
      throw new Error(`WhatsApp Web tab not found among ${pageTargets.length} Chrome page tab(s) on port ${port}.`);
    }

    waCdp = await connectCdpSocket(waTarget.webSocketDebuggerUrl, 20000);
    const pageTitle = await waCdp.evaluate(() => document.title).catch(() => 'WhatsApp');
    logger.info(`Attached to WhatsApp Web page: "${pageTitle}"`);

    // Auto-search and select target group (default: SOIC Research)
    const targetChat = options.chatQuery || process.env.WHATSAPP_TARGET_CHAT || 'SOIC';
    await searchAndSelectChat(waCdp, targetChat);

    // Extract active chat info & messages from #main
    const chatData = await waCdp.evaluate(() => {
      const mainEl = document.querySelector('#main');
      if (!mainEl) {
        return {
          hasMain: false,
          error: 'No active chat open. Please click a group or chat in WhatsApp Web.'
        };
      }

      // Chat Title
      const headerEl = mainEl.querySelector('header');
      let chatTitle = 'Active WhatsApp Chat';
      if (headerEl) {
        const titleSpan = headerEl.querySelector('span[dir="auto"]');
        if (titleSpan && titleSpan.innerText.trim()) {
          chatTitle = titleSpan.innerText.trim();
        }
      }

      // Extract rows from #main
      const rows = mainEl.querySelectorAll('div[role="row"]');
      const messages = [];

      rows.forEach((r, idx) => {
        const copyable = r.querySelector('[data-pre-plain-text]') || r.querySelector('.copyable-text');
        const timeHeader = copyable ? copyable.getAttribute('data-pre-plain-text') : null;
        const textSpan = r.querySelector('span.selectable-text');
        const text = textSpan ? textSpan.innerText : (copyable ? copyable.innerText : '');
        const authorHintEl = r.querySelector('span[dir="auto"][aria-label]') || r.querySelector('span._ahx_');
        const authorHint = authorHintEl ? authorHintEl.innerText?.trim() : null;

        if (text && text.trim().length > 0) {
          messages.push({
            header: timeHeader,
            text: text.trim(),
            authorHint,
            domIndex: idx
          });
        }
      });

      return {
        hasMain: true,
        chatTitle,
        messages
      };
    });

    await waCdp.close();
    waCdp = null;

    if (!chatData || !chatData.hasMain) {
      logger.warn(chatData.error);
      return { success: false, message: chatData.error, extractedSignals: [] };
    }

    logger.info(`Extracted ${chatData.messages.length} messages from "${chatData.chatTitle}"`);

    const rawSaved = [];
    const totalMsgs = chatData.messages.length;

    // 2. Parse all messages from chat chronologically with real timestamps
    const candidateSignals = [];
    for (let i = 0; i < totalMsgs; i++) {
      const msg = chatData.messages[i];
      const msgHashId = 'WA_MSG_' + crypto
        .createHash('sha1')
        .update(`${chatData.chatTitle}|${msg.header || ''}|${msg.text.trim()}`)
        .digest('hex')
        .slice(0, 16);

      const prevRaw = memoryDB.rawMessages ? memoryDB.rawMessages[msgHashId] : null;
      const { timestamp: realTimestamp, sender } = parseWhatsAppHeader(
        msg.header,
        msg.domIndex ?? i,
        prevRaw?.timestamp,
        totalMsgs
      );
      const effectiveSender = sender || msg.authorHint || chatData.chatTitle;

      const parseResult = parseStockMessage(msg.text, {
        source: `WhatsApp: ${chatData.chatTitle}`,
        sender: effectiveSender,
        rawHeader: msg.header,
        timestamp: realTimestamp
      });

      const matchedSymbols = [...new Set(
        (parseResult.signals || []).map(s => s.symbol).filter(Boolean)
      )];

      const rawRecord = await saveRawMessage({
        id: msgHashId,
        source: `WhatsApp: ${chatData.chatTitle}`,
        sourceType: 'whatsapp',
        chatTitle: chatData.chatTitle,
        header: msg.header,
        sender: effectiveSender,
        text: msg.text,
        timestamp: realTimestamp,
        domIndex: msg.domIndex ?? i,
        matchedSymbols,
        isTradeSignal: Boolean(parseResult.isTradeSignal)
      });
      rawSaved.push(rawRecord);

      if (parseResult.isTradeSignal && parseResult.signals.length > 0) {
        for (const sig of parseResult.signals) {
          const resolvedSig = sig.requiresClarification
            ? await resolveSignalTickerAndQuote(sig)
            : sig;
          candidateSignals.push({
            ...resolvedSig,
            sender: effectiveSender,
            rawHeader: msg.header || resolvedSig.rawHeader || null,
            timestamp: realTimestamp
          });
        }
      }
    }

    // 3. For any stock mentioned multiple times in the chat history, retain only the LATEST advisory
    const latestBySymbol = new Map();
    for (const sig of candidateSignals) {
      latestBySymbol.set(sig.symbol.toUpperCase(), sig);
    }

    // 4. Enrich latest signals with CMP, compare hashes, and notify only on genuine changes
    const extractedSignals = [];
    for (const [sym, sig] of latestBySymbol.entries()) {
      const id = generateSignalId(sig.symbol, sig.action, sig.entryPrice, sig.timestamp, sig.source || 'WhatsApp');
      const truthSig = {
        ...sig,
        id,
        sourcePriority: 1,
        isSourceOfTruth: true,
        sourceLabel: 'WhatsApp (Source of Truth)'
      };

      const evaluated = await resolveSignalTickerAndQuote(truthSig);
      const existing = memoryDB.signals ? memoryDB.signals[id] : null;
      const msgHash = `${truthSig.symbol}_${truthSig.action}_${truthSig.entryPrice || truthSig.entryMax}_${truthSig.rating || 0}_${(truthSig.rawText || '').trim()}`;

      const isNewOrUpdatedWA = !existing ||
        !existing.lastNotifiedMsgHash ||
        (existing.lastNotifiedMsgHash !== msgHash && (
          existing.action !== truthSig.action ||
          existing.entryPrice !== truthSig.entryPrice ||
          existing.rating !== truthSig.rating ||
          existing.rawText !== truthSig.rawText
        ));

      if (isNewOrUpdatedWA) {
        evaluated.lastNotifiedMsgHash = msgHash;
        evaluated.lastNotifiedStatus = evaluated.status;
        evaluated.lastNotifiedAt = new Date().toISOString();

        logger.info(`📢 New/Updated WhatsApp advisory detected for ${evaluated.symbol}. Dispatching alert...`);
        dispatchWhatsAppAdvisoryAlert(evaluated).catch(err => {
          logger.warn('Failed to dispatch WhatsApp advisory alert:', { error: err.message });
        });

        const isExitCall = ['SELL', 'EXIT', 'COMPLETE_EXIT', 'PARTIAL_EXIT'].includes((evaluated.action || '').toUpperCase());
        await saveNotification({
          id: `NOTIF_WA_${evaluated.symbol}_${crypto.createHash('sha1').update(msgHash).digest('hex').slice(0, 8)}`,
          signalId: id,
          symbol: evaluated.symbol,
          companyName: evaluated.companyName || evaluated.symbol,
          type: isExitCall ? 'TARGET_EXIT' : 'WHATSAPP_ADVISORY',
          action: evaluated.action,
          status: evaluated.status,
          currentCMP: evaluated.currentCMP,
          entryMax: evaluated.entryMax || evaluated.entryPrice,
          targetLevel: evaluated.target1 || evaluated.entryMax || evaluated.entryPrice,
          sender: evaluated.sender,
          rawHeader: evaluated.rawHeader || null,
          rawText: evaluated.rawText,
          source: evaluated.source,
          message: `WhatsApp (${evaluated.sender || 'Advisor'}): ${evaluated.action} ${evaluated.symbol}${evaluated.entryMax || evaluated.entryPrice ? ' @ ₹' + (evaluated.entryMax || evaluated.entryPrice) : ''}`,
          timestamp: evaluated.timestamp || new Date().toISOString()
        });
      } else if (existing) {
        evaluated.lastNotifiedMsgHash = existing.lastNotifiedMsgHash;
        evaluated.lastNotifiedStatus = existing.lastNotifiedStatus;
        evaluated.lastNotifiedAt = existing.lastNotifiedAt;
      }

      extractedSignals.push(evaluated);
    }

    // 5. Save parsed signals to Multi-DB & regenerate insights
    if (extractedSignals.length > 0) {
      await saveSignals(extractedSignals);
      logger.info(`Saved ${extractedSignals.length} stock signals to database.`);
      generateBestInsights().catch(err => {
        logger.warn('Failed to regenerate insights after WhatsApp sync:', { error: err.message });
      });
    }

    return {
      success: true,
      chatTitle: chatData.chatTitle,
      totalMessagesScanned: chatData.messages.length,
      signalsFound: extractedSignals.length,
      extractedSignals
    };

  } catch (err) {
    if (waCdp) {
      try { await waCdp.close(); } catch (_) {}
    }
    logger.error('WhatsApp extraction failed:', { error: err.message });
    return {
      success: false,
      error: err.message,
      extractedSignals: []
    };
  }
}

module.exports = {
  extractActiveWhatsAppChat,
  searchAndSelectChat
};
