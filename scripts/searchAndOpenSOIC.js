const { listChromeTargets, connectCdpSocket } = require('../services/chromeCdpHelper');
const { searchAndSelectChat } = require('../services/whatsappLiveExtractor');

async function searchAndOpenSOIC() {
  const port = parseInt(process.env.STOCKS_CHROME_PORT || '9223', 10);
  const targets = await listChromeTargets(port);
  const waTarget = targets.find(t => t.type === 'page' && (t.url || '').includes('web.whatsapp.com'));
  if (!waTarget?.webSocketDebuggerUrl) {
    console.error('WhatsApp Web tab not found on port', port);
    return;
  }

  const waCdp = await connectCdpSocket(waTarget.webSocketDebuggerUrl, 15000);
  try {
    const title = await waCdp.evaluate(() => document.title).catch(() => 'WhatsApp');
    console.log('Attached to WhatsApp Web page:', title);
    await searchAndSelectChat(waCdp, process.env.WHATSAPP_TARGET_CHAT || 'SOIC');
  } finally {
    await waCdp.close().catch(() => {});
  }
}

searchAndOpenSOIC().catch(err => {
  console.error('searchAndOpenSOIC warning:', err.message);
});
