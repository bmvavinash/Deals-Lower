const puppeteer = require('puppeteer');

async function checkUnreadChats() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.error('WhatsApp page not found');
    await browser.disconnect();
    return;
  }

  // Clear search input if text exists
  await waPage.evaluate(() => {
    const searchInput = document.querySelector('input[placeholder*="Search"]') ||
                        document.querySelector('input[aria-label*="Search"]') ||
                        document.querySelector('input[role="textbox"]');
    if (searchInput) {
      // Find clear button or clear text
      const clearBtn = document.querySelector('button[aria-label="Cancel search"]');
      if (clearBtn) clearBtn.click();
      else {
        searchInput.focus();
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  const chats = await waPage.evaluate(() => {
    const side = document.querySelector('#side');
    if (!side) return [];
    const rows = Array.from(side.querySelectorAll('div[role="listitem"], div[data-testid="cell-frame-container"]'));
    return rows.map((r, i) => {
      const titleSpan = r.querySelector('span[title]');
      const title = titleSpan ? titleSpan.getAttribute('title') : '';
      const timeSpan = r.querySelector('div[class*="timestamp"], span[dir="auto"]');
      const unreadBadge = r.querySelector('span[aria-label*="unread"]') || r.querySelector('span[data-testid="icon-unread-count"]');
      return {
        index: i,
        title,
        unread: unreadBadge ? (unreadBadge.innerText || unreadBadge.getAttribute('aria-label')) : null,
        fullText: r.innerText.replace(/\n/g, ' | ')
      };
    });
  });

  console.log(`Found ${chats.length} chats in WhatsApp sidebar:`);
  chats.forEach(c => {
    console.log(`[#${c.index}] "${c.title}" | Unread: ${c.unread || 'None'} | ${c.fullText.substring(0, 100)}`);
  });

  // Make sure SOIC 3yr Research stays open
  await browser.disconnect();
}

checkUnreadChats().catch(err => console.error(err));
