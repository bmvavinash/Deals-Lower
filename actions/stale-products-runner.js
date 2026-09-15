#!/usr/bin/env node
'use strict';

require('dotenv').config();
require('./setup-firebase');

process.env.TRIGGER_SOURCE = 'github-actions';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Import and run the script
const { main } = require('../scripts/updateStaleProducts');

main().catch(console.error);
