/**
 * Credits Module
 * Manages user credit balance via Supabase (service role).
 */

const { getAdminClient } = require('./supabase-admin');

/**
 * Get user's current credit balance.
 * @param {string} userId - Supabase auth user ID
 * @returns {Promise<number>} Current balance (0 if no record)
 */
async function getUserCredits(userId) {
  const supabase = getAdminClient();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (error || !data) return 0;
  return data.balance;
}

/**
 * Deduct 1 credit from user's balance.
 * Atomic operation — only succeeds if balance > 0.
 * @param {string} userId
 * @returns {Promise<{ success: boolean, balance: number }>}
 */
async function deductCredit(userId) {
  const supabase = getAdminClient();
  if (!supabase) return { success: false, balance: 0 };

  // Ensure record exists
  await ensureCreditRecord(userId);

  // Atomic decrement — only if balance > 0
  const { data, error } = await supabase.rpc('deduct_credit', { p_user_id: userId });

  if (error) {
    // Fallback: manual update if RPC not created yet
    const { data: current } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (!current || current.balance <= 0) {
      return { success: false, balance: 0 };
    }

    const { data: updated } = await supabase
      .from('credits')
      .update({ balance: current.balance - 1, total_used: current.total_used + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('balance')
      .single();

    return { success: true, balance: updated?.balance ?? 0 };
  }

  return { success: data.success, balance: data.balance };
}

/**
 * Grant credits to a user.
 * @param {string} userId
 * @param {number} amount - Credits to add
 * @returns {Promise<number>} New balance
 */
async function grantCredits(userId, amount) {
  const supabase = getAdminClient();
  if (!supabase) return 0;

  await ensureCreditRecord(userId);

  const { data: current } = await supabase
    .from('credits')
    .select('balance, total_granted')
    .eq('user_id', userId)
    .single();

  if (!current) return 0;

  const { data: updated } = await supabase
    .from('credits')
    .update({
      balance: current.balance + amount,
      total_granted: current.total_granted + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('balance')
    .single();

  return updated?.balance ?? 0;
}

/**
 * Ensure a credits row exists for the user (balance defaults to 0).
 * @param {string} userId
 */
async function ensureCreditRecord(userId) {
  const supabase = getAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from('credits')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  if (!data) {
    await supabase
      .from('credits')
      .insert({ user_id: userId, balance: 0, total_granted: 0, total_used: 0 });
  }
}

module.exports = { getUserCredits, deductCredit, grantCredits, ensureCreditRecord };
