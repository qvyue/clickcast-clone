/**
 * Supabase Admin Client
 * Uses service role key to bypass RLS for webhook and credit operations.
 */

const { createClient } = require('@supabase/supabase-js');

let adminClient = null;

/**
 * Get Supabase admin client (service role, bypasses RLS).
 * Lazily initialized to avoid crash if env vars missing.
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn('[supabase-admin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return null;
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('[supabase-admin] Service role client initialized');
  return adminClient;
}

module.exports = { getAdminClient };
