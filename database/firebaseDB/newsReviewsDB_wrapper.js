require('dotenv').config();
// Re-export with explicit initialization
const original = require('./database/firebaseDB/newsReviewsDB.js');

// If exports are empty, try to access functions directly
if (Object.keys(original).length === 0) {
  console.log('âš ï¸  Original module has empty exports, trying direct require...');
  // Force re-evaluation
  delete require.cache[require.resolve('./database/firebaseDB/newsReviewsDB.js')];
  const path = require('path');
  const Module = require('module');
  const filePath = path.resolve('./database/firebaseDB/newsReviewsDB.js');
  const reloaded = require(filePath);
  console.log('Reloaded exports:', Object.keys(reloaded));
  module.exports = reloaded;
} else {
  module.exports = original;
}
