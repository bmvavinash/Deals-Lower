const puppeteer = require('puppeteer');

async function inspectAll() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.error('WhatsApp page not found');
    await browser.disconnect();
    return;
  }

  const result = await waPage.evaluate(() => {
    // 1. Current open chat
    const main = document.querySelector('#main');
    let currentChat = { title: null, messages: [] };
    if (main) {
      const headerTitle = main.querySelector('header span[dir="auto"]')?.innerText || 'No title';
      const rows = Array.from(main.querySelectorAll('div[role="row"]'));
      const msgs = [];
      rows.forEach(r => {
        const copyable = r.querySelector('.copyable-text');
        const timeHeader = copyable ? copyable.getAttribute('data-pre-plain-text') : null;
        const textSpan = r.querySelector('span.selectable-text');
        const text = textSpan ? textSpan.innerText : (copyable ? copyable.innerText : '');
        if (text && text.trim()) {
          msgs.push({
            timeHeader: timeHeader ? timeHeader.trim() : null,
            text: text.trim()
          });
        }
      });
      currentChat = { title: headerTitle, messagesCount: msgs.length, messages: msgs };
    }

    // 2. Sidebar Chats
    const side = document.querySelector('#side');
    const sideChats = [];
    if (side) {
      const chatRows = Array.from(side.querySelectorAll('div[role="listitem"], div[data-testid="cell-frame-container"]'));
      chatRows.forEach((r, idx) => {
        const titleSpan = r.querySelector('span[title]');
        const title = titleSpan ? titleSpan.getAttribute('title') : '';
        const unreadBadge = r.querySelector('span[aria-label*="unread"]') || r.querySelector('span[data-testid="icon-unread-count"]');
        const unreadCount = unreadBadge ? (unreadBadge.innerText || unreadBadge.getAttribute('aria-label') || 'unread') : '0';
        const snippet = r.innerText.replace(/\n/g, ' | ');
        if (title || snippet) {
          sideChats.push({
            idx,
            title,
            unread: unreadCount,
            snippet: snippet.substring(0, 120)
          });
        }
      });
    }

    return { currentChat, sideChats };
  });

  console.log('=== CURRENT ACTIVE CHAT ===');
  console.log('Title:', result.currentChat.title);
  console.log('Message Count:', result.currentChat.messagesCount);
  console.log('\n--- Recent 5 Messages in Active Chat ---');
  result.currentChat.messages.slice(-5).forEach((m, i) => {
    console.log(`[#${i + 1}] ${m.timeHeader || 'N/A'}\n${m.text}\n`);
  });

  console.log('\n=== SIDEBAR RECENT CHATS ===');
  result.sideChats.forEach(c => {
    console.log(`[${c.idx}] Title: "${c.title}" | Unread: ${c.unread} | Snippet: ${c.snippet}`);
  });

  await browser.disconnect();
}

inspectAll().catch(err => console.error(err));
