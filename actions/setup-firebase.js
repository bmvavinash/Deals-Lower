/**
 * Firebase Setup for GitHub Actions CI Environment
 * 
 * This module validates and prepares the Firebase environment for CI.
 * It does NOT initialize Firebase apps directly — the existing DB modules
 * (productDealsDB, bannerDB, userFavoritesDB) already handle their own
 * initialization and support FIREBASE_SERVICE_ACCOUNT_JSON env var.
 * 
 * This module ensures:
 * 1. Required env vars are present in CI
 * 2. Proper error messages if secrets are missing
 * 3. CI detection utilities
 */

'use strict';

function isCI() {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

function validateCIEnvironment() {
  const ci = isCI();
  console.log(`[Firebase Setup] Environment: ${ci ? 'CI (GitHub Actions)' : 'Local Development'}`);

  if (!ci) {
    console.log('[Firebase Setup] Local mode — using file-based credentials');
    return { valid: true, mode: 'local' };
  }

  // In CI, validate required environment variables
  const errors = [];

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    errors.push('FIREBASE_SERVICE_ACCOUNT_JSON is missing — required for main deals database');
  } else {
    // Validate it's valid JSON
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (!parsed.project_id) {
        errors.push('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id field');
      } else {
        console.log(`[Firebase Setup] Primary Firebase project: ${parsed.project_id}`);
      }
    } catch (e) {
      errors.push(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${e.message}`);
    }
  }

  // USERS_FIREBASE_SERVICE_ACCOUNT_JSON is optional (only needed for favorites)
  if (process.env.USERS_FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.USERS_FIREBASE_SERVICE_ACCOUNT_JSON);
      if (parsed.project_id) {
        console.log(`[Firebase Setup] Users Firebase project: ${parsed.project_id}`);
      }
    } catch (e) {
      console.warn(`[Firebase Setup] Warning: USERS_FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${e.message}`);
    }
  } else {
    console.log('[Firebase Setup] USERS_FIREBASE_SERVICE_ACCOUNT_JSON not set — user favorites DB will use fallback');
  }

  // Validate optional Telegram keys
  if (process.env.TELEGRAM_BOT_KEY) {
    console.log('[Firebase Setup] TELEGRAM_BOT_KEY: configured');
  }
  if (process.env.DEALS_GLOBAL_BOT_KEY) {
    console.log('[Firebase Setup] DEALS_GLOBAL_BOT_KEY: configured');
  }

  if (errors.length > 0) {
    console.error('[Firebase Setup] CI Validation Errors:');
    errors.forEach(err => console.error(`  ❌ ${err}`));
    return { valid: false, mode: 'ci', errors };
  }

  console.log('[Firebase Setup] CI environment validated successfully');
  return { valid: true, mode: 'ci' };
}

// Run validation on import
const validation = validateCIEnvironment();

if (isCI() && !validation.valid) {
  console.error('[Firebase Setup] FATAL: CI environment validation failed. Exiting.');
  process.exit(1);
}

module.exports = {
  isCI,
  validateCIEnvironment,
  validation
};
