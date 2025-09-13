/*
  Quick helper to print the last 5 productdeals in the Firebase DB
*/

(async () => {
  try {
    const { firebaseget } = require('../database/firebaseget');
    const result = await firebaseget(true, 'productdeals');
    const data = result && result.data ? result.data : {};
    const entries = Object.entries(data)
      .map(([key, value]) => ({ key, value }))
      .filter(item => item && item.value);

    entries.sort((a, b) => {
      const aTime = Number(a.value.updatedatetime || a.value.datetime || 0);
      const bTime = Number(b.value.updatedatetime || b.value.datetime || 0);
      return bTime - aTime;
    });

    const last5 = entries.slice(0, 5);
    console.log('Last 5 productdeals (latest first):');
    if (last5.length === 0) {
      console.log('No productdeals found.');
    } else {
      last5.forEach(({ key, value }) => {
        const url = value.productUrl || value.url || '';
        const ts = value.updatedatetime || value.datetime || '';
        console.log(`${key} | ${url} | ${ts}`);
      });
    }
    process.exit(0);
  } catch (err) {
    console.error('Error printing last productdeals:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();



