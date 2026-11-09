'use strict';

const assert = require('assert');
const {
  getISTDateString,
  getISTHour,
  normalizeSlotName,
  getCurrentOrClosestSlot,
  detectDealSlot,
  enrichProductWithSlot,
  isSlotDealValidForToday,
  VALID_SLOTS
} = require('../utils/dealSlotUtils');

console.log('🧪 Starting Slot Deals & Notifications Unit Tests...\n');

// 1. Test Date & Hour in IST
const todayIST = getISTDateString();
console.log(`1. Today IST Date: ${todayIST}`);
assert.match(todayIST, /^\d{4}-\d{2}-\d{2}$/, 'IST Date must be in YYYY-MM-DD format');

const currentHour = getISTHour();
console.log(`   Current IST Hour: ${currentHour}`);
assert.ok(currentHour >= 0 && currentHour <= 23, 'IST Hour must be 0-23');

// 2. Test Slot Normalization
console.log('2. Testing Slot Normalization...');
assert.strictEqual(normalizeSlotName('12pm'), '12pm');
assert.strictEqual(normalizeSlotName('12 PM'), '12pm');
assert.strictEqual(normalizeSlotName('12-pm'), '12pm');
assert.strictEqual(normalizeSlotName('12'), '12pm');
assert.strictEqual(normalizeSlotName('3pm'), '3pm');
assert.strictEqual(normalizeSlotName('3 PM Deals'), '3pm');
assert.strictEqual(normalizeSlotName('8pm'), '8pm');
assert.strictEqual(normalizeSlotName('invalid_slot'), null);
console.log('   ✅ Slot normalization passed');

// 3. Test Detection Logic (URL, Badges, Labels, Titles)
console.log('3. Testing Slot Detection Logic...');
assert.strictEqual(detectDealSlot({ url: 'https://amazon.in/events/12pmdeals' }), '12pm');
assert.strictEqual(detectDealSlot({ url: 'https://amazon.in/b?node=123&ref=wp3pmdeals' }), '3pm');
assert.strictEqual(detectDealSlot({ url: 'https://flipkart.com/deals-8pm' }), '8pm');
assert.strictEqual(detectDealSlot({ raw: { badge: '12 PM Loot' } }), '12pm');
assert.strictEqual(detectDealSlot({ raw: { title: 'Smartphone at 50% Off (3 PM Handpicked Deals)' } }), '3pm');
assert.strictEqual(detectDealSlot({ envSlot: '6pm' }), '6pm');
console.log('   ✅ Slot detection passed');

// 4. Test Product Enrichment
console.log('4. Testing Product Enrichment...');
const sampleRaw = { title: 'Headphones with 70% Off 12 PM Loot', price: '999' };
const sampleProduct = { title: sampleRaw.title, price: 999 };
const enriched = enrichProductWithSlot(sampleProduct, { raw: sampleRaw });

assert.strictEqual(enriched.dealSlot, '12pm');
assert.strictEqual(enriched.dealDate, todayIST);
assert.strictEqual(enriched.dealSlotKey, `${todayIST}_12pm`);
assert.strictEqual(enriched.isSlotDeal, true);
assert.strictEqual(enriched.dealLabel, '12 PM Loot');
console.log('   ✅ Enriched product structure verified:', {
  dealSlot: enriched.dealSlot,
  dealDate: enriched.dealDate,
  dealSlotKey: enriched.dealSlotKey,
  isSlotDeal: enriched.isSlotDeal
});

// 5. Test Date Tag Filtering (Older deals must NOT be shown)
console.log('5. Testing Strict Date Filtering...');
// Today's deal should be VALID
assert.strictEqual(isSlotDealValidForToday(enriched, '12pm', todayIST), true, 'Today deal must be valid');

// Yesterday's deal must be REJECTED
const yesterdayProduct = {
  ...enriched,
  dealDate: '2026-11-08',
  dealSlotKey: '2026-11-08_12pm'
};
assert.strictEqual(isSlotDealValidForToday(yesterdayProduct, '12pm', todayIST), false, 'Yesterday deal must be rejected');

// Deal from a different slot must be REJECTED
assert.strictEqual(isSlotDealValidForToday(enriched, '3pm', todayIST), false, 'Wrong slot must be rejected');
console.log('   ✅ Strict Date Tag verification passed (older deals safely filtered out)');

console.log('\n🎉 ALL SLOT DEALS TESTS PASSED SUCCESSFULLY!');
