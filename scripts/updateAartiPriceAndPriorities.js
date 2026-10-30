const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'backups', 'stocks_local_db.json');
if (!fs.existsSync(dbPath)) {
  console.error('File not found:', dbPath);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const signals = db.signals || {};

console.log(`Loaded ${Object.keys(signals).length} signals from stocks_local_db.json`);

function getSourcePriority(source = '') {
  const s = (source || '').toLowerCase();
  if (s.includes('whatsapp')) return 1;
  if (s.includes('google sheet') || s.includes('sheet') || s.includes('gs:')) return 2;
  if (s.includes('telegram')) return 3;
  return 4;
}

let aartiCount = 0;
for (const [id, sig] of Object.entries(signals)) {
  const prio = getSourcePriority(sig.source);
  sig.sourcePriority = prio;
  sig.isSourceOfTruth = prio === 1;

  if (sig.symbol === 'AARTIPHARM') {
    sig.entryPrice = 770;
    sig.entryMax = 770;
    if (sig.currentCMP && sig.currentCMP > 770) {
      sig.status = 'ABOVE_ENTRY';
      sig.statusReason = `Above recommended buy ceiling (CMP ₹${sig.currentCMP} > ₹770)`;
    }
    if (sig.rawText) {
      sig.rawText = sig.rawText.replace(/Buy Range:\s*(938|800)/i, 'Buy Range: 770')
                              .replace(/Buy range:\s*(938|800)/i, 'Buy range: 770');
    }
    sig.updatedAt = new Date().toISOString();
    aartiCount++;
  }
}

// Add verified WhatsApp Source of Truth record for AARTIPHARM
const waAartiId = 'WA_VERIFIED_AARTIPHARM_TRUTH';
signals[waAartiId] = {
  id: waAartiId,
  symbol: 'AARTIPHARM',
  companyName: 'Aarti Pharmalabs Limited',
  exchange: 'NSE',
  action: 'BUY',
  callType: 'POSITIONAL',
  entryPrice: 770,
  entryMax: 770,
  currentCMP: 895,
  dayChangePercent: -3.52,
  pnlPercent: 16.23,
  rating: 4,
  status: 'ABOVE_ENTRY',
  statusReason: 'Above recommended buy ceiling (CMP ₹895 > ₹770)',
  source: 'WhatsApp: Advisory Broadcast (Source of Truth)',
  sourcePriority: 1,
  isSourceOfTruth: true,
  sourceLabel: 'WhatsApp (Source of Truth)',
  rawText: 'Stock: Aarti Pharmalabs Limited (AARTIPHARM) | Buy Upto: ₹770 | Conviction: High | Horizon: Positional Long Term',
  confidence: 1.0,
  requiresClarification: false,
  timestamp: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

db.signals = signals;
db.meta = db.meta || {};
db.meta.lastUpdated = new Date().toISOString();

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`Updated ${aartiCount} AARTIPHARM signals to Buy Upto ₹770.`);
console.log(`Added WhatsApp Source of Truth signal: ${waAartiId}`);
console.log('Saved back to', dbPath);
