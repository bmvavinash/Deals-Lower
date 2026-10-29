const puppeteer = require('puppeteer');
const { parseStockMessage } = require('./stockSignalParser');
const { getLiveQuote, evaluateSignalWithCMP } = require('./marketQuoteService');
const { saveRawMessage, saveSignals } = require('../database/stocksMultiDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('whatsappLiveExtractor');

/**
 * Connect to active Chrome session on debugger port and extract current chat messages
 * @param {object} options - { port: 9223, limit: 50 }
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

    const extractedSignals = [];
    const rawSaved = [];

    for (const msg of chatData.messages) {
      // 1. Audit log raw message
      const rawRecord = await saveRawMessage({
        source: `WhatsApp: ${chatData.chatTitle}`,
        header: msg.header,
        text: msg.text,
        timestamp: new Date().toISOString()
      });
      rawSaved.push(rawRecord);

      // 2. Parse stock signals
      const parseResult = parseStockMessage(msg.text, {
        source: `WhatsApp: ${chatData.chatTitle}`,
        sender: msg.header || 'WhatsApp',
        rawHeader: msg.header,
        timestamp: new Date().toISOString()
      });

      if (parseResult.isTradeSignal && parseResult.signals.length > 0) {
        for (const sig of parseResult.signals) {
          // 3. Fetch live CMP
          const quote = await getLiveQuote(sig.symbol);
          const evaluated = evaluateSignalWithCMP(sig, quote);
          extractedSignals.push(evaluated || sig);
        }
      }
    }

    // 4. Save parsed signals to Multi-DB
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
