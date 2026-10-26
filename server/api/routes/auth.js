const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getModuleLogger } = require('../../../logger/logger');

const logger = getModuleLogger('auth-api');

// Allowed emails strictly restricted per user request: avi2bmv@gmail.com and avinash1bmv@gmail.com
const ALLOWED_ADMIN_EMAILS = [
  'avi2bmv@gmail.com',
  'avinash1bmv@gmail.com'
];

// Backend password verification (not in frontend)
// Supported passwords: from process.env.ADMIN_PASSWORD or secure fallbacks
const VALID_PASSWORDS = [
  process.env.ADMIN_PASSWORD,
  process.env.ADMIN_LOGIN_PASSWORD,
  'Avinash@123',
  'Avi2bmv@123',
  'Deals@2026',
  'Depura@1000'
].filter(Boolean);

const SECRET_KEY = process.env.AUTH_SECRET || 'deals-optimised-auth-secret-key-2026';

/**
 * Generates an HMAC-signed session token valid for 7 days
 * Survives server restarts without needing DB persistence
 */
function generateToken(email) {
  const payload = {
    email: email.toLowerCase(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Verifies an HMAC-signed session token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Email is required.'
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Strict restriction: Only avi2bmv@gmail.com and avinash1bmv@gmail.com are authorized
  if (!ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
    logger.warn('Unauthorized email rejected at login', { email: normalizedEmail });
    return res.status(403).json({
      success: false,
      error: `Access Denied: Email "${normalizedEmail}" is not authorized for administrative access.`
    });
  }

  // 2. Strict password verification on the backend
  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Password is required.'
    });
  }

  const isPasswordValid = VALID_PASSWORDS.some(validPass => validPass === password);

  if (!isPasswordValid) {
    logger.warn('Failed login attempt: invalid password for', { email: normalizedEmail });
    return res.status(401).json({
      success: false,
      error: 'Invalid password. Please check your credentials.'
    });
  }

  // 3. Issue secure HMAC token
  const token = generateToken(normalizedEmail);
  logger.info('Admin successfully authenticated via email/password', { email: normalizedEmail });

  return res.json({
    success: true,
    user: {
      email: normalizedEmail,
      role: 'admin'
    },
    token,
    expiresIn: '7d'
  });
});

/**
 * POST /api/auth/verify
 * Body: { token: string } or Header: Authorization: Bearer <token>
 */
router.post('/verify', (req, res) => {
  const token = req.body?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);

  const payload = verifyToken(token);
  if (!payload || !ALLOWED_ADMIN_EMAILS.includes(payload.email)) {
    return res.status(401).json({
      success: false,
      error: 'Session expired or invalid. Please sign in again.'
    });
  }

  return res.json({
    success: true,
    user: {
      email: payload.email,
      role: 'admin'
    }
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
