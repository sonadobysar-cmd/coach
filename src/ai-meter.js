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
      };
      try { await (context.sink || sink)(event); } catch { console.error(JSON.stringify({ message: 'ai_call_meter_sink_failed', id })); }
    }
  };
}
export const meteredGenerateText = createMeteredGenerate();
