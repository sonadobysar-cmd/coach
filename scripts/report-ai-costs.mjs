import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Use a server-side environment, never a public endpoint.');
const sql=neon(process.env.DATABASE_URL);
const days=Math.max(1,Math.min(90,Number(process.env.ELITEA_COST_REPORT_DAYS)||30));
const rows=await sql`SELECT event->>'model' AS model, event->>'phase' AS phase,
 count(*)::int AS calls,
 count(*) FILTER (WHERE event->>'gatewayCostUsd' IS NULL)::int AS calls_without_gateway_cost,
 count(*) FILTER (WHERE event->>'status' = 'error')::int AS failed_calls,
 sum((event->>'gatewayCostUsd')::numeric) AS reported_gateway_usd,
 sum((event->>'estimatedCostUsd')::numeric) AS estimated_usd,
 sum((event->>'inputTokens')::bigint) AS input_tokens,
 sum((event->>'cachedInputTokens')::bigint) AS cached_input_tokens,
 sum((event->>'cacheWriteTokens')::bigint) AS cache_write_tokens,
 sum((event->>'outputTokens')::bigint) AS output_tokens
 FROM ai_call_events WHERE created_at >= now() - (${days} * interval '1 day')
 GROUP BY event->>'model', event->>'phase' ORDER BY reported_gateway_usd DESC NULLS LAST`;
console.log(JSON.stringify({days,warning:'Missing gateway cost is unknown, not zero. Estimates use a versioned price snapshot; reconcile gateway-reported totals against billing.',rows},null,2));
