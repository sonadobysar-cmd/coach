import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { rememberMemberContact } from './lifecycle-email.js';

const CHECKOUT_TTL_MS = 60 * 60 * 1000;

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

export async function createMembershipCheckout(member, email, options = {}, env = process.env, dependencies = {}) {
  if (!paymentsConfigured(env)) throw notConfigured();
  const rememberContact = dependencies.rememberMemberContact || rememberMemberContact;
  await rememberContact({ ...member, email: email || member.email }, env);
  const planCode = options.planCode === 'founding30' ? 'founding30' : 'standard';
  const sql = dependencies.sql || (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const rows = await sql`SELECT provider_customer_id, provider_subscription_id, status, trial_consumed_at, updated_at
    FROM memberships WHERE user_id=${member.id}::uuid LIMIT 1`;
  const membership = rows[0] || null;
  if (membershipBlocksCheckout(membership)) {
    throw Object.assign(new Error('Tento účet už má předplatné. Otevři jeho správu v členském účtu.'), {
      statusCode: 409,
      code: 'MEMBERSHIP_ALREADY_EXISTS',
    });
  }
  const checkoutEmail = checkoutContactEmail(email, member.email);
  const nowMs = Number((dependencies.now || Date.now)());
  const requestedIntentId = (dependencies.randomUUID || randomUUID)();
  const requestedExpiresAt = new Date(nowMs + CHECKOUT_TTL_MS).toISOString();
  const claimed = await sql`INSERT INTO membership_checkout_intents (
      user_id, intent_id, plan_code, checkout_email, status, expires_at, created_at, updated_at
    ) VALUES (
      ${member.id}::uuid, ${requestedIntentId}::uuid, ${planCode}, ${checkoutEmail}, 'creating', ${requestedExpiresAt}::timestamptz, now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      intent_id=EXCLUDED.intent_id,
      plan_code=EXCLUDED.plan_code,
      checkout_email=EXCLUDED.checkout_email,
      status='creating',
      stripe_session_id=NULL,
      checkout_url=NULL,
      expires_at=EXCLUDED.expires_at,
      created_at=now(),
      updated_at=now()
    WHERE membership_checkout_intents.expires_at <= now()
       OR membership_checkout_intents.status='failed'
    RETURNING intent_id, plan_code, checkout_email, status, stripe_session_id, checkout_url, expires_at`;
  const intent = claimed[0] || (await sql`SELECT intent_id, plan_code, checkout_email, status, stripe_session_id, checkout_url, expires_at
    FROM membership_checkout_intents WHERE user_id=${member.id}::uuid LIMIT 1`)[0];
  if (!intent) throw checkoutConflict('Platební relaci se nepodařilo bezpečně založit. Zkus to prosím znovu.');
  if (intent.plan_code !== planCode) {
    throw checkoutConflict('Pro tento účet už je otevřený jiný platební krok. Dokonči ho, nebo počkej na jeho vypršení.');
  }
  if (intent.status === 'completed') {
    throw checkoutConflict('Tato platební relace už byla dokončena. Obnov stav členství nebo otevři jeho správu.');
  }
  if (intent.status === 'open' && intent.checkout_url) return { url: intent.checkout_url };

  const checkoutExpiresAt = unixSeconds(intent.expires_at);
  if (!checkoutExpiresAt || checkoutExpiresAt * 1000 <= nowMs) {
    throw checkoutConflict('Předchozí platební relace právě vypršela. Zkus to prosím znovu.');
  }
  const stripe = dependencies.stripe || new Stripe(env.STRIPE_SECRET_KEY);
  const trialEligible = !membership?.trial_consumed_at;
  const session = await stripe.checkout.sessions.create(checkoutSessionParams(member, intent.checkout_email, {
    planCode,
    trialEligible,
    customerId: membership?.provider_customer_id || '',
    expiresAt: checkoutExpiresAt,
  }, env), {
    idempotencyKey: checkoutIdempotencyKey(member.id, intent.intent_id),
  });
  const sessionExpiresAt = Number.isFinite(Number(session.expires_at)) && Number(session.expires_at) > 0
    ? new Date(Number(session.expires_at) * 1000).toISOString()
    : intent.expires_at;
  await sql`UPDATE membership_checkout_intents SET
      status='open', stripe_session_id=${session.id || null}, checkout_url=${session.url || ''},
      expires_at=${sessionExpiresAt}::timestamptz, updated_at=now()
    WHERE user_id=${member.id}::uuid AND intent_id=${intent.intent_id}::uuid`;
  return { url: session.url };
}

export function membershipBlocksCheckout(membership) {
  return Boolean(membership?.provider_subscription_id
    && membership.status !== 'cancelled');
}

export function checkoutIdempotencyKey(userId, intentId) {
  const safeUserId = String(userId || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  const safeIntentId = String(intentId || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  return `elitea-checkout-${safeUserId}-${safeIntentId}`;
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
    ...(options.customerId ? { customer: options.customerId } : { customer_email: safeEmail || undefined }),
    client_reference_id: member.id,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: {
      metadata: { eliteaUserId: member.id, planCode: planCode === 'founding30' ? 'elitea-founding30' : 'elitea-standard' },
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    },
    success_url: `${env.PUBLIC_APP_URL || 'https://elitea.cz'}/?checkout=success#app-member`,
    cancel_url: `${env.PUBLIC_APP_URL || 'https://elitea.cz'}/?checkout=cancelled#membership`,
    locale: 'cs',
    metadata: { eliteaUserId: member.id, planCode: planCode === 'founding30' ? 'elitea-founding30' : 'elitea-standard' },
  };
  if (Number.isInteger(options.expiresAt) && options.expiresAt > 0) params.expires_at = options.expiresAt;
  if (options.trialEligible !== false) params.subscription_data.trial_period_days = 7;
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
  return normalizeMembershipAccess(rows[0] || { status: 'inactive' });
}

export function normalizeMembershipAccess(membership = {}, now = Date.now()) {
  if (!['trialing', 'active'].includes(membership.status)) return membership;
  const periodEnd = new Date(membership.current_period_end || '').getTime();
  if (!Number.isFinite(periodEnd) || periodEnd <= now) {
    return { ...membership, status: 'inactive' };
  }
  return membership;
}

export async function handleStripeWebhook(rawBody, signature, env = process.env, dependencies = {}) {
  if (!paymentsConfigured(env)) throw notConfigured();
  const stripe = dependencies.stripe || new Stripe(env.STRIPE_SECRET_KEY);
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  const relevant = event.type === 'checkout.session.completed'
    || ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type);
  if (!relevant) return { received: true };
  const sql = dependencies.sql || (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const claimed = await sql`INSERT INTO stripe_webhook_events (event_id, event_type, event_created, status)
    VALUES (${event.id}, ${event.type}, ${Number(event.created || 0)}, 'processing')
    ON CONFLICT (event_id) DO UPDATE SET
      event_type=EXCLUDED.event_type,
      event_created=EXCLUDED.event_created,
      status='processing',
      received_at=now(),
      processed_at=NULL
    WHERE stripe_webhook_events.status='processing'
      AND stripe_webhook_events.received_at <= now() - interval '10 minutes'
    RETURNING event_id`;
  if (!claimed.length) return { received: true, duplicate: true };
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await persistSubscription(subscription, session.client_reference_id || session.metadata?.eliteaUserId, env,
        session.customer_details?.email || session.customer_email || '', Number(event.created || 0), {
          sql,
          rememberMemberContact: dependencies.rememberMemberContact,
        });
      await sql`UPDATE membership_checkout_intents SET status='completed', updated_at=now()
        WHERE stripe_session_id=${session.id} AND status IN ('creating','open')`;
    }
    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      const eventSubscription = event.data.object;
      const subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
      await persistSubscription(subscription, subscription.metadata?.eliteaUserId || eventSubscription.metadata?.eliteaUserId,
        env, '', Number(event.created || 0), { sql, rememberMemberContact: dependencies.rememberMemberContact });
    }
    await sql`UPDATE stripe_webhook_events SET status='processed', processed_at=now() WHERE event_id=${event.id}`;
  } catch (error) {
    // A failed claim is released so Stripe's signed retry can safely process it.
    await sql`DELETE FROM stripe_webhook_events WHERE event_id=${event.id} AND status='processing'`.catch(() => {});
    throw error;
  }
  return { received: true };
}

async function persistSubscription(subscription, userId, env, contactEmail = '', eventCreated = 0, dependencies = {}) {
  const sql = dependencies.sql || (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  let resolvedUserId = /^[0-9a-f-]{36}$/i.test(userId || '') ? userId : '';
  if (!resolvedUserId && subscription?.id) {
    const linked = await sql`SELECT user_id::text AS user_id FROM memberships
      WHERE provider_subscription_id=${subscription.id} LIMIT 1`;
    resolvedUserId = linked[0]?.user_id || '';
  }
  if (!/^[0-9a-f-]{36}$/i.test(resolvedUserId)) {
    const error = new Error('Stripe subscription nelze bezpečně přiřadit k účtu Elitea.');
    error.code = 'STRIPE_SUBSCRIPTION_USER_MISSING';
    error.statusCode = 409;
    throw error;
  }
  const status = normalizeStripeStatus(subscription.status);
  const periodEndEpoch = stripeSubscriptionPeriodEnd(subscription);
  const periodEnd = periodEndEpoch ? new Date(periodEndEpoch * 1000).toISOString() : null;
  const planCode = subscription.metadata?.planCode === 'elitea-founding30' ? 'elitea-founding30' : 'elitea-standard';
  const usedTrial = Boolean(subscription.trial_start || subscription.trial_end || subscription.status === 'trialing');
  const customerId = stripeObjectId(subscription.customer);
  await sql`INSERT INTO member_profiles (user_id) VALUES (${resolvedUserId}::uuid) ON CONFLICT (user_id) DO NOTHING`;
  const applied = await sql`INSERT INTO memberships (user_id, provider, provider_customer_id, provider_subscription_id, plan_code, status, current_period_end, cancel_at_period_end, trial_consumed_at, provider_event_created_at, updated_at)
    VALUES (${resolvedUserId}::uuid, 'stripe', ${customerId}, ${subscription.id}, ${planCode}, ${status}, ${periodEnd}::timestamptz, ${Boolean(subscription.cancel_at_period_end)}, ${usedTrial ? new Date().toISOString() : null}::timestamptz, ${eventCreated}, now())
    ON CONFLICT (user_id) DO UPDATE SET provider_customer_id=EXCLUDED.provider_customer_id, provider_subscription_id=EXCLUDED.provider_subscription_id,
      plan_code=EXCLUDED.plan_code, status=EXCLUDED.status, current_period_end=EXCLUDED.current_period_end,
      cancel_at_period_end=EXCLUDED.cancel_at_period_end,
      trial_consumed_at=COALESCE(memberships.trial_consumed_at, EXCLUDED.trial_consumed_at),
      provider_event_created_at=EXCLUDED.provider_event_created_at, updated_at=now()
    WHERE memberships.provider_event_created_at IS NULL
       OR memberships.provider_event_created_at <= EXCLUDED.provider_event_created_at
    RETURNING user_id`;
  if (applied.length && planCode === 'elitea-founding30' && ['trialing', 'active'].includes(status)) {
    await sql`UPDATE founding_applications SET status='active', user_id=${resolvedUserId}::uuid,
      activated_at=COALESCE(activated_at, now()), updated_at=now()
      WHERE user_id=${resolvedUserId}::uuid AND status IN ('approved','active')`;
  }
  const rememberContact = dependencies.rememberMemberContact || rememberMemberContact;
  if (applied.length && contactEmail) await rememberContact({ id: resolvedUserId, email: contactEmail }, env);
  return { applied: Boolean(applied.length), userId: resolvedUserId };
}

export function stripeSubscriptionPeriodEnd(subscription = {}) {
  const trialEnd = positiveEpoch(subscription.status === 'trialing' ? subscription.trial_end : null);
  if (trialEnd) return trialEnd;
  const itemEnds = Array.isArray(subscription.items?.data)
    ? subscription.items.data.map(item => positiveEpoch(item?.current_period_end)).filter(Boolean)
    : [];
  if (itemEnds.length) return Math.max(...itemEnds);
  return positiveEpoch(subscription.current_period_end);
}

function checkoutContactEmail(primary, fallback) {
  const candidate = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary || '') ? primary : fallback;
  return String(candidate || '').trim().toLowerCase().slice(0, 254);
}

function positiveEpoch(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function unixSeconds(value) {
  const timestamp = new Date(value || '').getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp / 1000) : 0;
}

function stripeObjectId(value) {
  return typeof value === 'string' ? value : String(value?.id || '');
}

function checkoutConflict(message) {
  return Object.assign(new Error(message), { statusCode: 409, code: 'CHECKOUT_ALREADY_IN_PROGRESS' });
}

function normalizeStripeStatus(status) {
  return { trialing: 'trialing', active: 'active', past_due: 'past_due', paused: 'paused', canceled: 'cancelled', unpaid: 'cancelled', incomplete_expired: 'cancelled', incomplete: 'inactive' }[status] || 'inactive';
}

function unauthorized() { return Object.assign(new Error('Přihlášení není platné.'), { statusCode: 401 }); }
function notConfigured() { return Object.assign(new Error('Platební brána zatím není připojená.'), { statusCode: 503 }); }
