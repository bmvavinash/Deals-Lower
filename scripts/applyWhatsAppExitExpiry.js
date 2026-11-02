/**
 * Apply WhatsApp Exit Expiry Rule Across All Stocks in DB & Firebase
 * Rule: Once in WhatsApp a particular stock exit message comes, the buy would be expired
 * unless a reinitiate comes in WhatsApp again.
 */

const fs = require('fs');
const path = require('path');
const { getFirebaseDB, getWhatsAppStockStates } = require('../database/stocksMultiDB');

const dbPath = path.join(__dirname, '..', 'database', 'backups', 'stocks_local_db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

async function run() {
  console.log('===============================================================');
  console.log('   🔄 APPLYING WHATSAPP EXIT -> BUY EXPIRY RULE                ');
  console.log('===============================================================\n');

  const signals = Object.values(db.signals || {});
  const waStates = getWhatsAppStockStates(signals);

  console.log(`Discovered WhatsApp lifecycle states for ${waStates.size} symbols:`);
  for (const [sym, st] of waStates.entries()) {
    console.log(`  - ${sym}: hasExit=${st.hasExit}, isExpired=${st.isExpired}, isReinitiated=${st.isReinitiated}, activeAction=${st.activeAction} @ ₹${st.activePrice}`);
  }

  let expiredBuyCount = 0;
  const fb = getFirebaseDB();
  const fbUpdates = {};

  for (const [id, s] of Object.entries(db.signals || {})) {
    const sym = (s.symbol || '').toUpperCase().trim();
    const st = waStates.get(sym);

    if (st && st.isExpired && (s.action === 'BUY' || s.action === 'ACCUMULATE')) {
      s.isExpired = true;
      s.status = 'EXPIRED';
      s.statusReason = `Buy expired: WhatsApp exit call issued (${st.latestExit.action} @ ₹${st.latestExit.price || 'market'}) unless reinitiated in WhatsApp`;
      s.updatedAt = new Date().toISOString();
      expiredBuyCount++;

      fbUpdates[`stocks/signals/${id}/isExpired`] = true;
      fbUpdates[`stocks/signals/${id}/status`] = 'EXPIRED';
      fbUpdates[`stocks/signals/${id}/statusReason`] = s.statusReason;
      fbUpdates[`stocks/signals/${id}/updatedAt`] = s.updatedAt;
    } else if (st && st.isReinitiated && s.isExpired) {
      s.isExpired = false;
      s.isReinitiated = true;
      s.updatedAt = new Date().toISOString();
      fbUpdates[`stocks/signals/${id}/isExpired`] = false;
      fbUpdates[`stocks/signals/${id}/isReinitiated`] = true;
    }
  }

  // Update insights
  for (const [id, ins] of Object.entries(db.insights || {})) {
    const sym = (ins.symbol || '').toUpperCase().trim();
    const st = waStates.get(sym);
    if (st && st.isExpired) {
      ins.action = st.latestExit.action || 'SELL';
      ins.dominantAction = st.latestExit.action || 'SELL';
      ins.targetLevel = st.latestExit.price || ins.targetLevel;
      ins.isExpiredBuy = true;
      ins.expiredReason = `Buy expired due to WhatsApp ${st.latestExit.action} call`;
      ins.reason = `WhatsApp Exit Call Active (${st.latestExit.action} @ ₹${st.latestExit.price || 'market'}). Buy call is EXPIRED unless reinitiated in WhatsApp.`;
      
      fbUpdates[`stocks/insights/${id}/action`] = ins.action;
      fbUpdates[`stocks/insights/${id}/dominantAction`] = ins.dominantAction;
      fbUpdates[`stocks/insights/${id}/targetLevel`] = ins.targetLevel;
      fbUpdates[`stocks/insights/${id}/isExpiredBuy`] = true;
      fbUpdates[`stocks/insights/${id}/expiredReason`] = ins.expiredReason;
      fbUpdates[`stocks/insights/${id}/reason`] = ins.reason;
    }
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\nUpdated local DB: ${expiredBuyCount} buy calls expired.`);

  if (fb && Object.keys(fbUpdates).length > 0) {
    try {
      console.log(`Syncing ${Object.keys(fbUpdates).length} updates to Firebase RTDB...`);
      await fb.ref().update(fbUpdates);
      console.log('✅ Firebase RTDB synced successfully.');
    } catch (fbErr) {
      console.error('Firebase sync error:', fbErr.message);
    }
  }

  process.exit(0);
}

run().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
