import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKnowledge, retrieveKnowledge } from '../src/knowledge.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const knowledgePath = join(ROOT, 'data', 'everand-knowledge.jsonl');
const manifest = JSON.parse(await readFile(join(ROOT, 'data', 'everand-knowledge-manifest.json'), 'utf8'));
const records = await loadKnowledge(knowledgePath);

test('produkční Everand vrstva obsahuje pouze dokončený checkpoint 135/993', () => {
  assert.equal(manifest.source_checkpoint, 135);
  assert.equal(manifest.practical_tool_checkpoint, 993);
  assert.equal(manifest.completed_sources, 135);
  assert.equal(manifest.practical_tools, 993);
  assert.equal(manifest.total_records, 1128);
  assert.equal(records.length, manifest.total_records);
  assert.equal(new Set(records.map(record => record.source_id)).size, records.length);
  assert.ok(records.every(record => record.approved_for_ai));
  assert.ok(!records.some(record => /source-136|tool-994|zdroj 136/i.test(record.source_id)));
});

test('každý praktický nástroj nese pojistku a zákaz diagnózy či garance', () => {
  const tools = records.filter(record => record.source_type === 'everand_practical_tool');
  assert.equal(tools.length, 993);
  for (const tool of tools) {
    assert.ok(tool.boundary.length >= 20, tool.source_id);
    assert.ok(tool.do_not_use_as.includes('diagnosis'), tool.source_id);
    assert.ok(tool.do_not_use_as.includes('guarantee'), tool.source_id);
    assert.equal(tool.practice_mode, 'guided_practice');
  }
});

test('knižní retrieval vrací praktickou práci místo obecného seznamu knih', () => {
  const validation = retrieveKnowledge(records, 'Nemám publikum a potřebuji prakticky ověřit nabídku placenou reklamou', 8);
  assert.ok(validation.some(item => item.source_type === 'everand_practical_tool'));
  assert.ok(validation.some(item => /customer|market|nabídk|valid|reklam|publik/i.test(`${item.topic} ${item.content}`)));

  const selfJudgment = retrieveKnowledge(records, 'Jsem neschopná a úkoly nedokončuji, potřebuji pochopit co se děje', 8);
  assert.ok(selfJudgment.some(item => item.source_type === 'everand_practical_tool'));
  assert.ok(selfJudgment.some(item => /sebe|krit|belief|myšlen|identity|úkol|prokrast/i.test(`${item.topic} ${item.content}`)));
});

test('runtime vrstva neobsahuje čekající governance výroky ani dlouhé knižní kopie', () => {
  assert.ok(!records.some(record => record.source_type === 'owner_decision_register'));
  assert.ok(!records.some(record => record.review_status === 'čeká'));
  assert.ok(Math.max(...records.map(record => record.content.length)) < 2600);
});
