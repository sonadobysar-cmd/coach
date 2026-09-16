import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, createHash } from 'node:crypto';
import { generateText } from 'ai';
import { neon } from '@neondatabase/serverless';

export const aiMeterContext = new AsyncLocalStorage();
// USD/token, Gateway catalogue snapshot 2026-09-15. Unknown models are NOT free.
export const AI_RATES = Object.freeze({
  'openai/gpt-5.6-luna': { input: .2e-6, cached: .02e-6, write: .25e-6, output: 1.2e-6 },
  'openai/gpt-5.6-sol': { input: 2e-6, cached: .2e-6, write: 2.5e-6, output: 10e-6 },
  'openai/gpt-5.6-terra': { input: 2e-6, cached: .2e-6, write: 2.5e-6, output: 12e-6 },
});

export function resolveAiCallTimeoutMs(value = process.env.ELITEA_AI_CALL_TIMEOUT_MS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 90_000;
  return Math.max(20_000, Math.min(180_000, Math.round(parsed)));
}

// Provider failures are observable without logging prompts, responses, secret
// values or raw upstream bodies. These stable categories let production QA
// distinguish authentication/configuration failures from capacity and timeout
// incidents instead of silently collapsing everything into a local fallback.
export function summarizeAiFailure(error) {
  if (!error) return { errorCategory: null, errorName: null, errorStatusCode: null, errorCode: null };
  const name = String(error?.name || error?.constructor?.name || 'Error').slice(0, 96);
  const message = String(error?.message || '');
  const statusCandidate = error?.statusCode ?? error?.status ?? error?.response?.status ?? error?.cause?.statusCode ?? error?.cause?.status;
  const parsedStatus = Number(statusCandidate);
  const statusCode = Number.isInteger(parsedStatus) && parsedStatus >= 100 && parsedStatus <= 599
    ? parsedStatus
    : null;
  const code = typeof error?.code === 'string' && /^[A-Z0-9_.:-]{1,96}$/i.test(error.code)
    ? error.code
    : null;
  const fingerprint = `${name} ${code || ''} ${message}`.toLowerCase();
  let category = 'provider_error';
  if (statusCode === 401 || /auth|unauthenticated|api.gateway.api.key|oidc|credential/.test(fingerprint)) category = 'authentication';
  else if (statusCode === 402 || /credit|payment|billing|balance/.test(fingerprint)) category = 'billing';
  else if (statusCode === 403 || /forbidden|permission|access.denied/.test(fingerprint)) category = 'authorization';
  else if (statusCode === 404 || /model.not.found|unknown.model/.test(fingerprint)) category = 'model_not_found';
  else if (statusCode === 408 || /timeout|timed.out|abort/.test(fingerprint)) category = 'timeout';
  else if (statusCode === 429 || /rate.limit|capacity|overload/.test(fingerprint)) category = 'capacity';
  else if (statusCode === 400 || /invalid.request|validation|schema/.test(fingerprint)) category = 'invalid_request';
  else if (statusCode && statusCode >= 500) category = 'provider_unavailable';
  return {
    errorCategory: category,
    errorName: name,
    errorStatusCode: statusCode,
    errorCode: code,
  };
}

const INTERNAL_AI_ERROR_CODES = new Set([
  'AI_USAGE_LIMIT_REACHED',
  'COACHING_QUALITY_FAIL_CLOSED',
  'RELEASE_EVALUATION_SCOPE',
  'RELEASE_RECEIPT_NOT_CONFIGURED_OR_FAILED',
  'ACADEMY_RELEASE_RECEIPT_NOT_CONFIGURED_OR_FAILED',
]);

// Convert only recognizable upstream AI failures to a stable, Czech client
// message. Raw provider bodies can contain account, billing and request data;
// they belong in privacy-safe telemetry, never in the member response.
export function publicAiProviderError(error) {
  if (!error) return null;
  const summary = summarizeAiFailure(error);
  const code = String(error?.code || '');
  if (INTERNAL_AI_ERROR_CODES.has(code)) return null;

  const chain = [error, error?.cause, error?.lastError, ...(Array.isArray(error?.errors) ? error.errors.slice(0, 3) : [])]
    .filter(Boolean);
  const fingerprint = chain
    .map(value => `${value?.name || ''} ${value?.code || ''} ${value?.message || ''}`)
    .join(' ')
    .toLowerCase();
  const recognizableProviderFailure = [402, 408, 429].includes(summary.errorStatusCode)
    || /gateway|api.?call.?error|retryerror|ai_gateway|positive credit balance|provider unavailable|model not found/.test(fingerprint);
  if (!recognizableProviderFailure) return null;

  if (summary.errorCategory === 'capacity') {
    return {
      statusCode: 429,
      code: 'AI_PROVIDER_CAPACITY',
      message: 'Kapacita AI modelu je teď dočasně vyčerpaná. Zkus odpověď znovu za chvíli.',
    };
  }
  if (summary.errorCategory === 'timeout') {
    return {
      statusCode: 504,
      code: 'AI_PROVIDER_TIMEOUT',
      message: 'AI odpověď se tentokrát nestihla dokončit. Zkus ji prosím znovu.',
    };
  }
  return {
    statusCode: 503,
    code: 'AI_PROVIDER_UNAVAILABLE',
    message: 'Elitea se teď nemůže spojit s AI modelem. Zkus odpověď prosím znovu za chvíli.',
  };
}
export function priceUsage(model, usage) {
  const rates = AI_RATES[model];
  const input = usage?.inputTokens, output = usage?.outputTokens;
  if (!rates || !Number.isFinite(input) || !Number.isFinite(output)) return null;
  // outputTokens includes reasoning: never add reasoning tokens twice.
  const cached = Math.min(input, Math.max(0, usage.inputTokenDetails?.cacheReadTokens || 0));
  const written = Math.min(input - cached, Math.max(0, usage.inputTokenDetails?.cacheWriteTokens || 0));
  return (input - cached - written) * rates.input + cached * rates.cached + written * rates.write + output * rates.output;
}
export async function persistAiCall(event) {
  console.log(JSON.stringify({ message: 'ai_call_meter', ...event }));
  if (!process.env.DATABASE_URL) return;
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`INSERT INTO ai_call_events (id, request_id, user_id, event) VALUES
      (${event.id}::uuid, ${event.requestId}, ${event.userId}::uuid, ${JSON.stringify(event)}::jsonb)`;
  } catch {
    // Structured log retains the event for reconciliation if DB is unavailable.
    console.error(JSON.stringify({ message: 'ai_call_meter_store_failed', id: event.id }));
  }
}
export function createMeteredGenerate({ generate = generateText, sink = persistAiCall } = {}) {
  return async function meteredGenerate(options) {
    const { meterPhase = 'primary', ...args } = options;
    // A provider request must never hold a paid member in a spinner until the
    // whole Vercel function expires. AI SDK applies this budget across its own
    // retry attempts; callers can still choose a stricter timeout explicitly.
    if (args.timeout === undefined) args.timeout = { totalMs: resolveAiCallTimeoutMs() };
    const instructionText = typeof args.instructions === 'string' ? args.instructions : '';
    if (process.env.ELITEA_CONTEXT_COMPACT !== '0' && instructionText.includes('# AKTUÁLNÍ PAMĚŤ ČLENKY')) {
      const boundary = instructionText.indexOf('# AKTUÁLNÍ PAMĚŤ ČLENKY');
      args.instructions = [{ role: 'system', content: instructionText.slice(0, boundary) }, { role: 'system', content: instructionText.slice(boundary) }];
    }
    const id = randomUUID(), started = Date.now();
    const context = aiMeterContext.getStore() || {};
    if (process.env.ELITEA_CONTEXT_COMPACT !== '0') {
      const firstUser = (args.messages || []).find(m => m.role === 'user')?.content;
      if (typeof firstUser === 'string') args.headers = { ...args.headers, 'x-session-affinity': createHash('sha256').update(`${context.userId || context.requestId || id}|${firstUser}`).digest('hex') };
    }
    let result, failure;
    try {
      if (context.beforeCall) await context.beforeCall(args);
      result = await generate(args); return result;
    }
    catch (error) { failure = error; throw error; }
    finally {
      const usage = result?.totalUsage || result?.usage || failure?.usage;
      const metadata = result?.providerMetadata?.gateway;
      const gatewayCost = metadata?.cost;
      const actualCost = gatewayCost !== undefined && gatewayCost !== null && Number.isFinite(Number(gatewayCost)) && Number(gatewayCost) >= 0 ? Number(gatewayCost) : null;
      const event = {
        id, requestId: context.requestId || id, userId: context.userId || null,
        phase: meterPhase, model: typeof args.model === 'string' ? args.model : args.model?.modelId || 'unknown',
        status: failure ? 'error' : 'success', durationMs: Date.now() - started,
        inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null,
        cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens ?? null,
        cacheWriteTokens: usage?.inputTokenDetails?.cacheWriteTokens ?? null,
        reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? null,
        estimatedCostUsd: priceUsage(typeof args.model === 'string' ? args.model : args.model?.modelId, usage),
        gatewayCostUsd: actualCost, pricingVersion: '2026-09-15-standard',
        usageKnown: Number.isFinite(usage?.inputTokens) && Number.isFinite(usage?.outputTokens),
        generationId: metadata?.generationId || null,
        instructionChars: instructionText.length,
        messageChars: (args.messages || []).reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0),
        ...summarizeAiFailure(failure),
      };
      try { await (context.sink || sink)(event); } catch { console.error(JSON.stringify({ message: 'ai_call_meter_sink_failed', id })); }
    }
  };
}
export const meteredGenerateText = createMeteredGenerate();
