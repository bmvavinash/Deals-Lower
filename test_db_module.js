require('dotenv').config();
const admin = require('firebase-admin');
const constants = require('./config/constants');
const config = require('./config/config');

const NEWS_DB_NAME = process.env.NEWS_DB_NAME || 'test-db';
const NEWS_DB_TOKEN_FILE = process.env.NEWS_DB_TOKEN_FILE || 'test-token';

function testFunction() {
  return 'test';
}

module.exports = {
  testFunction,
  NEWS_DB_NAME,
  NEWS_DB_TOKEN_FILE
};
