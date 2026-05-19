/**
 * Auth Module - Supabase JWT verification middleware
 *
 * Provides optional and required auth middleware for Express routes.
 * Uses Supabase service role key to verify JWT tokens from the frontend.
 */

const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;

/**
 * Get Supabase admin client (service role).
 * Lazily initialized to avoid crashing if env vars are missing.
 */
function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn('[auth] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — auth disabled');
    return null;
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    realtime: { enabled: false },  // No WebSocket needed on server side
  });
  console.log('[auth] Supabase admin client initialized');
  return supabaseAdmin;
}

/**
 * Optional auth middleware.
 * Parses JWT from Authorization header if present, sets req.user.
 * Does NOT reject requests without a token.
 */
async function optionalAuth(req, res, next) {
  const admin = getSupabaseAdmin();
  if (!admin) return next();

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (user && !error) {
        req.user = user;
      }
    } catch (e) {
      // Token invalid — just skip
    }
  }

  next();
}

/**
 * Required auth middleware.
 * Rejects requests without a valid JWT (401).
 */
async function requireAuth(req, res, next) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'Auth not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Check if Supabase auth is configured.
 */
function isAuthConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

module.exports = { optionalAuth, requireAuth, isAuthConfigured, getSupabaseAdmin };
