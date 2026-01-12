#!/usr/bin/env node

const updateProduct = require('../database/firebaseDB/firebaseUpdate.js');
const admin = require('firebase-admin');

(async () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const code = `TEST_WRITE_${Date.now()}`;
  const data = {
    productCode: code,
    productId: code,
    createdAt: new Date().toISOString(),
    date: dateStr,
    title: 'Test Write Product',
    price: 123,
    discount: 10,
    url: 'https://example.com/test'
  };

  try {
    const res = await updateProduct(code, data);
    console.log('updateProduct result:', res);
    const snap = await admin.database().ref('deals/' + code).once('value');
    console.log('Read-back exists:', snap.exists());
    console.log('Read-back date:', snap.val() && snap.val().date);
    process.exit(0);
  } catch (e) {
    console.error('Test error:', e);
    process.exit(1);
  }
})();



