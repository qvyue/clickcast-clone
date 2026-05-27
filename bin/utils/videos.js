/**
 * Videos DB Module
 * Manages user-video associations in Supabase.
 */

const { getAdminClient } = require('./supabase-admin');

/**
 * Upsert a video record for a user.
 * Uses ON CONFLICT to handle re-renders of existing domains.
 * @param {string} userId
 * @param {string} domain
 * @param {string} aspectRatio - 'landscape' | 'portrait'
 * @param {string} storage - 'local' | 'r2'
 */
async function upsertVideo(userId, domain, aspectRatio, storage = 'local') {
  const supabase = getAdminClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('videos')
      .upsert(
        { user_id: userId, domain, aspect_ratio: aspectRatio, storage },
        { onConflict: 'user_id,domain,aspect_ratio' }
      );
    if (error) console.error('[videos] upsert error:', error.message);
  } catch (e) {
    console.error('[videos] upsert exception:', e.message);
  }
}

/**
 * Get all video records for a user.
 * @param {string} userId
 * @returns {Promise<Array<{domain: string, aspect_ratio: string, storage: string, created_at: string}>>}
 */
async function getUserVideos(userId) {
  const supabase = getAdminClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('domain, aspect_ratio, storage, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[videos] getUserVideos error:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[videos] getUserVideos exception:', e.message);
    return [];
  }
}

/**
 * Check if a user owns a video for a given domain.
 * @param {string} userId
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
async function isVideoOwner(userId, domain) {
  const supabase = getAdminClient();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id')
      .eq('user_id', userId)
      .eq('domain', domain)
      .limit(1);
    if (error) return false;
    return (data && data.length > 0);
  } catch (e) {
    return false;
  }
}

/**
 * Delete video records for a user + domain (all aspect ratios).
 * @param {string} userId
 * @param {string} domain
 */
async function deleteVideoRecord(userId, domain) {
  const supabase = getAdminClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('user_id', userId)
      .eq('domain', domain);
    if (error) console.error('[videos] deleteVideoRecord error:', error.message);
  } catch (e) {
    console.error('[videos] deleteVideoRecord exception:', e.message);
  }
}

module.exports = { upsertVideo, getUserVideos, isVideoOwner, deleteVideoRecord };
