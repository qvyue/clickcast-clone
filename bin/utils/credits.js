/**
 * Credits Module
 * Manages user credit balance via Supabase (service role).
 */

const { getAdminClient } = require('./supabase-admin');

/**
 * Log a credit transaction.
 * @param {string} userId
 * @param {number} amount - Positive for grants, negative for deductions
 * @param {number} balanceAfter - Balance after the transaction
 * @param {string} type - 'generation'|'render'|'refund'|'pro_subscription'|'credit_pack'|'monthly_grant'
 * @param {string|null} referenceId - Job ID or Stripe session ID
 */
async function logTransaction(userId, amount, balanceAfter, type, referenceId = null) {
  const supabase = getAdminClient();
  if (!supabase) return;
  try {
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount,
      balance_after: balanceAfter,
      type,
      reference_id: referenceId,
    });
  } catch (e) {
    console.error('[credits] Failed to log transaction:', e.message);
  }
}

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
      .select('balance, total_used')
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
 * Deduct 1 credit with transaction logging.
 * @param {string} userId
 * @param {string} type - 'generation' or 'render'
 * @param {string|null} referenceId - Job ID
 * @returns {Promise<{ success: boolean, balance: number }>}
 */
async function deductCreditWithLog(userId, type, referenceId = null) {
  const result = await deductCredit(userId);
  if (result.success) {
    await logTransaction(userId, -1, result.balance, type, referenceId);
  }
  return result;
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
 * Grant credits with transaction logging.
 * @param {string} userId
 * @param {number} amount
 * @param {string} type - 'pro_subscription'|'credit_pack'|'monthly_grant'|'refund'
 * @param {string|null} referenceId
 * @returns {Promise<number>} New balance
 */
async function grantCreditsWithLog(userId, amount, type, referenceId = null) {
  const newBalance = await grantCredits(userId, amount);
  if (newBalance > 0 || amount > 0) {
    await logTransaction(userId, amount, newBalance, type, referenceId);
  }
  return newBalance;
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

/**
 * Check if a user is in an active trial period.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isTrialUser(userId) {
  const supabase = getAdminClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from('subscriptions')
    .select('status, trial_end')
    .eq('user_id', userId)
    .single();

  if (!data || data.status !== 'trialing') return false;
  if (!data.trial_end) return false;
  return new Date(data.trial_end) > new Date();
}

module.exports = { getUserCredits, deductCredit, grantCredits, ensureCreditRecord, deductCreditWithLog, grantCreditsWithLog, isTrialUser };
