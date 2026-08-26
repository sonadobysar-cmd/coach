import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, retrieveKnowledge, tokenize } from '../src/knowledge.js';

test('normalizace odstraní diakritiku a sjednotí velikost', () => {
  assert.equal(normalize('Cílová Skupina'), 'cilova skupina');
});

test('tokenizace odstraní běžná krátká slova', () => {
  assert.deepEqual(tokenize('Jak mám nastavit cenu služby?'), ['nastavit', 'cena', 'sluzby']);
});

test('retrieval zvýhodní shodu v tématu', () => {
  const records = [
    {
      source_id: 'pricing', domain: 'finance', topic: 'Cenotvorba', content: 'Výpočet ceny služby', sequence: 1,
      approved_for_ai: true,
      _tokens: new Set(['finance', 'cenotvorba', 'vypocet', 'ceny', 'sluzby']),
      _topicTokens: new Set(['cenotvorba']),
    },
    {
      source_id: 'marketing', domain: 'marketing', topic: 'Obsah', content: 'Sociální sítě', sequence: 2,
      approved_for_ai: true,
      _tokens: new Set(['marketing', 'obsah', 'socialni', 'site']),
      _topicTokens: new Set(['obsah']),
    },
  ];

  const result = retrieveKnowledge(records, 'Potřebuji vyřešit cenotvorbu služby', 1);
  assert.equal(result[0].source_id, 'pricing');
});

test('prázdný dotaz nikdy nevrací náhodné znalosti', () => {
  const records = [{
    source_id: 'unrelated', domain: 'marketing', topic: 'Web', content: 'Nesouvisející text', sequence: 1,
    approved_for_ai: true,
    _tokens: new Set(['marketing', 'web']),
    _topicTokens: new Set(['web']),
  }];

  assert.deepEqual(retrieveKnowledge(records, '', 5), []);
  assert.deepEqual(retrieveKnowledge(records, 'a je to', 5), []);
});

test('jediná obecná shoda nestačí k připojení nesouvisející Academy lekce', () => {
  const records = [{
    source_id: 'academy-unrelated', domain: 'academy', topic: 'První pomoc', content: 'Bezpečný scénář', sequence: 1,
    source_type: 'elitea_academy_course', approved_for_ai: true,
    _tokens: new Set(['academy', 'prvni', 'pomoc', 'bezpecny', 'scenar']),
    _topicTokens: new Set(['prvni', 'pomoc']),
  }];
  assert.deepEqual(retrieveKnowledge(records, 'Potřebuji určit první krok na webu', 5), []);
});
