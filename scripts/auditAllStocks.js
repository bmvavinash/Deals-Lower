const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'backups', 'stocks_local_db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const signals = Object.values(db.signals || {});

console.log(`Total signals in DB: ${signals.length}`);

const symbolMap = new Map();
signals.forEach(s => {
  const sym = s.symbol;
  if (!symbolMap.has(sym)) {
    symbolMap.set(sym, []);
  }
  symbolMap.get(sym).push(s);
});

console.log(`Total unique symbols: ${symbolMap.size}\n`);

const suspiciousSymbols = [];
const priceAnomalies = [];

for (const [sym, group] of symbolMap.entries()) {
  // Check symbol validity
  if (!sym || sym.length > 15 || sym.includes(' ') || sym === 'NA' || sym === 'N/A' || sym === '#N/A') {
    suspiciousSymbols.push({ sym, count: group.length, sampleText: group[0].rawText });
  }

  // Check prices across sources
  const prices = group.map(s => ({
    id: s.id,
    source: s.source,
    price: s.entryPrice,
    max: s.entryMax,
    cmp: s.currentCMP,
    prio: s.sourcePriority
  }));

  const distinctPrices = new Set(prices.map(p => p.price).filter(Boolean));
  if (distinctPrices.size > 1) {
    priceAnomalies.push({
      sym,
      company: group[0].companyName,
      distinctPrices: Array.from(distinctPrices),
      details: prices
    });
  }
}

console.log(`Suspicious/Bad Symbols (${suspiciousSymbols.length}):`);
suspiciousSymbols.forEach(s => console.log(`- "${s.sym}": count=${s.count} | snippet=${s.sampleText?.substring(0, 60)}`));

console.log(`\nPrice Divergences Across Sources / Extracts (${priceAnomalies.length}):`);
priceAnomalies.forEach(a => {
  console.log(`- ${a.sym} (${a.company}): prices=[${a.distinctPrices.join(', ')}]`);
  a.details.forEach(d => {
    console.log(`    ${d.source}: price=₹${d.price} (CMP: ₹${d.cmp}) [Prio: ${d.prio}]`);
  });
});
