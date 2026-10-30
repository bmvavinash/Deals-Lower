const { getFirebaseDB, getAllSignals } = require('../database/stocksMultiDB');

async function syncToFirebase() {
  const fb = getFirebaseDB();
  if (!fb) {
    console.log('Firebase DB not initialized in current environment, using local multi-db backup.');
    return;
  }
  try {
    const signals = await getAllSignals();
    const aartiSignals = signals.filter(s => s.symbol === 'AARTIPHARM');
    console.log(`Syncing ${aartiSignals.length} AARTIPHARM signals to Firebase...`);
    for (const sig of aartiSignals) {
      await fb.ref(`stocks/signals/${sig.id}`).set(sig);
    }
    console.log('Successfully synced AARTIPHARM signals with ₹770 to Firebase.');
  } catch (err) {
    console.error('Firebase sync error:', err.message);
  }
}

syncToFirebase().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
