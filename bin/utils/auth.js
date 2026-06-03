/**
 * Auth Module - Supabase JWT verification middleware
 *
 * Verifies JWT tokens using Supabase's JWKS endpoint (via jose library).
 * No Supabase client needed — avoids the Node 20 WebSocket crash.
 */

const { jwtVerify, createRemoteJWKSet } = require('jose');

let jwks = null;

/**
 * Get JWKS (JSON Web Key Set) from Supabase.
 * Lazily initialized to avoid crashing if env vars are missing.
 */
function getJWKS() {
  if (jwks) return jwks;

  const url = process.env.SUPABASE_URL;
  if (!url) {
    console.warn('[auth] SUPABASE_URL not set — auth disabled');
    return null;
  }

  // Supabase JWKS endpoint: https://<project>.supabase.co/auth/v1/.well-known/jwks.json
  const jwksUrl = `${url}/auth/v1/.well-known/jwks.json`;
  jwks = createRemoteJWKSet(new URL(jwksUrl));
  console.log('[auth] Supabase JWKS initialized');
  return jwks;
}

/**
 * Verify a Supabase JWT token.
 * @param {string} token - The JWT token
 * @returns {Promise<object|null>} The decoded user payload, or null if invalid
 */
async function verifyToken(token) {
  const keyset = getJWKS();
  if (!keyset) return null;

  try {
    const { payload } = await jwtVerify(token, keyset, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    return payload;
  } catch (e) {
    // Token expired, invalid signature, etc.
    return null;
  }
}

/**
 * Optional auth middleware.
 * Parses JWT from Authorization header if present, sets req.user.
 * Does NOT reject requests without a token.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

/**
 * Required auth middleware.
 * Rejects requests without a valid JWT (401).
 */
async function requireAuth(req, res, next) {
  if (!process.env.SUPABASE_URL) {
    return res.status(503).json({ error: 'Auth not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = payload;
  next();
}

/**
 * Check if Supabase auth is configured.
 */
function isAuthConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

/**
 * Admin auth middleware.
 * Must be used AFTER requireAuth (requires req.user).
 * Checks req.user.sub against ADMIN_USER_IDS env var (comma-separated).
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const adminIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    return res.status(403).json({ error: 'Admin not configured' });
  }

  if (!adminIds.includes(req.user.sub)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

module.exports = { optionalAuth, requireAuth, requireAdmin, isAuthConfigured };
