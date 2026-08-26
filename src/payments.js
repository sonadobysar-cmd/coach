import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export function paymentsConfigured(env = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID
    && env.STRIPE_WEBHOOK_SECRET && env.DATABASE_URL && (env.NEON_AUTH_JWKS_URL || env.NEON_AUTH_URL));
}

export function isOwnerMember(member, env = process.env) {
  const userId = String(member?.id || '').trim().toLowerCase();
  const email = String(member?.email || '').trim().toLowerCase();
  const allowedUserIds = csvSet(env.ELITEA_OWNER_USER_IDS);
  if (userId && allowedUserIds.has(userId)) return true;
  const allowedEmails = csvSet(env.ELITEA_OWNER_EMAILS);
  return Boolean(member?.emailVerified && email && allowedEmails.has(email));
}

function csvSet(value) {
  return new Set(String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean));
}

export async function verifyMemberAuthorization(header, env = process.env) {
  const token = String(header || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw unauthorized();
  const jwksUrl = env.NEON_AUTH_JWKS_URL || `${String(env.NEON_AUTH_URL || '').replace(/\/$/, '')}/.well-known/jwks.json`;
  if (!/^https:\/\//.test(jwksUrl)) throw unauthorized();
  const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL(jwksUrl)));
  if (!payload.sub || !/^[0-9a-f-]{36}$/i.test(payload.sub)) throw unauthorized();
  return {
    id: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    emailVerified: payload.email_verified === true || payload.emailVerified === true,
  };
}

export async function createMembershipCheckout(member, email, options = {}, env = process.env) {
  if (!paymentsConfigured(env)) throw notConfigured();
  const planCode = options.planCode === 'founding30' ? 'founding30' : 'standard';
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create(checkoutSessionParams(member, email, { planCode }, env), {
    idempotencyKey: `elitea-checkout-${planCode}-${member.id}`,
  });
  return { url: session.url };
}

export function checkoutSessionParams(member, email, options = {}, env = process.env) {
  const safeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') ? email.toLowerCase() : member.email;
  const planCode = options.planCode === 'founding30' ? 'founding30' : 'standard';
  const coupon = env.STRIPE_FOUNDING_COUPON_ID || env.STRIPE_INTRO_COUPON_ID;
  if (planCode === 'founding30' && !coupon) {
    throw Object.assign(new Error('Testerská cena zatím není připojená.'), { statusCode: 503 });
  }
  const params = {
    mode: 'subscription',
    payment_method_collection: 'always',
    customer_email: safeEmail || undefined,
    client_reference_id: member.id,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { eliteaUserId: member.id, planCode: planCode === 'founding30' ? 'elitea-founding30' : 'elitea-standard' },
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    },
    success_url: `${env.PUBLIC_APP_URL || 'https://elitea.cz'}/?checkout=success#app-member`,
    cancel_url: `${env.PUBLIC_APP_URL || 'https://elitea.cz'}/?checkout=cancelled#membership`,
    locale: 'cs',
    metadata: { eliteaUserId: member.id, planCode: planCode === 'founding30' ? 'elitea-founding30' : 'elitea-standard' },
  };
  if (planCode === 'founding30') params.discounts = [{ coupon }];
  if (env.STRIPE_COLLECT_TERMS !== 'false') params.consent_collection = { terms_of_service: 'required' };
  return params;
}

export async function createMembershipPortal(member, env = process.env) {
  if (!paymentsConfigured(env)) throw notConfigured();
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT provider_customer_id FROM memberships WHERE user_id = ${member.id}::uuid LIMIT 1`;
  const customer = rows[0]?.provider_customer_id;
  if (!customer) throw Object.assign(new Error('Platební profil zatím nebyl nalezen.'), { statusCode: 404 });
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create(portalSessionParams(customer, env));
  return { url: session.url };
}

export function portalSessionParams(customer, env = process.env) {
  return {
    customer,
    return_url: `${env.PUBLIC_APP_URL || 'https://elitea.cz'}/#app-member`,
    ...(env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: env.STRIPE_PORTAL_CONFIGURATION_ID } : {}),
  };
}

export async function membershipFor(member, env = process.env) {
  if (isOwnerMember(member, env)) {
    return { status: 'owner', plan_code: 'elitea-owner', current_period_end: null, cancel_at_period_end: false };
  }
  if (!env.DATABASE_URL) return { status: 'inactive' };
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT status, plan_code, current_period_end, cancel_at_period_end FROM memberships WHERE user_id = ${member.id}::uuid LIMIT 1`;
  return rows[0] || { status: 'inactive' };
}

export async function handleStripeWebhook(rawBody, signature, env = process.env) {
  if (!paymentsConfigured(env)) throw notConfigured();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await persistSubscription(subscription, session.client_reference_id || session.metadata?.eliteaUserId, env);
  }
  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const subscription = event.data.object;
    await persistSubscription(subscription, subscription.metadata?.eliteaUserId, env);
  }
  return { received: true };
}

async function persistSubscription(subscription, userId, env) {
  if (!/^[0-9a-f-]{36}$/i.test(userId || '')) return;
  const sql = neon(env.DATABASE_URL);
  const status = normalizeStripeStatus(subscription.status);
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
  const planCode = subscription.metadata?.planCode === 'elitea-founding30' ? 'elitea-founding30' : 'elitea-standard';
  await sql`INSERT INTO member_profiles (user_id) VALUES (${userId}::uuid) ON CONFLICT (user_id) DO NOTHING`;
  await sql`INSERT INTO memberships (user_id, provider, provider_customer_id, provider_subscription_id, plan_code, status, current_period_end, cancel_at_period_end, updated_at)
    VALUES (${userId}::uuid, 'stripe', ${String(subscription.customer)}, ${subscription.id}, ${planCode}, ${status}, ${periodEnd}::timestamptz, ${Boolean(subscription.cancel_at_period_end)}, now())
    ON CONFLICT (user_id) DO UPDATE SET provider_customer_id=EXCLUDED.provider_customer_id, provider_subscription_id=EXCLUDED.provider_subscription_id,
      plan_code=EXCLUDED.plan_code, status=EXCLUDED.status, current_period_end=EXCLUDED.current_period_end,
      cancel_at_period_end=EXCLUDED.cancel_at_period_end, updated_at=now()`;
  if (planCode === 'elitea-founding30' && ['trialing', 'active'].includes(status)) {
    await sql`UPDATE founding_applications SET status='active', user_id=${userId}::uuid,
      activated_at=COALESCE(activated_at, now()), updated_at=now()
      WHERE user_id=${userId}::uuid AND status IN ('approved','active')`;
  }
}

function normalizeStripeStatus(status) {
  return { trialing: 'trialing', active: 'active', past_due: 'past_due', paused: 'paused', canceled: 'cancelled', unpaid: 'cancelled', incomplete_expired: 'cancelled', incomplete: 'inactive' }[status] || 'inactive';
}

function unauthorized() { return Object.assign(new Error('Přihlášení není platné.'), { statusCode: 401 }); }
function notConfigured() { return Object.assign(new Error('Platební brána zatím není připojená.'), { statusCode: 503 }); }
