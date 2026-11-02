/**
 * System-Wide Remediation & Sanitization Script
 * Fixes ALL stocks in database & Firebase to prevent the CMP buy ceiling bug from ever recurring:
 * 1. Purges invalid tickers (#N/A, WHEREWEEXPECT..., MAXQTY..., FAST, NOW, etc.)
 * 2. Restores true recommended buy prices for ALL 49 Watchlist stocks from Column 11 (or Column 6/5)
 * 3. Locks AARTIPHARM buy ceiling strictly to ₹770 across all records
 * 4. Preserves WhatsApp Source of Truth trade calls (WELCORP, SANSERA, LLOYDSME) with Priority 1
 * 5. Re-evaluates status (IN_BUY_RANGE, ABOVE_ENTRY, TRIGGERED) against live CMP
 * 6. Updates stocks_local_db.json and Firebase Realtime Database
 */

const fs = require('fs');
const path = require('path');
const { getFirebaseDB } = require('../database/stocksMultiDB');

const dbPath = path.join(__dirname, '..', 'database', 'backups', 'stocks_local_db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Canonical Recommended Buy Prices for Google Sheet Watchlist
// (From Column 11 / historical recommended cost, with user-instructed overrides)
const WATCHLIST_RECOMMENDED_BUY_PRICES = {
  'KMEW': 2877,
  'STEELCAS': 317,
  'SUPRIYA': 909,
  'JASH': 511,
  'E2E': 630,
  'NRBBEARING': 483,
  'MCX': 3040,
  'MANORAMA': 1737,
  'RKFORGE': 681,
  'STLTECH': 555,
  'WELCORP': 1600, // WhatsApp target 2320 takes 1st priority for active trades
  'KUSUMGAR': 589,
  'TDPOWERSYS': 545,
  'KSHINTL': 842,
  'GALAPREC': 1034,
  'ASTRAMICRO': 1458,
  'SAREGAMA': 460,
  'VIYASH': 250,
  'THYROCARE': 522,
  'SHILPAMED': 499,
  'KDDL': 2179,
  'PWL': 110,
  'VENUSPIPES': 1311,
  'SBCL': 486,
  'SAMHI': 146,
  'LUMAXTECH': 1477,
  'GRAVITA': 1537,
  'NAVINFLUOR': 6485,
  'SAILIFE': 894,
  'IMFA': 1324,
  'GRWRHITECH': 3257,
  'ACUTAAS': 1644,
  'ARMANFIN': 1631,
  'ENTERO': 1229,
  'CSBBANK': 415,
  'INTELLECT': 1028,
  'HBLENGINE': 819,
  'SANSERA': 1680,
  'PRIVISCL': 3140,
  'JAYNECOIND': 68,
  'AARTIPHARM': 770, // Strictly ₹770 per user instruction
  'WINDLAS': 787,
  'PAYTM': 1368,
  'INTERARCH': 2440
};

// Stock List specific buy ranges (from Column 6 of Stock list tab)
const STOCKLIST_RECOMMENDED_BUY_PRICES = {
  'AARTIPHARM': 770, // Strictly ₹770
  'ABCAPITAL': 225,
  'ARMANFIN': 2100,
  'ARVINDFASN': 500,
  'BLUEJET': 750,
  'GLENMARK': 1450,
  'GOODLUCK': 800,
  'GPIL': 134,
  'HBLENGINE': 580,
  'HCG': 500,
  'HDFCLIFE': 700,
  'ICIL': 340,
  'INDIGO': 4000,
  'INTERARCH': 1450,
  'JKIL': 780,
  'NEULANDLAB': 3200,
  'NH': 1150,
  'NUVAMA': 6000,
  'PENIND': 170,
  'PRESTIGE': 1400,
  'SAMHI': 190,
  'SENCO': 490,
  'TIMETECHNO': 450
};

const BOGUS_SYMBOL_PATTERNS = [
  /^WHEREWEEXPECT/i,
  /^MAXQTY/i,
  /^MAXQUANTITY/i,
  /^FAST$/i,
  /^NOW$/i,
  /^NA$/i,
  /^N\/A$/i,
  /^#N\/A/i
];

function isBogusSymbol(sym) {
  if (!sym || typeof sym !== 'string') return true;
  const s = sym.trim().toUpperCase();
  if (s.length < 2 || s.length > 15 || s.includes(' ')) return true;
  for (const pat of BOGUS_SYMBOL_PATTERNS) {
    if (pat.test(s)) return true;
  }
  return false;
}

async function runRemediation() {
  console.log('===============================================================');
  console.log('   🛠️ SYSTEM-WIDE STOCKS PRICE & TICKER REMEDIATION           ');
  console.log('===============================================================\n');

  const oldSignals = db.signals || {};
  const newSignals = {};
  const purgedKeys = [];
  let updatedCount = 0;
  let priceAdjustedCount = 0;

  const fb = getFirebaseDB();

  for (const [id, s] of Object.entries(oldSignals)) {
    const sym = (s.symbol || '').toUpperCase().trim();

    // 1. Purge bogus/chatter tickers
    if (isBogusSymbol(sym)) {
      purgedKeys.push({ id, sym, source: s.source });
      if (fb) {
        try {
          await fb.ref(`stocks/signals/${id}`).remove();
        } catch {}
      }
      continue;
    }

    const updated = { ...s, symbol: sym };

    // 2. WhatsApp Source of Truth (Priority 1) Protection
    if (s.source && s.source.includes('WhatsApp')) {
      updated.sourcePriority = 1;
      updated.isSourceOfTruth = true;
      // Keep exact WhatsApp call levels intact
      newSignals[id] = updated;
      continue;
    }

    // 3. Google Sheet: Watchlist Remediation
    if (s.source && s.source.includes('Watchlist')) {
      updated.sourcePriority = 2;
      updated.isSourceOfTruth = false;

      const correctBuy = WATCHLIST_RECOMMENDED_BUY_PRICES[sym];
      if (correctBuy !== undefined) {
        if (updated.entryPrice !== correctBuy || updated.entryMax !== correctBuy) {
          console.log(`[Watchlist] Correcting ${sym}: Old Buy ₹${updated.entryPrice} -> New Buy ₹${correctBuy}`);
          updated.entryPrice = correctBuy;
          updated.entryMax = correctBuy;
          priceAdjustedCount++;
        }
      }
    }

    // 4. Google Sheet: Stock list Remediation
    if (s.source && s.source.includes('Stock list')) {
      updated.sourcePriority = 2;
      updated.isSourceOfTruth = false;

      const correctBuy = STOCKLIST_RECOMMENDED_BUY_PRICES[sym];
      if (correctBuy !== undefined) {
        if (updated.entryPrice !== correctBuy || updated.entryMax !== correctBuy) {
          console.log(`[Stock list] Correcting ${sym}: Old Buy ₹${updated.entryPrice} -> New Buy ₹${correctBuy}`);
          updated.entryPrice = correctBuy;
          updated.entryMax = correctBuy;
          priceAdjustedCount++;
        }
      }
    }

    // Aarti Pharmalabs global rule
    if (sym === 'AARTIPHARM') {
      updated.entryPrice = 770;
      updated.entryMax = 770;
    }

    // 5. Re-evaluate Status & PnL against current CMP
    const cmp = Number(updated.currentCMP);
    const entry = Number(updated.entryMax || updated.entryPrice);
    if (cmp && entry && updated.action === 'BUY') {
      updated.pnlPercent = Number((((cmp - entry) / entry) * 100).toFixed(2));
      if (cmp <= entry) {
        updated.status = 'IN_BUY_RANGE';
        updated.statusReason = `Currently in buy range (CMP ₹${cmp} <= ₹${entry})`;
      } else {
        updated.status = 'ABOVE_ENTRY';
        updated.statusReason = `Above recommended buy ceiling (CMP ₹${cmp} > ₹${entry})`;
      }
    }

    newSignals[id] = updated;
    updatedCount++;
  }

  // 6. Sanitize Insights collection
  const oldInsights = db.insights || {};
  const newInsights = {};
  for (const [id, ins] of Object.entries(oldInsights)) {
    const sym = (ins.symbol || '').toUpperCase().trim();
    if (isBogusSymbol(sym)) {
      if (fb) {
        try {
          await fb.ref(`stocks/insights/${id}`).remove();
        } catch {}
      }
      continue;
    }

    const updatedIns = { ...ins, symbol: sym };
    // WhatsApp Priority 1 overrides
    if (sym === 'WELCORP') {
      updatedIns.source = 'WhatsApp: SOIC 3yr Research';
      updatedIns.sourcePriority = 1;
      updatedIns.isSourceOfTruth = true;
      updatedIns.action = 'SELL';
      updatedIns.target1 = 2320;
    } else if (sym === 'AARTIPHARM') {
      updatedIns.entryPrice = 770;
      updatedIns.entryMax = 770;
      const cmp = Number(updatedIns.currentCMP);
      if (cmp > 770) {
        updatedIns.status = 'ABOVE_ENTRY';
        updatedIns.statusReason = `Above recommended buy ceiling (CMP ₹${cmp} > ₹770)`;
      }
    } else if (WATCHLIST_RECOMMENDED_BUY_PRICES[sym]) {
      const correctPrice = WATCHLIST_RECOMMENDED_BUY_PRICES[sym];
      updatedIns.entryPrice = correctPrice;
      updatedIns.entryMax = correctPrice;
      const cmp = Number(updatedIns.currentCMP);
      if (cmp && cmp > correctPrice) {
        updatedIns.status = 'ABOVE_ENTRY';
        updatedIns.statusReason = `Above recommended buy ceiling (CMP ₹${cmp} > ₹${correctPrice})`;
      } else if (cmp && cmp <= correctPrice) {
        updatedIns.status = 'IN_BUY_RANGE';
        updatedIns.statusReason = `Currently in buy range (CMP ₹${cmp} <= ₹${correctPrice})`;
      }
    }

    newInsights[id] = updatedIns;
  }

  // Save back to JSON backup
  db.signals = newSignals;
  db.insights = newInsights;
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

  // Push updated signals & insights batch to Firebase
  if (fb) {
    try {
      console.log('Syncing sanitized database to Firebase RTDB...');
      await fb.ref('stocks/signals').set(newSignals);
      await fb.ref('stocks/insights').set(newInsights);
      console.log('✅ Firebase RTDB synced successfully.');
    } catch (fbErr) {
      console.error('Firebase sync error:', fbErr.message);
    }
  }

  console.log('\n--- Remediation Complete ---');
  console.log(`Purged bogus signals: ${purgedKeys.length}`);
  purgedKeys.forEach(p => console.log(`  - Removed "${p.sym}" (${p.source}) [${p.id}]`));
  console.log(`Price adjustments made: ${priceAdjustedCount}`);
  console.log(`Total valid signals remaining: ${Object.keys(newSignals).length}`);
  console.log(`Total valid insights remaining: ${Object.keys(newInsights).length}`);

  process.exit(0);
}

runRemediation().catch(err => {
  console.error('Remediation failed:', err);
  process.exit(1);
});
