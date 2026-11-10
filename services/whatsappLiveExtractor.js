const puppeteer = require('puppeteer');
const { parseStockMessage, generateSignalId } = require('./stockSignalParser');
const { resolveSignalTickerAndQuote } = require('./marketQuoteService');
const { saveRawMessage, saveSignals, memoryDB } = require('../database/stocksMultiDB');
const { dispatchWhatsAppAdvisoryAlert } = require('./genericTelegramDispatcher');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('whatsappLiveExtractor');

/**
 * Helper to auto-search and open a specific WhatsApp chat/group (e.g. "SOIC Research")
 */
async function searchAndSelectChat(waPage, searchQuery) {
  if (!searchQuery) return false;
  try {
    const isTargetAlreadyOpen = await waPage.evaluate((q) => {
      const headerTitle = document.querySelector('#main header span[dir="auto"]')?.innerText.toLowerCase() || '';
      return headerTitle.includes(q.toLowerCase());
    }, searchQuery);

    if (isTargetAlreadyOpen) {
      logger.info(`Target chat matching "${searchQuery}" is already active in #main.`);
      return true;
    }

    logger.info(`Searching for chat matching "${searchQuery}" in WhatsApp...`);
    const searchFound = await waPage.evaluate((query) => {
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
      
      // Native bounding box click on matching item in side bar
      const elements = await waPage.$$('span[title], div[data-testid="cell-frame-container"], div[role="listitem"]');
      let clicked = false;
      for (const el of elements) {
        const text = await waPage.evaluate(node => node.getAttribute('title') || node.innerText || '', el);
        if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
          const box = await el.boundingBox();
          if (box) {
            await waPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            clicked = true;
            break;
          }
        }
      }

      if (!clicked) {
        // Fallback to keyboard Enter on first search match
        await waPage.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 500));
        await waPage.keyboard.press('Enter');
        clicked = true;
      }

      if (clicked) {
        await new Promise(r => setTimeout(r, 2500));
        logger.info(`Successfully clicked search result for "${searchQuery}".`);
        return true;
      }
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
  const browserURL = `http://127.0.0.1:${port}`;
  
  logger.info(`Connecting to Chrome on ${browserURL} for WhatsApp extraction...`);

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL, defaultViewport: null });
    const pages = await browser.pages();
    const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));

    if (!waPage) {
      throw new Error(`WhatsApp Web tab not found among ${pages.length} Chrome tabs on port ${port}.`);
    }

    logger.info(`Attached to WhatsApp Web page: "${await waPage.title()}"`);

    // Auto-search and select target group (default: SOIC Research)
    const targetChat = options.chatQuery || process.env.WHATSAPP_TARGET_CHAT || 'SOIC';
    await searchAndSelectChat(waPage, targetChat);

    // Extract active chat info & messages from #main
    const chatData = await waPage.evaluate(() => {
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

      rows.forEach(r => {
        const copyable = r.querySelector('.copyable-text');
        const timeHeader = copyable ? copyable.getAttribute('data-pre-plain-text') : null;
        const textSpan = r.querySelector('span.selectable-text');
        const text = textSpan ? textSpan.innerText : (copyable ? copyable.innerText : '');

        if (text && text.trim().length > 0) {
          messages.push({
            header: timeHeader,
            text: text.trim()
          });
        }
      });

      return {
        hasMain: true,
        chatTitle,
        messages
      };
    });

    await browser.disconnect();

    if (!chatData.hasMain) {
      logger.warn(chatData.error);
      return { success: false, message: chatData.error, extractedSignals: [] };
    }

    logger.info(`Extracted ${chatData.messages.length} messages from "${chatData.chatTitle}"`);

    const rawSaved = [];

    // 2. Parse all messages from chat
    const candidateSignals = [];
    for (const msg of chatData.messages) {
      const rawRecord = await saveRawMessage({
        source: `WhatsApp: ${chatData.chatTitle}`,
        header: msg.header,
        text: msg.text,
        timestamp: new Date().toISOString()
      });
      rawSaved.push(rawRecord);

      const parseResult = parseStockMessage(msg.text, {
        source: `WhatsApp: ${chatData.chatTitle}`,
        sender: msg.header || 'WhatsApp',
        rawHeader: msg.header,
        timestamp: new Date().toISOString()
      });

      if (parseResult.isTradeSignal && parseResult.signals.length > 0) {
        for (const sig of parseResult.signals) {
          const resolvedSig = sig.requiresClarification
            ? await resolveSignalTickerAndQuote(sig)
            : sig;
          candidateSignals.push(resolvedSig);
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

        logger.info(`📢 New/Updated WhatsApp advisory detected for ${evaluated.symbol}. Dispatching Telegram alert...`);
        dispatchWhatsAppAdvisoryAlert(evaluated).catch(err => {
          logger.warn('Failed to dispatch WhatsApp advisory alert:', { error: err.message });
        });
      } else if (existing) {
        evaluated.lastNotifiedMsgHash = existing.lastNotifiedMsgHash;
        evaluated.lastNotifiedStatus = existing.lastNotifiedStatus;
        evaluated.lastNotifiedAt = existing.lastNotifiedAt;
      }

      extractedSignals.push(evaluated);
    }

    // 5. Save parsed signals to Multi-DB
    if (extractedSignals.length > 0) {
      await saveSignals(extractedSignals);
      logger.info(`Saved ${extractedSignals.length} stock signals to database.`);
    }

    return {
      success: true,
      chatTitle: chatData.chatTitle,
      totalMessagesScanned: chatData.messages.length,
      signalsFound: extractedSignals.length,
      extractedSignals
    };

  } catch (err) {
    if (browser) {
      try { await browser.disconnect(); } catch (_) {}
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
  extractActiveWhatsAppChat
};
