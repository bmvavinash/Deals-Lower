const db = require('../database/backups/stocks_local_db.json');
const waSignals = Object.values(db.signals).filter(s => s.source && s.source.includes('WhatsApp'));
const map = new Map();
waSignals.forEach(s => {
  if (!map.has(s.symbol)) map.set(s.symbol, []);
  map.get(s.symbol).push(s);
});

for (const [sym, arr] of map.entries()) {
  console.log(`=== ${sym} (${arr.length} WhatsApp signals) ===`);
  arr.slice(-3).forEach(s => {
    console.log(`  Action: ${s.action} | Price: ${s.entryPrice} | Time: ${s.timestamp} | Raw: ${(s.rawText || '').replace(/\n/g, ' ')}`);
  });
}
