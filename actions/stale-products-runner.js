#!/usr/bin/env node
'use strict';

require('dotenv').config();
require('./setup-firebase');

process.env.TRIGGER_SOURCE = 'github-actions';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Import and run the script
const { main } = require('../scripts/updateStaleProducts');

main()
  .then(() => {
    console.log('Stale products runner finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Stale products runner failed:', err);
    process.exit(1);
  });
