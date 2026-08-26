import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCourseKnowledge, courseKnowledgeCoverage } from '../src/course-knowledge.js';
import { loadCourses } from '../src/courses.js';
import { expandSelfTrustMaterials } from '../src/self-trust-materials.js';
import { expandAdhdMaterials } from '../src/adhd-materials.js';
import { expandBachMaterials } from '../src/bach-materials.js';
import { expandLifeCoachMaterials } from '../src/life-coach-materials.js';
import { expandWomensCircleMaterials } from '../src/womens-circle-materials.js';
import {
  formatKnowledgeContext,
  isKnowledgeApproved,
  isPoliticalKnowledge,
  loadKnowledge,
  retrieveKnowledge,
} from '../src/knowledge.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const coursePaths = [
  'course-neuroplasticita-practitioner.md',
  'course-pevna-v-sobe.md',
  'course-spiritualni-koucink.md',
  'course-komunikace-v-praxi.md',
  'course-kbt-koucink-v-praxi.md',
  'course-adhd-focus-motivace.md',
  'course-bachovy-kvetove-esence.md',
  'course-profesionalni-life-coach.md',
  'course-zenske-kruhy.md',
].map(file => join(ROOT, 'data', file));
const materialPaths = [
  'course-pevna-v-sobe-materials.json',
  'course-spiritualni-koucink-materials.json',
  'course-komunikace-v-praxi-materials.json',
  'course-kbt-koucink-v-praxi-materials.json',
  'course-adhd-focus-motivace-materials.json',
  'course-bachovy-kvetove-esence-materials.json',
  'course-profesionalni-life-coach-materials.json',
  'course-zenske-kruhy-materials.json',
].map(file => join(ROOT, 'data', file));

const courses = await loadCourses(coursePaths);
const loadedMaterialGroups = await Promise.all(materialPaths.map(async path =>
  JSON.parse(await readFile(path, 'utf8'))));
const materials = [
  ...expandSelfTrustMaterials(loadedMaterialGroups[0]),
  ...loadedMaterialGroups.slice(1, 4).flat(),
  ...expandAdhdMaterials(loadedMaterialGroups[4]),
  ...expandBachMaterials(loadedMaterialGroups[5]),
  ...expandLifeCoachMaterials(loadedMaterialGroups[6]),
  ...expandWomensCircleMaterials(loadedMaterialGroups[7]),
];
for (const course of courses) {
  course.materials = materials.filter(material => material.courseId === course.id);
}
const courseKnowledge = buildCourseKnowledge(courses);

test('každá část a každý pracovní materiál Academy je ve schválené znalostní vrstvě', () => {
  const coverage = courseKnowledgeCoverage(courses, courseKnowledge);
  assert.equal(coverage.courses, 9);
  assert.ok(coverage.courseItems >= 890);
  assert.equal(coverage.coveredCourseItems, coverage.courseItems);
  assert.equal(coverage.coveredCourseMaterials, coverage.courseMaterials);
  assert.equal(coverage.complete, true);
  assert.ok(courseKnowledge.every(record => record.approved_for_ai === true));
  assert.equal(new Set(courseKnowledge.map(record => record.source_id)).size, courseKnowledge.length);
});

test('router dohledá praktickou znalost každého Academy kurzu', () => {
  const cases = [
    ['změna návyku neuroplasticita pět kroků', 'neuroplasticita-practitioner'],
    ['sebedůvěra sebeláska hranice', 'pevna-v-sobe-intensive'],
    ['spirituální koučink intuice signature metoda', 'spiritualni-koucink-practice'],
    ['obtížný rozhovor asertivní žádost komunikace', 'komunikace-v-praxi'],
    ['automatická myšlenka behaviorální experiment KBT', 'kbt-koucink-v-praxi'],
    ['ADHD exekutivní funkce a motivace', 'adhd-focus-motivace'],
    ['Bachovy květové esence a bezpečná směs', 'bachovy-kvetove-esence'],
    ['ženský kruh skupinová důvěrnost souhlas facilitátorka', 'facilitace-zenskych-kruhu'],
  ];

  for (const [query, courseId] of cases) {
    const matches = retrieveKnowledge(courseKnowledge, query, 5);
    assert.ok(matches.some(match => match.course_id === courseId), `${courseId} se pro dotaz nenašel`);
    assert.ok(matches.some(match => ['apply_principles', 'guided_practice'].includes(match.practice_mode)));
  }
});

test('hromadně schválené zdroje jsou dostupné, interní registry zůstávají mimo odpovědi', async () => {
  const sourceKnowledge = await loadKnowledge(join(ROOT, 'data', 'nia-knowledge.jsonl'));
  const blocked = sourceKnowledge.filter(record => !isKnowledgeApproved(record));
  const waiting = sourceKnowledge.filter(record => /pending|awaiting/i.test(record.review_status || ''));
  const courseSources = sourceKnowledge.filter(record => record.knowledge_role === 'faithful_course_source_capture');
  const politicalCourseSources = courseSources.filter(isPoliticalKnowledge);
  const approvedOpinionSources = courseSources.filter(record => !isPoliticalKnowledge(record));

  assert.equal(waiting.length, 0);
  assert.ok(courseSources.length > 700);
  assert.ok(approvedOpinionSources.every(record => isKnowledgeApproved(record)));
  assert.ok(politicalCourseSources.length >= 20);
  assert.ok(politicalCourseSources.every(record => !isKnowledgeApproved(record)));
  assert.ok(blocked.every(record =>
    record.source_type === 'owner_decision_register'
      || isPoliticalKnowledge(record)
      || record.review_status === 'excluded_until_attachment_content_is_read'));

  const queries = [
    'Jak mám nacenit svou službu?',
    'Bojím se zveřejnit video a všichni se mi budou smát.',
    'Nauč mě NLP trik, kterým klientku dotlačím k nákupu.',
    'Mám trauma a úzkost, proveď se mnou dissociaci.',
  ];
  for (const query of queries) {
    const matches = retrieveKnowledge(sourceKnowledge, query, 8);
    assert.ok(matches.every(match => match.approved_for_ai === true));
    assert.ok(matches.every(match => match.knowledge_role !== 'pending_owner_adjudication'));
    assert.ok(matches.every(match => !isPoliticalKnowledge(match)));
  }
});

test('NLP Practitioner PDF kolekce zůstává úplná, schválená a oddělená od interních registrů', async () => {
  const sourceKnowledge = await loadKnowledge(join(ROOT, 'data', 'nia-knowledge.jsonl'));
  const prefix = 'nlp-practitioner-certificate-pdf-';
  const records = sourceKnowledge.filter(record => record.source_id?.startsWith(prefix));
  const sources = records.filter(record => record.knowledge_role === 'faithful_course_source_capture');
  const ownerRegisters = records.filter(record => record.source_type === 'owner_decision_register');

  const expectedSourceIds = [
    ...Array.from({ length: 17 }, (_, index) => `${prefix}${String(index + 1).padStart(3, '0')}`),
    ...Array.from({ length: 12 }, (_, index) => `${prefix}018-section-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 25 }, (_, index) => `${prefix}${String(index + 19).padStart(3, '0')}`),
  ];

  assert.equal(sources.length, 54);
  assert.equal(ownerRegisters.length, 54);
  assert.equal(new Set(records.map(record => record.source_id)).size, 108);

  for (const sourceId of expectedSourceIds) {
    const source = sources.find(record => record.source_id === sourceId);
    const ownerRegister = ownerRegisters.find(record => record.source_id === `${sourceId}-owner-review`);
    assert.ok(source, `Chybí zdroj ${sourceId}`);
    assert.ok(ownerRegister, `Chybí rozhodovací registr ${sourceId}`);
    assert.equal(source.approved_for_ai, true);
    assert.equal(ownerRegister.approved_for_ai, false);
    assert.ok(ownerRegister.content.endsWith('Nic se automaticky nevyřazuje.'));
  }
});

test('nové NLP Practitioner znalosti se vyhledají podle metody bez interního registru', async () => {
  const sourceKnowledge = await loadKnowledge(join(ROOT, 'data', 'nia-knowledge.jsonl'));
  const cases = [
    ['Meta Mirror vztahová interakce čtyři pozice', 'nlp-practitioner-certificate-pdf-036'],
    ['Satir Reframing Matrix rozhodnutí co se stane', 'nlp-practitioner-certificate-pdf-039'],
    ['submodality coaching vizuální auditivní kinestetické', 'nlp-practitioner-certificate-pdf-042'],
  ];

  for (const [query, expectedSourceId] of cases) {
    const matches = retrieveKnowledge(sourceKnowledge, query, 8);
    assert.ok(matches.some(match => match.source_id === expectedSourceId), query);
    assert.ok(matches.every(match => match.source_type !== 'owner_decision_register'));
    const context = formatKnowledgeContext(matches);
    assert.doesNotMatch(context, /Nic se automaticky nevyřazuje\./);
    assert.doesNotMatch(context, /owner decision|rozhodovací registr/i);
  }
});

test('všechny tři úplné NLP kurzy zůstávají lekci po lekci ve dvou oddělených vrstvách', async () => {
  const sourceKnowledge = await loadKnowledge(join(ROOT, 'data', 'nia-knowledge.jsonl'));
  const collections = [
    ['udemy-nlp-practitioner-kain-ramsay-lecture-', 154],
    ['udemy-nlp-master-practitioner-kain-ramsay-lecture-', 156],
    ['udemy-nlp-master-practitioner-graham-nicholls-lecture-', 188],
  ];

  for (const [prefix, lessonCount] of collections) {
    for (let lesson = 1; lesson <= lessonCount; lesson += 1) {
      const sourceId = `${prefix}${lesson}`;
      const source = sourceKnowledge.find(record =>
        record.source_id === sourceId
        && record.knowledge_role === 'faithful_course_source_capture');
      const ownerRegister = sourceKnowledge.find(record =>
        record.source_id === `${sourceId}-owner-review`
        && record.source_type === 'owner_decision_register');

      assert.ok(source, `Chybí úplný zdrojový záznam ${sourceId}`);
      assert.ok(ownerRegister, `Chybí interní rozhodovací registr ${sourceId}`);
      assert.equal(source.approved_for_ai, !isPoliticalKnowledge(source), sourceId);
      assert.equal(ownerRegister.approved_for_ai, false);
      assert.ok(ownerRegister.content.endsWith('Nic se automaticky nevyřazuje.'));
    }
  }
});

test('žádný licenčně blokovaný program Transformation Academy se nenačítá do produktu', async () => {
  const sourceKnowledge = await loadKnowledge(join(ROOT, 'data', 'nia-knowledge.jsonl'));
  const atlas = JSON.parse(await readFile(
    join(ROOT, 'data', 'master-technique-atlas.json'),
    'utf8',
  ));
  const blocklist = JSON.parse(await readFile(
    join(ROOT, 'data', 'source-license-blocklist.json'),
    'utf8',
  ));
  const blockedPrefixes = [
    'udemy-transformation-life-coach-transformation-academy-lecture-',
    'udemy-cbt-life-coach-transformation-academy-lecture-',
  ];

  assert.ok(!sourceKnowledge.some(record =>
    blockedPrefixes.some(prefix => record.source_id?.startsWith(prefix))));
  assert.ok(!atlas.some(card => card.id?.startsWith('tlc_')));
  assert.ok(!atlas.some(card => /Transformation Academy/i.test(card.origin_or_standard || '')));
  assert.equal(blocklist.policy, 'deny_by_default_for_all_transformation_academy_programs');
  assert.ok(blocklist.sources.every(source => source.status === 'blocked_from_product_knowledge'));
  assert.ok(blocklist.sources.some(source => source.source_id === 'udemy-transformation-life-coach-transformation-academy'));
  assert.ok(blocklist.sources.some(source => source.source_id === 'udemy-cbt-life-coach-transformation-academy'));
});

test('originální ELITEA Compass je aktivní znalost a není odvozený od blokovaného kurzu', async () => {
  const sourceKnowledge = await loadKnowledge(join(ROOT, 'data', 'nia-knowledge.jsonl'));
  const matches = retrieveKnowledge(
    sourceKnowledge,
    'Chci hlubokou transformaci a motám se v kruhu. Proveď mě ELITEA Compass krok po kroku.',
    12,
  );
  const method = matches.find(match => match.source_id === 'elitea-original-compass-method-v1');

  assert.ok(method);
  assert.equal(method.source_type, 'elitea_original_method');
  assert.match(method.content, /Směr.*Evidence.*Limity a páky.*Frikce.*Autonomní volba.*Your experiment.*Adaptace/);
  assert.doesNotMatch(JSON.stringify(method), /Transformation Academy/i);
});


test('schválené názory z kurzů zůstávají aktivní, politický obsah je vždy vyloučen', async () => {
  const sourceKnowledge = await loadKnowledge(join(ROOT, 'data', 'nia-knowledge.jsonl'));
  const ordinaryCoaching = retrieveKnowledge(
    sourceKnowledge,
    'Pomoz mi prakticky zpřesnit vlastní vnímání, úsudek a kognitivní flexibilitu.',
    20,
  );

  assert.ok(ordinaryCoaching.some(match => match.knowledge_role === 'faithful_course_source_capture'));
  assert.ok(ordinaryCoaching.every(match => !isPoliticalKnowledge(match)));
  const rawContext = formatKnowledgeContext(
    ordinaryCoaching.filter(match => match.knowledge_role === 'faithful_course_source_capture').slice(0, 1),
  );
  assert.match(rawContext, /Nia tento kurzový názor výslovně schválila/);
  assert.match(rawContext, /Bezpečnostní značky:/);
});

test('model dostane kurzový původ, praktický režim i hranice použití', () => {
  const [match] = retrieveKnowledge(courseKnowledge, 'KBT praktický behaviorální experiment', 1);
  const context = formatKnowledgeContext([match]);
  assert.match(context, /Kurz: KBT-inspirovaný koučink v praxi/);
  assert.match(context, /Způsob použití: apply_principles|Způsob použití: guided_practice/);
  assert.match(context, /Nepoužívat jako: psychotherapy, diagnosis, medical_treatment/);
});
