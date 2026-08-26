import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_MODEL,
  DEFAULT_DEEP_MODEL,
  DEFAULT_COACH_MODEL,
  normalizeReasoningEffort,
  resolveModelId,
  resolveReasoningEffort,
  resolveTurnModel,
} from '../src/elitea.js';

test('výchozí model používá podporovaný slug AI Gateway', () => {
  assert.equal(DEFAULT_MODEL, 'openai/gpt-5.6-luna');
  assert.equal(resolveModelId(''), 'openai/gpt-5.6-luna');
  assert.equal(DEFAULT_DEEP_MODEL, 'openai/gpt-5.6-terra');
  assert.equal(DEFAULT_COACH_MODEL, 'openai/gpt-5.6-sol');
});

test('staré nekompatibilní nastavení se automaticky převede', () => {
  assert.equal(resolveModelId('openai/gpt-5.4-mini'), 'openai/gpt-5.6-luna');
  assert.equal(resolveModelId('openai/gpt-5.4'), 'openai/gpt-5.6-luna');
  assert.equal(resolveModelId('anthropic/claude-sonnet-4.6'), 'anthropic/claude-sonnet-4.6');
});

test('GPT-5.6 Sol používá vyvážené uvažování a dovolí explicitní přepsání', () => {
  assert.equal(resolveReasoningEffort('openai/gpt-5.6-sol', ''), 'medium');
  assert.equal(resolveReasoningEffort('openai/gpt-5.6-terra', ''), 'medium');
  assert.equal(resolveReasoningEffort('openai/gpt-5.6-sol', 'high'), 'high');
  assert.equal(resolveReasoningEffort('openai/gpt-5-mini', ''), 'low');
});

test('hluboké fáze sezení používají silnější model, běžné otevření levnější model', () => {
  assert.equal(resolveTurnModel({
    baseModel: 'openai/gpt-5.6-luna',
    deepModel: 'openai/gpt-5.6-terra',
    responseMode: 'diagnostika',
    conversationContext: { userTurns: 1 },
  }), 'openai/gpt-5.6-luna');
  assert.equal(resolveTurnModel({
    baseModel: 'openai/gpt-5.6-luna',
    deepModel: 'openai/gpt-5.6-terra',
    responseMode: 'koucovaci_hodina',
    conversationContext: { userTurns: 1 },
  }), 'openai/gpt-5.6-sol');
  assert.equal(resolveTurnModel({
    baseModel: 'openai/gpt-5.6-luna',
    deepModel: 'openai/gpt-5.6-terra',
    responseMode: 'koucovaci_podpora',
    conversationContext: { userTurns: 2 },
    techniqueTurn: { card: { id: 'grow' }, session: { phase: 'application' } },
  }), 'openai/gpt-5.6-terra');
  assert.equal(resolveTurnModel({
    baseModel: 'openai/gpt-5.6-luna',
    deepModel: 'openai/gpt-5.6-terra',
    responseMode: 'brand_growth_agent',
    conversationContext: { userTurns: 1 },
  }), 'openai/gpt-5.6-terra');
});

test('GPT-5.6 nikdy nedostane starou hodnotu minimal', () => {
  assert.equal(normalizeReasoningEffort('openai/gpt-5.6-sol', 'minimal'), 'low');
  assert.equal(normalizeReasoningEffort('openai/gpt-5-mini', 'minimal'), 'minimal');
});
