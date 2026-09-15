import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeteredGenerate, priceUsage, aiMeterContext, resolveAiCallTimeoutMs } from '../src/ai-meter.js';
test('charges cached input separately and reasoning once', () => {
  assert.ok(Math.abs(priceUsage('openai/gpt-5.6-terra', { inputTokens: 1000, outputTokens: 100, inputTokenDetails: { cacheReadTokens: 800 }, outputTokenDetails: { reasoningTokens: 80 } }) - .00176) < 1e-10);
  assert.equal(priceUsage('unknown', {inputTokens: 1, outputTokens: 1}), null);
  assert.equal(priceUsage('openai/gpt-5.6-terra', undefined), null);
});
test('each repair has its own model and usage, with no conversation data', async () => {
  const events = [];
  const generate = createMeteredGenerate({generate: async () => ({usage:{inputTokens:100,outputTokens:10}}),sink: e => events.push(e)});
  await aiMeterContext.run({requestId:'request',userId:'user'}, async () => {
    await generate({model:'openai/gpt-5.6-luna',instructions:'SECRET',messages:[{role:'user',content:'PRIVATE'}]});
    await generate({model:'openai/gpt-5.6-terra',meterPhase:'quality-repair'});
  });
  assert.equal(events.length,2);assert.equal(events[1].phase,'quality-repair');
  assert.ok(events[1].estimatedCostUsd > events[0].estimatedCostUsd);
  assert.equal(events[0].requestId,'request');assert.ok(!JSON.stringify(events).includes('SECRET'));assert.ok(!JSON.stringify(events).includes('PRIVATE'));
});
test('errors remain unknown cost, recording failure does not mask original exception', async () => {
 const events=[];const error=new Error('sensitive');
 const generate=createMeteredGenerate({generate:async()=>{throw error},sink:e=>events.push(e)});
 await assert.rejects(generate({model:'openai/gpt-5.6-sol'}),e=>e===error);
 assert.equal(events[0].estimatedCostUsd,null);assert.equal(events[0].usageKnown,false);
});

test('cache writes and actual gateway cost are retained', async()=>{
 const usage={inputTokens:1000,outputTokens:100,inputTokenDetails:{cacheReadTokens:200,cacheWriteTokens:600}};
 assert.ok(Math.abs(priceUsage('openai/gpt-5.6-terra',usage)-.00314)<1e-10);
 const events=[];const fn=createMeteredGenerate({generate:async()=>({usage,providerMetadata:{gateway:{cost:'0.004',generationId:'gen'}}}),sink:e=>events.push(e)});
 await fn({model:'openai/gpt-5.6-terra'});assert.equal(events[0].gatewayCostUsd,.004);assert.equal(events[0].cacheWriteTokens,600);
});
test('split instructions retain every byte and order',async()=>{
 let seen;const fn=createMeteredGenerate({generate:async args=>{seen=args;return{}},sink:()=>{}});
 const original='STATIC\n\n# AKTUÁLNÍ PAMĚŤ ČLENKY\nPRIVATE';
 await fn({model:'openai/gpt-5.6-sol',instructions:original});
  assert.equal(seen.instructions.map(m=>m.content).join(''),original);
});

test('AI call has a bounded production timeout and respects an explicit stricter budget', async () => {
  assert.equal(resolveAiCallTimeoutMs('not-a-number'), 90_000);
  assert.equal(resolveAiCallTimeoutMs('1000'), 20_000);
  assert.equal(resolveAiCallTimeoutMs('999999'), 180_000);
  let first;
  let second;
  const fn = createMeteredGenerate({
    generate: async args => {
      if (!first) first = args;
      else second = args;
      return {};
    },
    sink: () => {},
  });
  await fn({ model: 'openai/gpt-5.6-sol' });
  await fn({ model: 'openai/gpt-5.6-sol', timeout: { totalMs: 35_000 } });
  assert.deepEqual(first.timeout, { totalMs: 90_000 });
  assert.deepEqual(second.timeout, { totalMs: 35_000 });
});
