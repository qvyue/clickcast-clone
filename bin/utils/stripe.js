/**
 * Stripe Module
 * Initializes Stripe SDK and provides Checkout/Portal helpers.
 */

const Stripe = require('stripe');

let stripeInstance = null;

/**
 * Get Stripe instance (lazy init).
 * @returns {Stripe|null}
 */
function getStripe() {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn('[stripe] STRIPE_SECRET_KEY not set — billing disabled');
    return null;
  }

  stripeInstance = new Stripe(key, {
    apiVersion: '2025-04-30.basil',
  });

  console.log('[stripe] Initialized in', key.startsWith('sk_test_') ? 'TEST' : 'LIVE', 'mode');
  return stripeInstance;
}

/**
 * Create a Stripe Checkout Session.
 * @param {string} userId - Supabase user ID (used as client_reference_id)
 * @param {string} mode - 'pro' (subscription) or 'credit_pack' (one-time payment)
 * @returns {Promise<string|null>} Checkout session URL, or null on error
 */
async function createCheckoutSession(userId, mode) {
  const stripe = getStripe();
  if (!stripe) return null;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (mode === 'pro') {
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      console.error('[stripe] STRIPE_PRO_PRICE_ID not set');
      return null;
    }

    // 2-day free trial
    const trialEnd = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      subscription_data: {
        trial_end: trialEnd,
      },
      success_url: `${appUrl}/?checkout_success=true`,
      cancel_url: `${appUrl}/?checkout_cancel=true`,
    });

    return session.url;
  }

  if (mode === 'credit_pack') {
    const priceId = process.env.STRIPE_CREDIT_PACK_PRICE_ID;
    if (!priceId) {
      console.error('[stripe] STRIPE_CREDIT_PACK_PRICE_ID not set');
      return null;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      success_url: `${appUrl}/?checkout_success=true`,
      cancel_url: `${appUrl}/?checkout_cancel=true`,
    });

    return session.url;
  }

  console.error('[stripe] Unknown checkout mode:', mode);
  return null;
}

/**
 * Create a Stripe Customer Portal session.
 * @param {string} stripeCustomerId
 * @returns {Promise<string|null>} Portal session URL
 */
async function createPortalSession(stripeCustomerId) {
  const stripe = getStripe();
  if (!stripe) return null;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/`,
    });
    return session.url;
  } catch (e) {
    console.error('[stripe] Portal session error:', e.message);
    return null;
  }
}

/**
 * Verify Stripe webhook signature.
 * @param {string|Buffer} rawBody - Raw request body
 * @param {string} signature - Stripe-Signature header
 * @returns {Stripe.Event|null} Verified event, or null
 */
function verifyWebhookSignature(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) return null;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET not set');
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    console.error('[stripe] Webhook signature verification failed:', e.message);
    return null;
  }
}

module.exports = { getStripe, createCheckoutSession, createPortalSession, verifyWebhookSignature };
