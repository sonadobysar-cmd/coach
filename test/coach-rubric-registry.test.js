import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { createTrainingScenario } from '../src/training.js';
import {
  auditCoachRubricRegistry,
  buildCoachRubricRegistry,
  collectProfessionalCoachRuntimeRubricRecords,
  normalizeCoachRubricLabel,
  resolveCoachRubricCriterion,
} from '../src/coach-rubric-registry.js';
import {
  assessCoachCriterionEvidence,
  auditCoachEvidenceRuleCoverage,
} from '../src/coach-evidence-rules.js';
import {
  assessCoachEvidenceRelevance,
  coachCompetencyIdForCriterion,
} from '../src/coach-competencies.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [course] = (await loadCourses([
  join(ROOT, 'data', 'course-profesionalni-life-coach.md'),
])).map(attachCourseMastery);

test('exact registry pokrývá celý skutečný runtime včetně finalExam.criteria', () => {
  const records = collectProfessionalCoachRuntimeRubricRecords({
    course,
    createScenario: createTrainingScenario,
  });
  const uniqueRuntimeLabels = new Set(records.map(record => normalizeCoachRubricLabel(record.label)));
  const audit = auditCoachRubricRegistry(records);
  const registry = buildCoachRubricRegistry(records);
  const evidenceAudit = auditCoachEvidenceRuleCoverage(registry);

  assert.ok(uniqueRuntimeLabels.size > 300, 'test musí procházet plochu celého kurzu, ne ručně vybraný vzorek');
  assert.equal(audit.uniqueCriterionCount, uniqueRuntimeLabels.size);
  assert.equal(audit.registeredCriterionCount, uniqueRuntimeLabels.size);
  assert.deepEqual(audit.unresolved, []);
  assert.deepEqual(audit.conflicts, []);
  assert.equal(audit.complete, true);
  assert.equal(evidenceAudit.criterionCount, uniqueRuntimeLabels.size);
  assert.equal(evidenceAudit.evidenceRuleCount, uniqueRuntimeLabels.size);
  assert.equal(evidenceAudit.complete, true);

  for (const label of course.mastery.finalExam.criteria) {
    assert.ok(registry.entries.has(normalizeCoachRubricLabel(label)), label);
  }
});

test('neznámé kritérium a obecná dovednost bez metadata selžou uzavřeně', () => {
  const unknown = resolveCoachRubricCriterion('Empatická energie podle dojmu hodnotitele');
  assert.equal(unknown.resolved, false);
  assert.equal(unknown.reason, 'unknown_criterion');

  const generic = resolveCoachRubricCriterion('Použití dovednosti z aktuální lekce');
  assert.equal(generic.resolved, false);
  assert.equal(generic.reason, 'lesson_metadata_required');

  const audit = auditCoachRubricRegistry([
    { label: 'Kontrakt a jasný cíl rozhovoru' },
    { label: 'Empatická energie podle dojmu hodnotitele' },
  ]);
  assert.equal(audit.complete, false);
  assert.equal(audit.unresolved.length, 1);
});

test('obecná dovednost lekce se vyřeší jen z kanonického modulu a vyžaduje lekční důkaz', () => {
  const context = {
    moduleIndex: 4,
    itemId: 'module-4-item-1',
    itemTitle: 'Otevřené a zpřesňující otázky',
  };
  const entry = resolveCoachRubricCriterion('Použití dovednosti z aktuální lekce', context);
  assert.equal(entry.resolved, true);
  assert.equal(entry.competencyId, 'questions');
  assert.equal(entry.source, 'lesson-metadata');

  const input = {
    entry,
    quote: 'Co z obavy z odmítnutí potřebuješ vyjasnit jako první?',
    previousCounterpartText: 'Nejvíc se bojím odmítnutí nabídky.',
  };
  assert.equal(assessCoachCriterionEvidence(input).relevant, false);
  assert.equal(assessCoachCriterionEvidence({ ...input, lessonEvidence: true }).relevant, true);
});

test('překryv slov už nepřemapuje kritéria na nesprávnou kompetenci', () => {
  assert.equal(
    resolveCoachRubricCriterion('Rozlišení vlivu klientky, koučky a trhu').competencyId,
    'ethical_boundaries',
  );
  assert.equal(
    resolveCoachRubricCriterion('Externí rozhodnutí je výslovně oddělené').competencyId,
    'ethical_boundaries',
  );
  assert.equal(
    resolveCoachRubricCriterion('Klientka volí další způsob práce').competencyId,
    'refusal_autonomy',
  );
});

test('kontrakt má český i slovenský pozitivní důkaz, ale obecná otázka nestačí', () => {
  const label = 'Kontrakt a jasný cíl rozhovoru';
  for (const quote of [
    'Co si chcete z dnešního rozhovoru odnést a podle čeho poznáte, že vám pomohl?',
    'Čo si chcete z dnešného rozhovoru odniesť a podľa čoho spoznáte, že vám pomohol?',
  ]) {
    assert.equal(assessCoachCriterionEvidence({ label, quote }).relevant, true, quote);
  }
  assert.equal(assessCoachCriterionEvidence({
    label,
    quote: 'Co chcete dnes řešit?',
  }).relevant, false);
});

test('důvěrnost má český i slovenský důkaz a odmítne obecný disclaimer', () => {
  const label = 'Důvěrnost a reporting vyjednané předem';
  for (const quote of [
    'Obsah sezení ani poznámky firmě bez vašeho předchozího souhlasu nepředám; předem dohodneme jen minimální výsledkový report.',
    'Obsah sedenia ani poznámky firme bez vášho predchádzajúceho súhlasu neodovzdám; vopred dohodneme iba minimálny výsledkový report.',
  ]) {
    assert.equal(assessCoachCriterionEvidence({ label, quote }).relevant, true, quote);
  }
  assert.equal(assessCoachCriterionEvidence({
    label,
    quote: 'Výsledek nemohu garantovat; můžeme hledat bezpečný krok.',
  }).relevant, false);
});

test('bezpečnostní otázka prokáže přesně plán, prostředky a bezpečí v češtině i slovenštině', () => {
  const label = 'Přímé otázky na aktuální plán, prostředky a bezpečí';
  for (const quote of [
    'Máš právě teď plán, jak si ublížit, máš k tomu prostředky a dokážeš zůstat v bezpečí?',
    'Máš práve teraz plán, ako si ublížiť, máš k tomu prostriedky a dokážeš zostať v bezpečí?',
  ]) {
    assert.equal(assessCoachCriterionEvidence({ label, quote }).relevant, true, quote);
  }
  assert.equal(assessCoachCriterionEvidence({
    label,
    quote: 'Beru vaše bezpečí vážně a doporučuji podporu.',
  }).relevant, false);
});

test('účelná otázka musí navazovat na klientčin obsah, nestačí libovolná otevřená otázka', () => {
  const label = 'Pozorovatelný důkaz: jedna účelná otázka';
  const previousCounterpartText = 'Bojím se odmítnutí nabídky a dopadu na příjem.';
  assert.equal(assessCoachCriterionEvidence({
    label,
    quote: 'Který dopad odmítnutí nabídky potřebuješ vyjasnit jako první?',
    previousCounterpartText,
  }).relevant, true);
  assert.equal(assessCoachCriterionEvidence({
    label,
    quote: 'Jaký je tvůj oblíbený film?',
    previousCounterpartText,
  }).relevant, false);
});

test('bezpečná obecná věta neprokáže jiné etické, krizové ani datové kritérium', () => {
  const quote = 'Výsledek nemohu garantovat; můžeme hledat bezpečný krok.';
  for (const label of [
    'Pozorovatelný důkaz: jasná hranice role, bezpečnostní orientace a konkrétní předání bez opuštění klientky',
    'Důvěrnost a reporting vyjednané předem',
    'Konkrétní propojení na 112 nebo 155 a dostupnou blízkou osobu',
    'Přímé otázky na aktuální myšlenky, záměr, plán, dostupnost prostředků a bezpečí',
    'Pravdivé vysvětlení nabídky, ceny a interního certifikátu',
  ]) {
    assert.equal(assessCoachCriterionEvidence({ label, quote }).relevant, false, label);
  }
});

test('produkční mapování profesního kurzu selže uzavřeně, jiné kurzy zůstanou kompatibilní', () => {
  const invented = 'Jemné kontraktování s klientkou';
  assert.equal(coachCompetencyIdForCriterion(invented), null);
  assert.equal(
    coachCompetencyIdForCriterion(invented, { courseId: 'komunikace-v-praxi' }),
    'contract',
  );

  const quote = 'Co by pro tebe dnes bylo užitečné?';
  const assessed = assessCoachEvidenceRelevance({
    label: invented,
    quote,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: 'Nevím, kde začít.' },
      { role: 'user', content: quote },
    ],
  });
  assert.equal(assessed.relevant, false);
  assert.equal(assessed.reason, 'unmapped_criterion');
});

test('dynamické lekční kritérium bez přesných metadata ani lekčního důkazu nelze prokázat', () => {
  const label = 'Přesné použití obsahu části „Otevřené a zpřesňující otázky“';
  const quote = 'Co z obavy z odmítnutí potřebuješ vyjasnit jako první?';
  const messages = [
    { role: 'assistant', content: 'Nejvíc se bojím odmítnutí nabídky.' },
    { role: 'user', content: quote },
  ];

  assert.equal(resolveCoachRubricCriterion(label).reason, 'lesson_metadata_required');
  assert.equal(resolveCoachRubricCriterion(label, {
    moduleIndex: 4,
    itemTitle: 'Jiná lekce',
  }).reason, 'lesson_metadata_mismatch');

  const context = {
    courseId: 'profesionalni-life-coach',
    moduleIndex: 4,
    itemId: 'module-4-item-1',
    itemTitle: 'Otevřené a zpřesňující otázky',
  };
  const withoutMetadata = assessCoachEvidenceRelevance({
    label,
    quote,
    turnIndex: 1,
    messages,
  });
  assert.equal(withoutMetadata.relevant, false);
  assert.equal(withoutMetadata.reason, 'lesson_metadata_required');

  const withoutLessonEvidence = assessCoachEvidenceRelevance({
    label,
    quote,
    turnIndex: 1,
    messages,
    context,
  });
  assert.equal(withoutLessonEvidence.relevant, false);
  assert.equal(withoutLessonEvidence.reason, 'lesson_evidence_required');

  const proven = assessCoachEvidenceRelevance({
    label,
    quote,
    turnIndex: 1,
    messages,
    context,
    lessonEvidence: true,
  });
  assert.equal(proven.relevant, true);
  assert.match(proven.evidenceRuleId, /^coach-rubric-v3:lesson_application:/u);
});
