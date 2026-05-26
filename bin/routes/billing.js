/**
 * Billing Routes
 * Stripe Checkout, subscription management, credits, and webhooks.
 */

const express = require('express');
const { requireAuth } = require('../utils/auth');
const { getStripe, createCheckoutSession, createPortalSession, verifyWebhookSignature } = require('../utils/stripe');
const { getUserCredits, grantCredits, ensureCreditRecord } = require('../utils/credits');
const { getAdminClient } = require('../utils/supabase-admin');

const router = express.Router();

/**
 * Create a Stripe Checkout session.
 * @route POST /api/billing/checkout
 * @body { mode: 'pro' | 'credit_pack' }
 */
router.post('/checkout', requireAuth, async (req, res) => {
  const { mode } = req.body;
  const userId = req.user.sub;

  if (!mode || !['pro', 'credit_pack'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use "pro" or "credit_pack".' });
  }

  const url = await createCheckoutSession(userId, mode);
  if (!url) {
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }

  res.json({ url });
});

/**
 * Get current subscription status.
 * @route GET /api/billing/subscription
 */
router.get('/subscription', requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const supabase = getAdminClient();

  if (!supabase) {
    return res.json({ subscription: null });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, plan, trial_start, trial_end, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return res.json({ subscription: null });
  }

  res.json({ subscription: data });
});

/**
 * Get current credit balance.
 * @route GET /api/billing/credits
 */
router.get('/credits', requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const balance = await getUserCredits(userId);
  res.json({ credits: balance });
});

/**
 * Create a Stripe Customer Portal session.
 * @route POST /api/billing/portal
 */
router.post('/portal', requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const supabase = getAdminClient();

  if (!supabase) {
    return res.status(503).json({ error: 'Billing not configured' });
  }

  // Get stripe_customer_id from subscriptions table
  const { data, error } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (error || !data?.stripe_customer_id) {
    return res.status(404).json({ error: 'No subscription found. Subscribe first.' });
  }

  const url = await createPortalSession(data.stripe_customer_id);
  if (!url) {
    return res.status(500).json({ error: 'Failed to create portal session' });
  }

  res.json({ url });
});

/**
 * Stripe Webhook handler.
 * Receives raw body for signature verification.
 * @route POST /api/billing/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const event = verifyWebhookSignature(req.body, signature);

  if (!event) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log('[billing-webhook] Event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log('[billing-webhook] Unhandled event:', event.type);
    }
  } catch (e) {
    console.error('[billing-webhook] Error processing event:', e.message);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  res.json({ received: true });
});

// --- Webhook Handlers ---

/**
 * Handle checkout.session.completed
 * - Subscription: create subscription record + grant 30 credits
 * - Payment (credit pack): grant 3 credits
 */
async function handleCheckoutComplete(session) {
  const userId = session.client_reference_id;
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const mode = session.mode;

  if (!userId) {
    console.error('[billing-webhook] No client_reference_id in session');
    return;
  }

  const supabase = getAdminClient();
  if (!supabase) return;

  if (mode === 'subscription') {
    // Retrieve subscription details from Stripe for trial info
    const stripe = getStripe();
    let trialStart = null;
    let trialEnd = null;
    let periodStart = null;
    let periodEnd = null;
    let status = 'active';

    if (stripe && subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      status = sub.status; // 'trialing' or 'active'
      if (sub.trial_start) trialStart = new Date(sub.trial_start * 1000).toISOString();
      if (sub.trial_end) trialEnd = new Date(sub.trial_end * 1000).toISOString();
      if (sub.current_period_start) periodStart = new Date(sub.current_period_start * 1000).toISOString();
      if (sub.current_period_end) periodEnd = new Date(sub.current_period_end * 1000).toISOString();
    }

    // Upsert subscription record
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status,
        plan: 'pro',
        trial_start: trialStart,
        trial_end: trialEnd,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[billing-webhook] Upsert subscription error:', error.message);
    }

    // Grant 30 credits
    const newBalance = await grantCredits(userId, 30);
    console.log(`[billing-webhook] Pro subscription created for ${userId}, credits: ${newBalance}`);
  }

  if (mode === 'payment') {
    // Credit pack purchase — find user by client_reference_id
    // Ensure subscription record exists (for stripe_customer_id tracking)
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (!existing && customerId) {
      // Create a minimal subscription record to track the customer
      const { error: insertErr } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          stripe_customer_id: customerId,
          status: 'inactive',
          plan: 'free',
        });
      if (insertErr) {
        console.error('[billing-webhook] Insert subscription record error:', insertErr.message, insertErr.code);
      }
    } else if (!existing && !customerId) {
      console.error('[billing-webhook] Credit Pack: no customer_id in session, skipping subscription record');
    }

    // Grant 3 credits
    const newBalance = await grantCredits(userId, 3);
    console.log(`[billing-webhook] Credit pack purchased for ${userId}, credits: ${newBalance}`);
  }
}

/**
 * Handle customer.subscription.updated
 * - Update status, period, cancel_at_period_end
 * - If new billing period started, grant 30 credits
 */
async function handleSubscriptionUpdated(subscription) {
  const subscriptionId = subscription.id;
  const supabase = getAdminClient();
  if (!supabase) return;

  // Get existing record to detect period change
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('user_id, current_period_start')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!existing) return;

  const newPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodChanged = existing.current_period_start && newPeriodStart !== existing.current_period_start;

  const updateData = {
    status: subscription.status,
    current_period_start: newPeriodStart,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  };

  if (subscription.trial_start) {
    updateData.trial_start = new Date(subscription.trial_start * 1000).toISOString();
  }
  if (subscription.trial_end) {
    updateData.trial_end = new Date(subscription.trial_end * 1000).toISOString();
  }

  await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', subscriptionId);

  // New billing period — grant 30 credits
  if (periodChanged) {
    const newBalance = await grantCredits(existing.user_id, 30);
    console.log(`[billing-webhook] New billing period for ${existing.user_id}, credits: ${newBalance}`);
  }
}

/**
 * Handle customer.subscription.deleted
 */
async function handleSubscriptionDeleted(subscription) {
  const subscriptionId = subscription.id;
  const supabase = getAdminClient();
  if (!supabase) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      plan: 'free',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`[billing-webhook] Subscription canceled: ${subscriptionId}`);
}

/**
 * Handle invoice.payment_failed
 */
async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const supabase = getAdminClient();
  if (!supabase) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`[billing-webhook] Payment failed for subscription: ${subscriptionId}`);
}

module.exports = router;
