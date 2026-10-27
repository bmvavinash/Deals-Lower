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
 * Validates admin email & password against backend rules
 */
function validateCredentials(email, password) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required.' };
  }
  const normalized = email.trim().toLowerCase();
  if (!ALLOWED_ADMIN_EMAILS.includes(normalized)) {
    return { valid: false, error: 'Access Denied: Invalid credentials or unauthorized account.' };
  }
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  const isPasswordValid = VALID_PASSWORDS.some(validPass => validPass === password);
  if (!isPasswordValid) {
    return { valid: false, error: 'Access Denied: Invalid password.' };
  }
  return { valid: true, email: normalized };
}

/**
 * Universally authenticates an incoming request via:
 * 1. Header: Authorization: Bearer <token>
 * 2. Header: Authorization: Basic <base64(email:password)>
 * 3. Headers: x-admin-email & x-admin-password (or x-email, x-password, admin-email, admin-password)
 * 4. Headers: x-auth-token / x-admin-token
 * 5. Body / Query: token or email & password
 */
function authenticateRequest(req) {
  const headers = req.headers || {};
  const authHeader = (headers['authorization'] || '').trim();

  // 1. Bearer Token
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    if (payload && ALLOWED_ADMIN_EMAILS.includes(payload.email.toLowerCase())) {
      return { authenticated: true, user: { email: payload.email, role: 'admin' }, authType: 'bearer' };
    }
    return { authenticated: false, error: 'Access Denied: Invalid or expired Bearer token.' };
  }

  // 2. Custom Token Header
  const customToken = headers['x-auth-token'] || headers['x-admin-token'];
  if (customToken && typeof customToken === 'string') {
    const payload = verifyToken(customToken);
    if (payload && ALLOWED_ADMIN_EMAILS.includes(payload.email.toLowerCase())) {
      return { authenticated: true, user: { email: payload.email, role: 'admin' }, authType: 'bearer' };
    }
    return { authenticated: false, error: 'Access Denied: Invalid or expired auth token.' };
  }

  // 3. Basic Auth Header (Authorization: Basic <base64>)
  if (authHeader.toLowerCase().startsWith('basic ')) {
    try {
      const creds = Buffer.from(authHeader.slice(6).trim(), 'base64').toString('utf8');
      const colonIdx = creds.indexOf(':');
      if (colonIdx !== -1) {
        const email = creds.slice(0, colonIdx);
        const password = creds.slice(colonIdx + 1);
        const val = validateCredentials(email, password);
        if (val.valid) {
          return { authenticated: true, user: { email: val.email, role: 'admin' }, authType: 'basic' };
        }
        return { authenticated: false, error: val.error };
      }
    } catch {}
    return { authenticated: false, error: 'Access Denied: Malformed Basic Authorization header.' };
  }

  // 4. Custom Email & Password Headers (Case-insensitive via Express lowercase headers)
  const headerEmail = headers['x-admin-email'] || headers['x-email'] || headers['admin-email'];
  const headerPassword = headers['x-admin-password'] || headers['x-password'] || headers['admin-password'];

  if (headerEmail || headerPassword) {
    if (!headerEmail || !headerPassword) {
      return { authenticated: false, error: 'Both email and password headers are required.' };
    }
    const val = validateCredentials(headerEmail, headerPassword);
    if (val.valid) {
      return { authenticated: true, user: { email: val.email, role: 'admin' }, authType: 'headers' };
    }
    return { authenticated: false, error: val.error };
  }

  // 5. Body / Query Token
  const bodyToken = req.body?.token || req.query?.token;
  if (bodyToken && typeof bodyToken === 'string') {
    const payload = verifyToken(bodyToken);
    if (payload && ALLOWED_ADMIN_EMAILS.includes(payload.email.toLowerCase())) {
      return { authenticated: true, user: { email: payload.email, role: 'admin' }, authType: 'token' };
    }
    return { authenticated: false, error: 'Access Denied: Invalid or expired token.' };
  }

  // 6. Body Email & Password
  if (req.body?.email && req.body?.password) {
    const val = validateCredentials(req.body.email, req.body.password);
    if (val.valid) {
      return { authenticated: true, user: { email: val.email, role: 'admin' }, authType: 'body' };
    }
    return { authenticated: false, error: val.error };
  }

  // No credentials supplied
  return { authenticated: false, unauthenticated: true, error: 'No authentication credentials provided.' };
}

/**
 * Express middleware to strictly require admin authentication
 */
function requireAdminAuth(req, res, next) {
  const result = authenticateRequest(req);
  if (!result.authenticated) {
    return res.status(401).json({
      success: false,
      error: result.error || 'Access Denied: Authentication required via headers or Bearer token.'
    });
  }
  req.adminUser = result.user;
  req.authType = result.authType;
  next();
}

/**
 * POST /api/auth/login
 * Body: { email: string, password: string } OR Headers: x-admin-email, x-admin-password
 */
router.post('/login', (req, res) => {
  const email = req.headers['x-admin-email'] || req.headers['x-email'] || req.headers['admin-email'] || req.body?.email;
  const password = req.headers['x-admin-password'] || req.headers['x-password'] || req.headers['admin-password'] || req.body?.password;

  const val = validateCredentials(email, password);
  if (!val.valid) {
    logger.warn('Failed login attempt', { email, error: val.error });
    return res.status(401).json({
      success: false,
      error: val.error
    });
  }

  const token = generateToken(val.email);
  logger.info('Admin successfully authenticated', { email: val.email });

  return res.json({
    success: true,
    user: {
      email: val.email,
      role: 'admin'
    },
    token,
    expiresIn: '7d'
  });
});

/**
 * POST /api/auth/verify
 * Supports:
 * - Header: Authorization: Bearer <token>
 * - Headers: x-admin-email & x-admin-password
 * - Body: { token: string }
 */
router.post('/verify', (req, res) => {
  const result = authenticateRequest(req);
  if (!result.authenticated) {
    return res.status(401).json({
      success: false,
      error: result.error || 'Session expired or invalid credentials.'
    });
  }

  return res.json({
    success: true,
    user: result.user,
    authType: result.authType
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

// Export router as primary, and attach helper methods and middleware
router.ALLOWED_ADMIN_EMAILS = ALLOWED_ADMIN_EMAILS;
router.VALID_PASSWORDS = VALID_PASSWORDS;
router.generateToken = generateToken;
router.verifyToken = verifyToken;
router.validateCredentials = validateCredentials;
router.authenticateRequest = authenticateRequest;
router.requireAdminAuth = requireAdminAuth;

module.exports = router;
