import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSystemContext} from '../src/ai-context.js';
const prompt=readFileSync(new URL('../config/system-prompt.md',import.meta.url),'utf8');
test('personal coach preserves all shared sections verbatim',()=>{
 const result=selectSystemContext(prompt,'koucovaci_hodina');
 for(const section of prompt.split(/(?=^## )/m)) {
  if(/^## (?:9\.|Pravidla marketingové operátorky)/.test(section)) assert.ok(!result.includes(section));
  else assert.ok(result.includes(section));
 }
 assert.ok(result.length<prompt.length);
});
test('marketing and mentoring keep full instructions',()=>{
 for(const mode of ['brand_growth_agent','mentoringova_konzultace','diagnostika'])assert.equal(selectSystemContext(prompt,mode),prompt);
});
