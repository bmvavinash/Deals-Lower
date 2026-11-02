const { extractActiveWhatsAppChat } = require('../services/whatsappLiveExtractor');
const { generateBestInsights, formatTelegramInsightsMessage } = require('../services/stockInsightsAggregator');

async function main() {
  const port = process.argv[2] ? parseInt(process.argv[2], 10) : 9223;
  console.log(`🚀 Starting Live WhatsApp Stocks Extraction on Port ${port}...`);

  const result = await extractActiveWhatsAppChat({ port });
  console.log('\n=============================================');
  console.log('Result Status:', result.success ? 'SUCCESS' : 'FAILED');
  if (result.success) {
    console.log(`Chat Title: "${result.chatTitle}"`);
    console.log(`Messages Scanned: ${result.totalMessagesScanned}`);
    console.log(`Signals Ingested: ${result.signalsFound}`);

    console.log('\n--- EXTRACTED SIGNALS WITH LIVE CMP ---');
    result.extractedSignals.forEach((s, idx) => {
      console.log(`\n[#${idx + 1}] [${s.action}] ${s.symbol} (${s.companyName || s.symbol})`);
      console.log(`     Target/Price: ₹${s.entryPrice || s.entryMax || '-'} | CMP: ₹${s.currentCMP || 'N/A'}`);
      console.log(`     Status: ${s.status} (${s.statusReason || ''})`);
      if (s.requiresClarification) {
        console.log(`     ⚠️ Requires Ticker Clarification: ${s.clarificationReason}`);
      }
    });

    console.log('\n--- GENERATING BEST EQUITY INSIGHTS ---');
    const insights = await generateBestInsights();
    console.log(formatTelegramInsightsMessage(insights));
  } else {
    console.error('Extraction Error:', result.error || result.message);
  }
}

main().catch(err => console.error('Fatal Error:', err));
