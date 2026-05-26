/**
 * Supabase Admin Client
 * Uses PostgREST directly (no WebSocket dependency) with service role key to bypass RLS.
 */

const { PostgrestClient } = require('@supabase/postgrest-js');

let adminClient = null;

/**
 * Get Supabase admin client (service role, bypasses RLS).
 * Uses PostgREST directly — no realtime/WebSocket dependency.
 * Lazily initialized to avoid crash if env vars missing.
 * @returns {PostgrestClient|null}
 */
function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn('[supabase-admin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return null;
  }

  adminClient = new PostgrestClient(`${url}/rest/v1`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    schema: 'public',
  });

  console.log('[supabase-admin] PostgREST client initialized (no realtime)');
  return adminClient;
}

module.exports = { getAdminClient };
