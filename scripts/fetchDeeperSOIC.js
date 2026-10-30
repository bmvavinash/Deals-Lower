const puppeteer = require('puppeteer');
const { parseStockMessage } = require('../services/stockSignalParser');
const { getLiveQuote, evaluateSignalWithCMP } = require('../services/marketQuoteService');
const { saveRawMessage, saveSignals } = require('../database/stocksMultiDB');

async function fetchDeeperSOIC() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.error('No WhatsApp page found');
    await browser.disconnect();
    return;
  }

  console.log('Scrolling up deeper in SOIC 3yr Research chat...');
  for (let s = 0; s < 15; s++) {
    await waPage.evaluate(() => {
      // Find the messages scroller
      const scroller = document.querySelector('div[role="application"] div[tabindex="-1"]') ||
                       document.querySelector('div[data-tab="8"]') ||
                       document.querySelector('#main div[tabindex="0"]') ||
                       document.querySelector('#main div[style*="overflow-y"]') ||
                       document.querySelector('#main .copyable-area > div:nth-child(2)');
      if (scroller) {
        scroller.scrollTop = 0;
      }
    });
    await new Promise(r => setTimeout(r, 600));
  }

  // Extract all message rows
  const chatData = await waPage.evaluate(() => {
    const mainEl = document.querySelector('#main');
    if (!mainEl) return { hasMain: false };

    const headerEl = mainEl.querySelector('header');
    let chatTitle = 'SOIC 3yr Research';
    if (headerEl) {
      const titleSpan = headerEl.querySelector('span[dir="auto"]');
      if (titleSpan && titleSpan.innerText.trim()) {
        chatTitle = titleSpan.innerText.trim();
      }
    }

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

  console.log(`\n===============================================================`);
  console.log(`Total messages in "SOIC 3yr Research": ${chatData.messages.length}`);
  console.log(`===============================================================\n`);

  const extractedSignals = [];
  for (const msg of chatData.messages) {
    await saveRawMessage({
      source: `WhatsApp: ${chatData.chatTitle}`,
      header: msg.header,
      text: msg.text,
      timestamp: new Date().toISOString()
    });

    const parseResult = parseStockMessage(msg.text, {
      source: `WhatsApp: ${chatData.chatTitle}`,
      sender: msg.header || 'SOIC Research',
      rawHeader: msg.header,
      timestamp: new Date().toISOString()
    });

    if (parseResult.isTradeSignal && parseResult.signals.length > 0) {
      for (const sig of parseResult.signals) {
        const truthSig = {
          ...sig,
          source: `WhatsApp: ${chatData.chatTitle} (Source of Truth)`,
          sourcePriority: 1,
          isSourceOfTruth: true,
          sourceLabel: 'WhatsApp (Source of Truth)'
        };
        const quote = await getLiveQuote(sig.symbol);
        const evaluated = evaluateSignalWithCMP(truthSig, quote);
        extractedSignals.push(evaluated || truthSig);
      }
    }
  }

  console.log(`Total trade signals from SOIC: ${extractedSignals.length}`);
  extractedSignals.forEach((s, idx) => {
    console.log(`[${idx + 1}] Symbol: ${s.symbol} (${s.companyName}) | Action: ${s.action} | Price: ₹${s.entryPrice || s.entryMax || '-'} | CMP: ₹${s.currentCMP} | Status: ${s.status}`);
  });

  if (extractedSignals.length > 0) {
    await saveSignals(extractedSignals);
    console.log(`\nSuccessfully saved ${extractedSignals.length} Source of Truth signals into database!`);
  }

  await browser.disconnect();
}

fetchDeeperSOIC().catch(console.error);
