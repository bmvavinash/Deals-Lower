/*
  Kick off bulk updates across all platforms and store results in productdeals.
*/

(async () => {
  try {
    const { runBulkUpdateAll } = require('./bulkUpdateAllPlatforms');
    const start = Date.now();
    console.log('Starting bulk run to productdeals...');
    const summary = await runBulkUpdateAll('website', 'productdeals');
    const ms = Date.now() - start;
    console.log('Bulk run complete (productdeals). Duration ms:', ms);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Bulk to productdeals failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();



