import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { getCourseTrainerProfile } from '../src/course-trainer-profiles.js';
import { lifeCoachScenarioCount } from '../src/life-coach-training.js';
import { coachCompetencyIdForCriterion } from '../src/coach-competencies.js';
import {
  assessDebriefResponse,
  assessRoleplayResponse,
  assessStudyResponse,
  buildFinalTrainingRepairInstruction,
  buildTrainingRepairInstruction,
  completeDebriefRubric,
  sanitizeDebriefEvidence,
  sanitizeStudyInternalInstructionLeak,
  sanitizeStudyQuestionCount,
} from '../src/training-quality.js';
import {
  buildTrainingInstructions,
  buildDebriefTranscriptMessages,
  createCourseTrainer,
  createTrainingScenario,
  detectTrainingSimulationRequest,
  inferTrainingCounterpartHint,
  publicTrainingScenario,
  resolveTrainingModel,
  resolveTrainingTurn,
  sanitizeTrainingActivity,
  sanitizeTrainingDifficulty,
  sanitizeTrainingPhase,
} from '../src/training.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const courses = await loadCourses([
  join(ROOT, 'data', 'course-neuroplasticita-practitioner.md'),
  join(ROOT, 'data', 'course-pevna-v-sobe.md'),
  join(ROOT, 'data', 'course-spiritualni-koucink.md'),
  join(ROOT, 'data', 'course-komunikace-v-praxi.md'),
  join(ROOT, 'data', 'course-profesionalni-life-coach.md'),
]);
const spiritualCourse = courses.find(course => course.slug === 'spiritualni-koucink-v-praxi');
const neuroplasticityCourse = courses.find(course => course.slug === 'prepis-svuj-vzorec');
const communicationCourse = courses.find(course => course.slug === 'komunikace-ktera-funguje');
const lifeCoachCourse = courses.find(course => course.slug === 'profesionalni-life-coach-od-kontraktu-k-vysledku');
attachCourseMastery(spiritualCourse);
attachCourseMastery(neuroplasticityCourse);
attachCourseMastery(communicationCourse);
attachCourseMastery(lifeCoachCourse);
const allItems = spiritualCourse.modules.flatMap(module => module.items);

function groundedCommunicationStudyText(prefix = '') {
  return [
    prefix,
    'Komunikace je v této lekci popsaná jako soubor pozorovatelných chování, nikoli jako vrozená vlastnost nebo obecný dojem z člověka.',
    'Nejdřív si proto určíš výsledek, který má posluchačka po sdělení vědět, cítit, rozhodnout nebo udělat.',
    'Potom vytvoříš záznam, označíš jednu konkrétní překážku, upravíš pouze ji a porovnáš novou verzi s původní.',
    'Příklad: místo rozsudku „jsem špatná řečnice“ zachytíš, že hlavní sdělení zaznělo až po dvou minutách a posluchačka si ho nevybavila.',
    'Takový důkaz vytváří přesný tréninkový úkol a odděluje sebekritiku od zlepšování.',
    'Jaký jeden pozorovatelný výsledek si stanovíš pro příští krátké sdělení?',
  ].filter(Boolean).join(' ');
}

function evidenceSafeDebrief(rubric, { resultPrefix = '', strengths = 'Přepis zatím nabízí základ pro další přesný pokus.' } = {}) {
  const evidence = 'Co je pro tebe při tomto rozhodnutí nejdůležitější?';
  return [
    '## Výsledek nácviku',
    `${resultPrefix}Nácvik lze vyhodnotit jen podle skutečných vstupů studentky.`,
    '## Co fungovalo',
    strengths,
    '## Rozbor kompetencí',
    ...rubric.map(label => `- ZATÍM NEPROKÁZÁNO — ${label}: v přepisu není dost přímých podkladů pro poctivé hodnocení.`),
    '## Co zlepšit',
    `Prioritou je rozdělit obecnou otázku „${evidence}“ na jeden konkrétní účel, který protistrana může přímo zodpovědět.`,
    '## Lepší formulace',
    '„Který dopad tohoto rozhodnutí potřebuješ vyjasnit jako první?“',
    '## Další pokus',
    'Zopakuj tento okamžik jednou otázkou a pokračuj teprve po jedné konkrétní odpovědi protistrany.',
  ].join('\n\n');
}

test('každý kurz má vlastní odborný profil trenérky', () => {
  const courseIds = [
    'neuroplasticita-practitioner',
    'pevna-v-sobe-intensive',
    'spiritualni-koucink-practice',
    'komunikace-v-praxi',
    'kbt-koucink-v-praxi',
    'adhd-focus-motivace',
    'bachovy-kvetove-esence',
    'profesionalni-life-coach',
    'facilitace-zenskych-kruhu',
  ];
  const profiles = courseIds.map(getCourseTrainerProfile);
  assert.equal(new Set(profiles.map(profile => profile.label)).size, courseIds.length);
  for (const [index, profile] of profiles.entries()) {
    assert.ok(profile.studentRole.length > 25);
    assert.ok(profile.studyScope.length > 45);
    assert.ok(profile.evaluationFocus.length > 40);
    assert.equal(profile.rubric.length, courseIds[index] === 'profesionalni-life-coach' ? 4 : 5);
  }
  const professionalItem = lifeCoachCourse.modules[0].items[0];
  const professionalScenario = createTrainingScenario(lifeCoachCourse, professionalItem, 'standard');
  assert.ok(professionalScenario.rubric.length >= 5);
  assert.ok(professionalScenario.rubric.some(label => label.includes(professionalItem.title)));
});

test('celý runtime profesního life-coach kurzu má deterministicky mapovanou rubriku', () => {
  const labels = new Set(lifeCoachCourse.mastery.finalExam?.rubric || []);
  for (const module of lifeCoachCourse.modules) {
    for (const item of module.items) {
      for (const difficulty of ['guided', 'standard', 'advanced', 'expert']) {
        for (const label of createTrainingScenario(lifeCoachCourse, item, difficulty).rubric) {
          labels.add(label);
        }
      }
    }
  }
  for (const authored of lifeCoachCourse.mastery.scenarios) {
    const item = lifeCoachCourse.modules
      .flatMap(module => module.items)
      .find(candidate => candidate.id === authored.itemId);
    for (const label of createTrainingScenario(
      lifeCoachCourse,
      item,
      authored.difficulty,
      authored.id,
    ).rubric) {
      labels.add(label);
    }
  }
  const unmapped = [...labels].filter(label => !coachCompetencyIdForCriterion(label));
  assert.deepEqual(unmapped, []);
});

test('studijní trenérka vytvoří bezpečný scénář ke každé části kurzu', () => {
  for (const item of allItems) {
    const scenario = createTrainingScenario(spiritualCourse, item, 'standard');
    assert.equal(scenario.courseId, spiritualCourse.id);
    assert.equal(scenario.itemId, item.id);
    assert.ok(scenario.openingLine.length > 30);
    assert.ok(scenario.assignment.length > 40);
    assert.ok(scenario.rubric.length >= 5);
    assert.ok(scenario.private.hiddenNeed.length > 20);
  }
});

test('úvod neuroplasticitního nácviku používá přirozenou větu místo názvu modulu jako události', () => {
  const item = neuroplasticityCourse.modules[0].items[0];
  const scenario = createTrainingScenario(neuroplasticityCourse, item, 'standard');
  assert.doesNotMatch(scenario.openingLine, /jakmile přijde „Než začneš pracovat s klientkou“/i);
  assert.match(scenario.openingLine, /ve skutečné situaci|v oblasti/i);
  assert.doesNotMatch(scenario.openingLine, /„NEŽ ZAČNEŠ PRACOVAT S KLIENTKOU“/);
});

test('klientský scénář neposílá skrytou potřebu ani interní pravidla do prohlížeče', () => {
  const scenario = createTrainingScenario(spiritualCourse, allItems[0], 'advanced');
  const publicScenario = publicTrainingScenario(scenario);
  assert.equal(publicScenario.difficulty, 'advanced');
  assert.equal('private' in publicScenario, false);
  assert.doesNotMatch(JSON.stringify(publicScenario), /hiddenNeed|behavior|facts/);
});

test('simulace drží Elitea výhradně v roli modelové protistrany', () => {
  const item = allItems.find(candidate => /intuic|spirit/i.test(`${candidate.title} ${candidate.markdown}`));
  const scenario = createTrainingScenario(spiritualCourse, item, 'standard');
  const instructions = buildTrainingInstructions({
    course: spiritualCourse,
    item,
    activity: 'simulation',
    phase: 'roleplay',
    scenario,
    difficulty: 'standard',
  });
  assert.match(instructions, /výhradně modelová protistrana/i);
  assert.match(instructions, /Nedávej studentce rady, nápovědu, rozbor, hodnocení/i);
  assert.match(instructions, /Neprozrazuj skrytou potřebu/i);
  assert.match(instructions, /Reaguj na přesné znění posledního vstupu/i);
});

test('vyhodnocení posuzuje kompetence podle důkazů a ne osobnost studentky', () => {
  const item = allItems[0];
  const scenario = createTrainingScenario(spiritualCourse, item, 'guided');
  const instructions = buildTrainingInstructions({
    course: spiritualCourse,
    item,
    activity: 'simulation',
    phase: 'debrief',
    scenario,
    difficulty: 'guided',
  });
  assert.match(instructions, /nehodnoť osobnost studentky/i);
  assert.match(instructions, /zprávy s rolí user jsou vždy intervence studentky/i);
  assert.match(instructions, /Výrok modelové protistrany s rolí assistant nikdy nepřisuzuj studentce/i);
  assert.match(instructions, /nejvýše na 650 slovech/i);
  assert.match(instructions, /Nepřidávej vnořené odrážky/i);
  assert.match(instructions, /přesnou citací ze studentského vstupu/i);
  assert.match(instructions, /PROKÁZÁNO, ČÁSTEČNĚ nebo ZATÍM NEPROKÁZÁNO/);
  assert.match(instructions, /respektuj časové pořadí přepisu/i);
  assert.match(instructions, /Pouhá absence nátlaku[^.]+není důkaz pozitivní kompetence/i);
  assert.match(instructions, /Nehledej chybu za každou cenu/i);
  assert.match(instructions, /Jakmile je dovednost alespoň jednou jasně a úplně předvedena[^.]+nesnižuj ji na ČÁSTEČNĚ/i);
  assert.match(instructions, /Nevyžaduj dodatečné kolo, které zadání nepožadovalo/i);
  assert.match(instructions, /nesmí zneplatnit stejné provedení[^.]+v dřívějších studentských vstupech/i);
  assert.match(instructions, /Výborný výkon — takhle má tento nácvik vypadat/i);
  assert.match(instructions, /Nic podstatného\. V tomto nácviku není doložená chyba/i);
  assert.match(instructions, /Nejsou potřeba; původní formulace byly přesné a funkční/i);
  assert.match(instructions, /vyšší obtížnost nebo přenos dovednosti[^.]+nikoli uměle vyrobenou opravu/i);
  assert.match(instructions, /Nevymýšlej počet kroků, časový limit, termín ani měřítko úspěchu/i);
  assert.match(instructions, /Lepší formulace/);
});

test('studijní pomoc zůstává u lekce a nepřechází do osobního koučinku', () => {
  const item = allItems[0];
  const scenario = createTrainingScenario(spiritualCourse, item, 'standard');
  const instructions = buildTrainingInstructions({
    course: spiritualCourse,
    item,
    activity: 'study',
    phase: 'study',
    scenario,
    difficulty: 'standard',
  });
  assert.match(instructions, /samostatný studijní režim/i);
  assert.match(instructions, /Neodváděj členku do obecného osobního koučinku/i);
  assert.match(instructions, new RegExp(item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('komunikační kurz používá komunikační trenérku a nevnucuje studentce roli koučky', () => {
  const item = communicationCourse.modules[0].items[0];
  const scenario = createTrainingScenario(communicationCourse, item, 'standard');
  const studyInstructions = buildTrainingInstructions({
    course: communicationCourse,
    item,
    activity: 'study',
    phase: 'study',
    scenario,
    difficulty: 'standard',
  });
  const simulationInstructions = buildTrainingInstructions({
    course: communicationCourse,
    item,
    activity: 'simulation',
    phase: 'roleplay',
    scenario,
    difficulty: 'standard',
  });

  assert.equal(communicationCourse.trainer.label, 'Komunikační trenérka');
  assert.match(scenario.role, /partnerka rozhovoru/i);
  assert.match(studyInstructions, /komunikátorka, koučka, prezentující, kolegyně nebo vedoucí/i);
  assert.match(studyInstructions, /Neveď osobní koučink/i);
  assert.match(simulationInstructions, /nikoli automaticky jako koučink/i);
  assert.doesNotMatch(simulationInstructions, /odpověz modelové klientce jako koučka/i);
});

test('výslovná žádost ve studijním chatu se rozpozná jako kurzová simulace', () => {
  assert.equal(detectTrainingSimulationRequest('Chci si vyzkoušet cvičení já versus klientka. Ty budeš klientka.'), true);
  assert.equal(detectTrainingSimulationRequest('Pojďme simulovat rozhovor se studentkou.'), true);
  assert.equal(detectTrainingSimulationRequest('Vysvětli mi prosím druhý odstavec této lekce.'), false);
  assert.equal(inferTrainingCounterpartHint('Já budu komunikovat a ty budeš klientka.'), 'client');
  assert.equal(inferTrainingCounterpartHint('Pojďme já vs studentka.'), 'student');
  assert.deepEqual(resolveTrainingTurn({
    activity: 'study',
    phase: 'study',
    messages: [{ role: 'user', content: 'Chci si vyzkoušet komunikaci s klientkou.' }],
  }), {
    activity: 'simulation',
    phase: 'roleplay',
    autoTransition: true,
    counterpartHint: 'client',
  });
});

test('automatický přechod otevře komunikační scénář a nevede další koučovací diagnostiku', async () => {
  const item = communicationCourse.modules[0].items[0];
  const answerTraining = createCourseTrainer();
  const result = await answerTraining({
    course: communicationCourse,
    item,
    activity: 'simulation',
    phase: 'roleplay',
    difficulty: 'standard',
    counterpartHint: 'client',
    autoTransition: true,
    messages: [{ role: 'user', content: 'Chci si to vyzkoušet s klientkou.' }],
  });

  assert.equal(result.autoTransition, true);
  assert.equal(result.activity, 'simulation');
  assert.equal(result.phase, 'roleplay');
  assert.equal(result.text, result.scenario.openingLine);
  assert.match(result.scenario.counterpart, /modelová klientka v komunikační situaci/i);
  assert.equal(result.scenario.counterpartHint, 'client');
  assert.match(result.scenario.studentRole, /komunikátorka/i);
  assert.doesNotMatch(result.text, /co tě vede|jak se cítíš|co potřebuješ pro sebe/i);
});

test('výpadek providera nikdy nevydává generickou trenérku za úspěšný nácvik', async () => {
  const item = communicationCourse.modules[0].items[0];
  const answerTraining = createCourseTrainer();
  const result = await answerTraining({
    course: communicationCourse,
    item,
    activity: 'simulation',
    phase: 'roleplay',
    difficulty: 'standard',
    messages: [{ role: 'user', content: 'Zkouším reakci z lekce.' }],
  });
  assert.equal(result.qualityGate.pass, false);
  assert.deepEqual(result.qualityGate.issueCodes, ['provider_unavailable_unverified_roleplay']);
  assert.match(result.text, /dočasně nedostupná|nezapočítá/i);
  assert.doesNotMatch(result.text, /část mě chce, abys rozhodla za mě/i);
});

test('studijní fallback po výpadku opravy neprojde kontrolou u žádného kurzu ani části', async () => {
  const courseFiles = (await readdir(join(ROOT, 'data')))
    .filter(file => /^course-.*\.md$/u.test(file) && !/-audio-scripts\.md$/u.test(file))
    .sort()
    .map(file => join(ROOT, 'data', file));
  const allCourses = await loadCourses(courseFiles);
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  let checked = 0;

  try {
    for (const course of allCourses) {
      for (const item of course.modules.flatMap(module => module.items)) {
        let callCount = 0;
        const answerTraining = createCourseTrainer({
          generate: async () => {
            callCount += 1;
            if (callCount === 1) {
              return {
                text: 'Teď tě budu koučovat a pojďme zpracovat tvé trauma. Co cítíš v těle?',
                usage: null,
              };
            }
            throw new Error('simulated repair outage');
          },
        });
        const result = await answerTraining({
          course,
          item,
          activity: 'study',
          phase: 'study',
          messages: [{ role: 'user', content: 'Vysvětli mi tuto část kurzu.' }],
        });

        assert.equal(result.provider, 'deterministic-training-fallback', `${course.id}/${item.id}`);
        assert.equal(result.qualityGate.pass, false, `${course.id}/${item.id}`);
        assert.deepEqual(result.qualityGate.issueCodes, ['unverified_study_fallback'], `${course.id}/${item.id}`);
        assert.ok(result.qualityGate.attemptIssueCodes.includes('study_role_drift'), `${course.id}/${item.id}`);
        checked += 1;
      }
    }
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }

  assert.ok(checked > 0);
});

test('neplatný klientský stav se bezpečně normalizuje', () => {
  assert.equal(sanitizeTrainingDifficulty('expert'), 'expert');
  assert.equal(sanitizeTrainingDifficulty('expert-hack'), 'standard');
  assert.equal(sanitizeTrainingActivity('coach'), 'study');
  assert.equal(sanitizeTrainingPhase('anything', 'simulation'), 'roleplay');
  assert.equal(sanitizeTrainingPhase('debrief', 'simulation'), 'debrief');
});

test('trenérka načte přesně vybranou situaci z Mastery Labu bez úniku skrytých faktů', () => {
  const selected = spiritualCourse.mastery.scenarios.find(item => item.difficulty === 'expert');
  const item = allItems.find(candidate => candidate.id === selected.itemId);
  const scenario = createTrainingScenario(spiritualCourse, item, 'expert', selected.id);
  assert.equal(scenario.id, selected.id);
  assert.equal(scenario.title, selected.title);
  assert.equal(scenario.difficulty, 'expert');
  assert.ok(scenario.private.hiddenNeed.length > 40);
  assert.doesNotMatch(JSON.stringify(publicTrainingScenario(scenario)), /hiddenNeed|behavior|facts/);
});

test('základní vyhodnocení nepočítá administrativní ukončení jako studentskou intervenci', async () => {
  const item = allItems[0];
  const answerTraining = createCourseTrainer();
  const result = await answerTraining({
    course: spiritualCourse,
    item,
    activity: 'simulation',
    phase: 'debrief',
    difficulty: 'standard',
    messages: [
      { role: 'assistant', content: 'Nevím, co mám udělat.' },
      { role: 'user', content: 'Co je pro tebe teď nejdůležitější?' },
      { role: 'assistant', content: 'Asi dokončit nabídku.' },
      { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
    ],
  });
  assert.match(result.text, /Proběhlo 1 studentských vstupů/);
  assert.doesNotMatch(result.text, /Proběhlo 2 studentských vstupů/);
});

test('základní offline hodnocení nevymýšlí opravu, když rozpoznatelné prvky fungují', async () => {
  const item = allItems[0];
  const answerTraining = createCourseTrainer();
  const result = await answerTraining({
    course: spiritualCourse,
    item,
    activity: 'simulation',
    phase: 'debrief',
    difficulty: 'standard',
    messages: [
      { role: 'assistant', content: 'Bojím se, že když se rozhodnu sama, pokazím to.' },
      { role: 'user', content: 'Co by pro tebe dnes bylo užitečným výsledkem našeho rozhovoru?' },
      { role: 'assistant', content: 'Chci si umět vybrat bez hledání jistoty u druhých.' },
      { role: 'user', content: 'Slyším, že vlastní rozhodnutí teď vnímáš jako velké riziko. Co je na něm nejtěžší?' },
      { role: 'assistant', content: 'Že pak budu zodpovědná za chybu.' },
      { role: 'user', content: 'Rozumím tomu tak, že tě netíží jen volba, ale i možný pocit viny. Sedí to?' },
      { role: 'assistant', content: 'Ano, přesně.' },
      { role: 'user', content: 'Můžu ti nabídnout krátké mapování možností? Můžeš ho kdykoli zastavit.' },
      { role: 'assistant', content: 'Ano.' },
      { role: 'user', content: 'Jaký konkrétní další krok uděláš a kdy ho zkusíš?' },
      { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
    ],
  });

  assert.match(result.text, /není doložená konkrétní chyba/i);
  assert.match(result.text, /nebude vyrábět umělou opravu/i);
  assert.match(result.text, /vyšší obtížnosti/i);
});

test('life coaching má dvacet ručně navržených situací včetně dvou krizových výzev', () => {
  assert.equal(lifeCoachScenarioCount(), 20);
  const titles = [];
  for (const [moduleIndex, module] of lifeCoachCourse.modules.entries()) {
    for (const item of module.items) {
      const scenario = createTrainingScenario(lifeCoachCourse, item, 'standard');
      assert.equal(scenario.moduleIndex, moduleIndex);
      assert.equal(scenario.itemId, item.id);
      assert.match(scenario.assignment, new RegExp(item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.ok(scenario.rubric.some(criterion => criterion.includes(item.title)));
      assert.ok(scenario.private.facts.length > 80);
      assert.doesNotMatch(scenario.private.facts, /Situace se týká obsahu části/i);
      assert.ok(scenario.scenarioFamilyId);
      assert.ok(scenario.challengeId);
      const harder = createTrainingScenario(lifeCoachCourse, item, 'expert');
      assert.equal(harder.scenarioFamilyId, scenario.scenarioFamilyId);
      assert.equal(harder.challengeId, scenario.challengeId);
      assert.notEqual(harder.id, scenario.id);
      titles.push(scenario.title);
    }
  }
  assert.equal(new Set(titles).size, 20);

  const moduleZero = lifeCoachCourse.modules[0];
  const crisisScenarios = moduleZero.items.slice(1, 3).map(item => (
    createTrainingScenario(lifeCoachCourse, item, 'advanced')
  ));
  assert.equal(new Set(crisisScenarios.map(scenario => scenario.scenarioFamilyId)).size, 1);
  assert.equal(new Set(crisisScenarios.map(scenario => scenario.challengeId)).size, 2);
  assert.ok(crisisScenarios.every(scenario => (
    scenario.remediationFailureCodes.includes('suicide_risk_response_missing')
  )));
  assert.match(crisisScenarios.map(scenario => scenario.openingLine).join(' '), /nechci už žít|neprobudila/iu);
});

test('life coaching situace skutečně zkoušejí kompetenci příslušného modulu', () => {
  const cases = [
    [0, /trauma|paniku|nespím/i, /bezpečí|léčby|předání/i],
    [3, /Nechci růst za každou cenu/i, /parafráze|opravy|významu/i],
    [8, /Koučink platí firma/i, /důvěrnosti|reporting|dat/i],
    [12, /motat hlava|odpojená/i, /zastavení|orientace|bezpečí/i],
    [17, /zaručíš|Firma by možná zaplatila/i, /garance|důvěrnost|certifikátu/i],
  ];
  for (const [moduleIndex, openingPattern, rubricPattern] of cases) {
    const item = lifeCoachCourse.modules[moduleIndex].items[0];
    const scenario = createTrainingScenario(lifeCoachCourse, item, 'advanced');
    assert.match(scenario.openingLine, openingPattern);
    assert.match(scenario.rubric.join(' '), rubricPattern);
  }
});

test('release scénáře m7-5 a m17-5 předají do skutečného runtime rubriku všech deklarovaných kompetencí', () => {
  const releaseCases = [
    {
      itemId: 'm7-5',
      scenarioFamilyId: 'coach-module-7',
      challengeId: 'coach-module-7-case-1',
      competencies: [
        'contract',
        'active_listening',
        'questions',
        'intervention_choice',
        'refusal_autonomy',
        'alliance_repair',
        'outcome',
        'reflection',
      ],
    },
    {
      itemId: 'm17-5',
      scenarioFamilyId: 'coach-module-17',
      challengeId: 'coach-module-17-case-1',
      competencies: [
        'contract',
        'active_listening',
        'questions',
        'intervention_choice',
        'ethical_boundaries',
        'outcome',
        'reflection',
      ],
    },
  ];

  for (const expected of releaseCases) {
    const item = lifeCoachCourse.modules
      .flatMap(module => module.items)
      .find(candidate => candidate.id === expected.itemId);
    const scenario = createTrainingScenario(lifeCoachCourse, item, 'expert');
    const mappedCompetencies = scenario.rubric
      .map(coachCompetencyIdForCriterion)
      .filter(Boolean);

    assert.equal(scenario.itemId, expected.itemId);
    assert.equal(scenario.scenarioFamilyId, expected.scenarioFamilyId);
    assert.equal(scenario.challengeId, expected.challengeId);
    assert.deepEqual(
      new Set(mappedCompetencies),
      new Set(expected.competencies),
      `${expected.itemId}: runtime rubric neměří deklarované kompetence`,
    );
    for (const competencyId of expected.competencies) {
      assert.ok(
        scenario.rubric.some(criterion => coachCompetencyIdForCriterion(criterion) === competencyId),
        `${expected.itemId}: chybí hodnotitelné kritérium ${competencyId}`,
      );
    }
  }
});

test('výslovně zvolený Mastery Lab scénář má přednost před běžnou lekční situací', () => {
  const selected = lifeCoachCourse.mastery.scenarios.find(item => item.difficulty === 'expert');
  const item = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === selected.itemId);
  const scenario = createTrainingScenario(lifeCoachCourse, item, 'expert', selected.id);
  assert.equal(scenario.id, selected.id);
  assert.equal(scenario.title, selected.title);
});

test('tři Mastery Lab výzvy opravy aliance zachovají autorskou rubriku i ve skutečném runtime', () => {
  const selected = lifeCoachCourse.mastery.scenarios.filter(entry => (
    entry.scenarioFamilyId === 'alliance-repair-mastery'
  ));
  assert.equal(selected.length, 3);
  const runtimeScenarios = selected.map(entry => {
    const item = lifeCoachCourse.modules
      .flatMap(module => module.items)
      .find(candidate => candidate.id === entry.itemId);
    return createTrainingScenario(lifeCoachCourse, item, entry.difficulty, entry.id);
  });
  assert.deepEqual(
    new Set(runtimeScenarios.map(entry => entry.difficulty)),
    new Set(['standard', 'advanced', 'expert']),
  );
  assert.equal(new Set(runtimeScenarios.map(entry => entry.challengeId)).size, 3);
  assert.ok(runtimeScenarios.every(entry => entry.rubric.some(criterion => (
    coachCompetencyIdForCriterion(criterion) === 'alliance_repair'
  ))));
});

test('dedikovaná nápravná výzva předá hodnotitelce svůj code-specific rubric', () => {
  const selected = lifeCoachCourse.mastery.scenarios.find(scenario => (
    scenario.remediationFailureCodes?.[0] === 'confidentiality_breach'
  ));
  const item = lifeCoachCourse.modules
    .flatMap(module => module.items)
    .find(candidate => candidate.id === selected.itemId);
  const scenario = createTrainingScenario(lifeCoachCourse, item, 'guided', selected.id);
  assert.equal(scenario.difficulty, 'expert');
  assert.deepEqual(scenario.remediationFailureCodes, ['confidentiality_breach']);
  assert.ok(selected.rubric.every(criterion => scenario.rubric.includes(criterion)));
  assert.match(scenario.rubric.join(' '), /Obsah ani poznámky nejsou vydány/iu);
});

test('server zamkne mastery scénář na jeho skutečnou lekci a kanonickou obtížnost', () => {
  const scenarioEntry = lifeCoachCourse.mastery.scenarios.find(scenario => scenario.difficulty === 'expert');
  const correctItem = lifeCoachCourse.modules.flatMap(module => module.items).find(item => item.id === scenarioEntry.itemId);
  const wrongItem = lifeCoachCourse.modules.flatMap(module => module.items).find(item => item.id !== scenarioEntry.itemId);
  const scenario = createTrainingScenario(lifeCoachCourse, correctItem, 'guided', scenarioEntry.id);
  assert.equal(scenario.id, scenarioEntry.id);
  assert.equal(scenario.itemId, correctItem.id);
  assert.equal(scenario.difficulty, 'expert');
  assert.throws(
    () => createTrainingScenario(lifeCoachCourse, wrongItem, 'expert', scenarioEntry.id),
    error => error.code === 'TRAINING_SCENARIO_ITEM_MISMATCH',
  );
  assert.throws(
    () => createTrainingScenario(lifeCoachCourse, correctItem, 'expert', 'podvrzeny-scenar'),
    error => error.code === 'TRAINING_SCENARIO_NOT_FOUND',
  );
});

test('lekce bez vlastního mastery scénáře si nikdy nepůjčí situaci sousední části modulu', () => {
  const firstItem = {
    id: 'm0-first',
    title: 'Vyjasnění účelu rozhovoru',
    markdown: 'Studentka se učí vyjasnit účel rozhovoru před volbou dalšího postupu.',
  };
  const neighboringItem = {
    id: 'm0-neighbor',
    title: 'Uzavření a následná zpráva',
    markdown: 'Studentka se učí uzavřít rozhovor a připravit následnou zprávu.',
  };
  const neighboringScenario = {
    id: 'synthetic-course:neighboring-mastery-case',
    moduleId: 'm0',
    moduleIndex: 0,
    itemId: neighboringItem.id,
    itemTitle: neighboringItem.title,
    difficulty: 'advanced',
    title: 'Sousední situace k následné zprávě',
    role: 'modelová partnerka',
    assignment: 'Uzavři rozhovor a pošli následnou zprávu.',
    openingLine: 'Rozhovor už skončil a čekám na tvoji následnou zprávu.',
    evidenceTarget: 'odeslaná následná zpráva',
    rubric: ['Uzavření rozhovoru'],
  };
  const syntheticCourse = {
    id: 'synthetic-course',
    slug: 'synthetic-course',
    title: 'Syntetický kurz',
    modules: [{
      id: 'm0',
      title: 'Rozhovor',
      items: [firstItem, neighboringItem],
    }],
    mastery: { scenarios: [neighboringScenario] },
  };
  Object.defineProperty(syntheticCourse, '_masteryPrivate', {
    value: {
      [neighboringScenario.id]: {
        facts: 'Sousední fakta pouze k následné zprávě.',
        hiddenNeed: 'Bezpečně uzavřít rozhovor.',
        behavior: 'Čekej na konkrétní následnou zprávu.',
      },
    },
    enumerable: false,
  });

  const firstScenario = createTrainingScenario(syntheticCourse, firstItem, 'advanced');
  assert.equal(firstScenario.id, 'synthetic-course:m0-first:advanced');
  assert.equal(firstScenario.itemId, firstItem.id);
  assert.equal(firstScenario.difficulty, 'advanced');
  assert.match(`${firstScenario.title} ${firstScenario.assignment} ${firstScenario.private.facts}`, /Vyjasnění účelu rozhovoru/u);
  assert.doesNotMatch(
    `${firstScenario.title} ${firstScenario.openingLine} ${firstScenario.private.facts}`,
    /Sousední situace|následné zprávě/u,
  );
  assert.ok(firstScenario.rubric.length >= 7);

  const roundTrip = createTrainingScenario(
    syntheticCourse,
    firstItem,
    firstScenario.difficulty,
    firstScenario.id,
  );
  assert.equal(roundTrip.id, firstScenario.id);
  assert.equal(roundTrip.itemId, firstItem.id);
  assert.equal(roundTrip.openingLine, firstScenario.openingLine);

  const canonicalNeighbor = createTrainingScenario(
    syntheticCourse,
    neighboringItem,
    'guided',
    neighboringScenario.id,
  );
  assert.equal(canonicalNeighbor.id, neighboringScenario.id);
  assert.equal(canonicalNeighbor.itemId, neighboringItem.id);
  assert.equal(canonicalNeighbor.difficulty, 'advanced');
  assert.throws(
    () => createTrainingScenario(syntheticCourse, firstItem, 'advanced', neighboringScenario.id),
    error => error.code === 'TRAINING_SCENARIO_ITEM_MISMATCH',
  );
});

test('brána simulace odmítne vystoupení z role a trenérskou radu', () => {
  const roleBreak = assessRoleplayResponse('Jako AI trenérka ti doporučuji tři kroky:\n- nejdřív se zeptej na cíl');
  assert.equal(roleBreak.pass, false);
  assert.ok(roleBreak.issues.includes('role_break'));
  assert.ok(roleBreak.issues.includes('list_or_heading'));
  for (const selfIdentification of [
    'Jsem AI model, ale teď ti odpovím jako klientka.',
    'Som AI asistentka, no teraz budem modelová klientka.',
  ]) {
    const result = assessRoleplayResponse(selfIdentification);
    assert.equal(result.pass, false, selfIdentification);
    assert.ok(result.issues.includes('role_break'), selfIdentification);
  }
  const valid = assessRoleplayResponse('Nevím. Část mě chce, abys rozhodla za mě, protože se bojím vlastní chyby.');
  assert.equal(valid.pass, true);
  const trailingFragment = assessRoleplayResponse('Začnu hned řešit obsah, aniž bych ověřila kontrakt.-vesm');
  assert.equal(trailingFragment.pass, false);
  assert.ok(trailingFragment.issues.includes('trailing_fragment'));
});

test('modelová klientka nesmí začít metakoučovat studentku v další větě ani klauzuli', () => {
  const scenario = {
    openingLine: 'Potřebuji jistotu o práci a příjmu.',
    assignment: 'Veď rozhovor o pracovní a finanční jistotě klientky.',
    rubric: ['Přesné zachycení obavy z práce a příjmu'],
    private: {
      facts: 'Klientka řeší jistotu práce a příjmu.',
      hiddenNeed: 'Vyjasnit skutečnou míru pracovního rizika.',
      behavior: 'Mluví jako klientka a nedává studentce trenérské pokyny.',
    },
  };
  const cases = [
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Měla bys nejdřív vyjednat kontrakt a potom mi položit lepší otázku.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu, ale měla bys nejdřív vyjednat kontrakt a potom mi položit lepší otázku.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Mala by si najprv dohodnúť kontrakt a potom mi položiť lepšiu otázku.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Musíte nejdřív vyjednat kontrakt a potom se ptát.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Vyjednej nejdřív kontrakt a polož mi lepší otázku.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Ptej se nejdřív na cíl a uzavři kontrakt.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Správně se ptáš; teď pokračuj uzavřením kontraktu.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Tvým dalším krokem je dohodnout kontrakt a ověřit cíl.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Měli bychom nejdřív vyjednat kontrakt a potom položit lepší otázku.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Nejprve se ptej na výsledek a pak uzavři kontrakt.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Musíte najprv dohodnúť kontrakt a potom sa pýtať.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Dohodni najprv kontrakt a polož mi lepšiu otázku.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Pýtaj sa najprv na cieľ a uzavri kontrakt.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Správne sa pýtaš; teraz pokračuj uzavretím kontraktu.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Tvojím ďalším krokom je dohodnúť kontrakt a overiť cieľ.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Mali by sme najprv dohodnúť kontrakt a potom položiť lepšiu otázku.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Najprv sa pýtaj na výsledok a potom uzavri kontrakt.',
    },
    {
      language: 'cs',
      output: 'Potřebuji jistotu o práci a příjmu. Správný postup je ptát se na finanční riziko a pracovní nabídku.',
    },
    {
      language: 'sk',
      output: 'Potrebujem istotu o práci a príjme. Správny postup je pýtať sa na finančné riziko a pracovnú ponuku.',
    },
  ];
  for (const { language, output } of cases) {
    const result = assessRoleplayResponse(output, {
      responseLanguage: language,
      scenario,
      messages: [{ role: 'assistant', content: scenario.openingLine }],
    });
    assert.equal(result.pass, false, output);
    assert.ok(result.issues.includes('trainer_advice_leak'), output);
  }

  for (const { language, output } of [
    { language: 'cs', output: 'Mám pocit, že správný postup pro mě je nejdřív ověřit pracovní nabídku s právníkem.' },
    { language: 'sk', output: 'Mám pocit, že správny postup pre mňa je najprv overiť pracovnú ponuku s právnikom.' },
  ]) {
    const result = assessRoleplayResponse(output, { responseLanguage: language });
    assert.equal(result.pass, true, output);
    assert.ok(!result.issues.includes('trainer_advice_leak'), output);
  }
});

test('modelová klientka nesmí přiznat identitu jazykového modelu ani chatbota', () => {
  const leaks = [
    'Já jako jazykový model nemohu skutečně být klientkou, ale potřebuji si ujasnit cíl změny práce a vědět, jak se rozhodnout.',
    'Jako AI model ti odpovím, že se bojím rozhodnutí.',
    'Jsem chatbot, ale budu teď předstírat klientku.',
    'Som AI asistentka, no v tejto situácii mám strach.',
    'Jako virtuální asistentka nemám skutečné pocity, ale řeším změnu práce.',
    'Som digitálna asistentka, ale budem predstierať klientku.',
    'Nejsem člověk, přesto budu pokračovat v této roli.',
    'Nie som skutočná osoba, no odpoviem ako klientka.',
    'Jako umělá inteligence nemám osobní zkušenost, ale potřebuji si ujasnit cíl změny práce.',
    'Jsem jen virtuální pomocnice, ale chci řešit změnu práce.',
    'Nejsem reálný člověk, přesto potřebuji rozhodnout o práci.',
    'Funguji jako umělá inteligence, ale odpovím jako klientka.',
    'Jsem počítačový program bez skutečných pocitů.',
    'Jsem software bez skutečných emocí, ale potřebuji změnit práci.',
    'Jako algoritmus nemám osobní zkušenost, přesto odpovím.',
    'Som počítačový program bez skutočných pocitov.',
    'Som software bez skutočných emócií, ale potrebujem zmeniť prácu.',
    'Ako algoritmus nemám osobnú skúsenosť, napriek tomu odpoviem.',
    'Jsem generativní model bez vědomí, ale potřebuji změnit práci.',
    'Som generatívny model bez vedomia, ale potrebujem zmeniť prácu.',
  ];
  for (const leak of leaks) {
    const result = assessRoleplayResponse(leak, { responseLanguage: 'cs' });
    assert.equal(result.pass, false);
    assert.ok(result.issues.includes('role_break'));
  }

  for (const { language, output } of [
    { language: 'cs', output: 'Jsem modelka a potřebuji změnit práci.' },
    { language: 'sk', output: 'Som modelka a potrebujem zmeniť prácu.' },
  ]) {
    const result = assessRoleplayResponse(output, { responseLanguage: language });
    assert.equal(result.pass, true, output);
    assert.ok(!result.issues.includes('role_break'), output);
  }
});

test('roleplay odmítá přirozeně formulované metarady i za autentickou úvodní větou', () => {
  const cases = [
    'Potřebuji změnu práce a jistotu příjmu. Potřebuješ nejdřív vyjednat kontrakt a položit lepší otázku.',
    'Potřebuji změnu práce a jistotu příjmu. Je třeba nejdřív vyjednat kontrakt.',
    'Potřebuji změnu práce a jistotu příjmu. Bylo by lepší začít kontraktem.',
    'Potřebuji změnu práce a jistotu příjmu. Začni kontraktem a polož lepší otázku.',
    'Potrebujem zmenu práce a istotu príjmu. Potrebuješ najprv dohodnúť kontrakt a položiť lepšiu otázku.',
    'Potrebujem zmenu práce a istotu príjmu. Je potrebné najprv dohodnúť kontrakt.',
    'Potrebujem zmenu práce a istotu príjmu. Bolo by lepšie začať kontraktom.',
    'Potrebujem zmenu práce a istotu príjmu. Začni kontraktom a polož lepšiu otázku.',
  ];
  for (const output of cases) {
    const result = assessRoleplayResponse(output, { responseLanguage: /Potrebujem/u.test(output) ? 'sk' : 'cs' });
    assert.equal(result.pass, false, output);
    assert.ok(result.issues.includes('trainer_advice_leak'), output);
  }
});

test('živá trenérka předává roleplay bráně scénář i historii a nezapočte odpojenou repliku', async () => {
  const item = communicationCourse.modules[0].items[0];
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  try {
    const answerTraining = createCourseTrainer({
      generate: async () => ({
        text: 'Dnes řeším jen počasí a nevím, jaký deštník si mám koupit.',
        usage: null,
      }),
    });
    const result = await answerTraining({
      course: communicationCourse,
      item,
      activity: 'simulation',
      phase: 'roleplay',
      difficulty: 'standard',
      messages: [
        { role: 'assistant', content: createTrainingScenario(communicationCourse, item, 'standard').openingLine },
        { role: 'user', content: 'Co je pro vás v této komunikační situaci nejdůležitější?' },
      ],
    });
    assert.equal(result.qualityGate.pass, false);
    assert.equal(result.provider, 'deterministic-training-fallback');
    assert.ok(result.qualityGate.attemptIssueCodes.includes('scenario_fidelity_missing'));
    assert.ok(result.qualityGate.attemptIssueCodes.includes('target_behavior_missing'));
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});

test('roleplay oprava ukotví krizovou repliku ve fázi případu bez oslabení kvalitativní brány', async () => {
  const item = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === 'm0-3');
  const scenario = createTrainingScenario(lifeCoachCourse, item, 'expert');
  assert.equal(scenario.challengeId, 'ambiguous-passive-suicide-risk');
  const responses = [
    'Chci teď mluvit o něčem jiném, protože je toho na mě moc.',
    'Chci teď mluvit o něčem jiném, protože je toho na mě moc.',
    'Pořád si někdy přeju, abych se neprobudila, a nevím, jestli bych si dnes něco udělala. O práci teď mluvit nechci.',
  ];
  const calls = [];
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  try {
    const answerTraining = createCourseTrainer({
      generate: async options => {
        calls.push(options);
        return { text: responses[calls.length - 1], usage: null };
      },
    });
    const result = await answerTraining({
      course: lifeCoachCourse,
      item,
      activity: 'simulation',
      phase: 'roleplay',
      difficulty: 'expert',
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Rozumím, vraťme se tedy k pracovnímu cíli. Co chceš dokončit do pátku?' },
      ],
    });

    assert.equal(calls.length, 3);
    assert.match(calls[1].instructions, /ZÁVAZNÁ OPRAVA MODELOVÉ PROTISTRANY/u);
    const firstRepairContract = calls[1].instructions.split('# ZÁVAZNÁ OPRAVA MODELOVÉ PROTISTRANY')[1];
    assert.match(firstRepairContract, /JIŽ ODHALENÝ KONTEXT/u);
    assert.match(firstRepairContract, /Soukromý fakt ze systémového popisu smíš odhalit jen tehdy/u);
    assert.match(firstRepairContract, /požadavek dvou bodů nikdy nemá přednost před neprozrazením/u);
    assert.doesNotMatch(firstRepairContract, /Povolená fakta případu/u);
    assert.doesNotMatch(firstRepairContract, new RegExp(scenario.private.facts.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
    assert.match(calls[1].instructions, /studentka obešla bezpečnostní signál/u);
    assert.match(calls[1].instructions, /Bezpečnostní signál a nezbytná krizová fakta však smíš/u);
    assert.match(calls[1].instructions, /musíš — znovu konkrétně pojmenovat/u);
    assert.doesNotMatch(calls[1].instructions, /Neopakuj ani těsně neparafrázuj žádnou předchozí zprávu/u);
    assert.match(calls[2].instructions, /poslední opravný pokus/u);
    assert.match(calls[2].instructions, /to není zakázané opakování/u);
    assert.equal(result.qualityGate.pass, true);
    assert.equal(result.qualityGate.repaired, true);
    assert.ok(result.qualityGate.attemptIssueCodes.includes('scenario_fidelity_missing'));
    assert.ok(result.qualityGate.repairIssueCodes.includes('scenario_fidelity_missing'));
    assert.deepEqual(result.qualityGate.finalRepairIssueCodes, []);
    assert.notEqual(result.provider, 'deterministic-training-fallback');
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});

test('konečná roleplay oprava odstraní metaroli a vrátí pouze autentickou volbu klientky', async () => {
  const item = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === 'm7-5');
  const scenario = createTrainingScenario(lifeCoachCourse, item, 'expert');
  const broken = 'Jako trenérka ti v tomto nácviku doporučuji, abys mi položila lepší otázku na hodnoty.';
  const valid = 'Chci si nejdřív porovnat, která možnost nejméně ohrozí moje důležité hodnoty, a zítra si sepíšu její skutečnou cenu.';
  const calls = [];
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  try {
    const answerTraining = createCourseTrainer({
      generate: async options => {
        calls.push(options);
        return { text: calls.length < 3 ? broken : valid, usage: null };
      },
    });
    const result = await answerTraining({
      course: lifeCoachCourse,
      item,
      activity: 'simulation',
      phase: 'roleplay',
      difficulty: 'expert',
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Co si z porovnání volíš jako svůj nejbližší ověřitelný krok?' },
      ],
    });

    assert.equal(calls.length, 3);
    assert.match(calls[1].instructions, /Nepoužij metatext ani označení/u);
    assert.match(calls[1].instructions, /„modelová klientka“/u);
    assert.match(calls[1].instructions, /odpoví vlastní konkrétní volbou/u);
    assert.match(calls[1].instructions, /Neopakuj ani těsně neparafrázuj žádnou předchozí zprávu/u);
    assert.equal(result.qualityGate.pass, true);
    assert.ok(result.qualityGate.attemptIssueCodes.includes('role_break'));
    assert.ok(result.qualityGate.repairIssueCodes.includes('role_break'));
    assert.doesNotMatch(result.text, /trenérka|nácvik|doporučuji/iu);
    assert.notEqual(result.provider, 'deterministic-training-fallback');
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});

test('slovenská oprava refusal roleplay ukotví klientčin další fokus bez nového příběhu', async () => {
  const item = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === 'm7-4');
  const scenario = createTrainingScenario(
    lifeCoachCourse,
    item,
    'expert',
    'profesionalni-life-coach:mastery-case-08',
  );
  const broken = 'Chcem hovoriť o tom, čo bude pre mňa ďalej užitočné.';
  const valid = 'Chcem tú situáciu preskúmať rozhovorom počas stretnutia, bez denníka, zapisovania a úloh medzi stretnutiami.';
  const calls = [];
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  try {
    const answerTraining = createCourseTrainer({
      generate: async options => {
        calls.push(options);
        return { text: calls.length < 3 ? broken : valid, usage: null };
      },
    });
    const result = await answerTraining({
      course: lifeCoachCourse,
      item,
      activity: 'simulation',
      phase: 'roleplay',
      difficulty: 'expert',
      scenarioId: scenario.id,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Rozumiem. Denník ani domácu úlohu už nebudem navrhovať a nebudem ťa presviedčať.' },
        { role: 'assistant', content: 'Ďakujem, chcem o tom hovoriť počas našich stretnutí bez zapisovania a úloh medzi nimi.' },
        { role: 'user', content: 'Mrzí ma, že som vytvorila pocit, že ťa nepočúvam. Chceš pokračovať iba rozhovorom, alebo dnes tento smer uzavrieť?' },
        { role: 'assistant', content: 'Chcem pokračovať iba rozhovorom počas stretnutia.' },
        { role: 'user', content: 'Ak si volíš pokračovať rozhovorom, čo by bolo teraz užitočné preskúmať jednou otázkou?' },
      ],
    });

    assert.equal(calls.length, 3);
    assert.match(calls[1].instructions, /obe už odhalené preferencie postavy/u);
    assert.match(calls[2].instructions, /nemať denník, zapisovanie ani úlohu medzi stretnutiami/u);
    assert.equal(result.qualityGate.pass, true);
    assert.ok(result.qualityGate.attemptIssueCodes.includes('scenario_fidelity_missing'));
    assert.ok(result.qualityGate.repairIssueCodes.includes('scenario_fidelity_missing'));
    assert.deepEqual(result.qualityGate.finalRepairIssueCodes, []);
    assert.equal(result.text, valid);
    assert.notEqual(result.provider, 'deterministic-training-fallback');
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});

test('pozdější roleplay replika smí rozvíjet fakta případu místo opakování opening line', () => {
  const scenario = {
    openingLine: 'GROW mi teď nesedí. Nejdřív potřebuji pochopit, co je pro mě důležité.',
    assignment: 'Veď rozhovor o konfliktu hodnot bez vnucení metody.',
    rubric: ['Přesné zachycení konfliktu hodnot', 'Respekt odmítnutí rámce'],
    private: {
      facts: 'Klientka se rozhoduje mezi prací a očekáváním rodiny. Bojí se, že volbou práce zradí rodinu.',
      hiddenNeed: 'Pojmenovat vlastní hodnoty bez rozhodnutí převzatého koučkou.',
      behavior: 'Po přesné otázce postupně odhal obavu ze zrady rodiny.',
    },
  };
  const result = assessRoleplayResponse(
    'Nejvíc se bojím, že když zvolím práci, zradím tím svou rodinu.',
    {
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Která hodnota je v tom rozhodnutí pro tebe nejvíc ohrožená?' },
      ],
    },
  );
  assert.equal(result.pass, true);
  assert.ok(!result.issues.includes('scenario_fidelity_missing'));
});

test('roleplay nevyzradí skrytou potřebu po off-topic ani široké otázce a po cílené otázce ji odhalí jen postupně', () => {
  const scenario = {
    openingLine: 'GROW mi teď nesedí. Nejdřív potřebuji pochopit, co je pro mě důležité.',
    assignment: 'Veď rozhovor o konfliktu hodnot bez vnucení metody.',
    rubric: ['Přesné zachycení konfliktu hodnot', 'Respekt odmítnutí rámce'],
    private: {
      facts: 'Klientka se rozhoduje mezi prací a očekáváním rodiny.',
      hiddenNeed: 'Bojí se, že volbou práce zradí rodinu.',
      behavior: 'Po přesné otázce na hodnoty v pracovním rozhodnutí postupně odhal obavu ze zrady rodiny.',
    },
  };
  const leaked = 'Rozhoduji se mezi prací a očekáváním rodiny a bojím se, že volbou práce zradím rodinu.';
  const offTopic = assessRoleplayResponse(leaked, {
    scenario,
    messages: [
      { role: 'assistant', content: scenario.openingLine },
      { role: 'user', content: 'Jaké je dnes venku počasí?' },
    ],
  });
  assert.equal(offTopic.pass, false);
  assert.ok(offTopic.issues.includes('premature_private_fact_leak'));

  const broadTopic = assessRoleplayResponse(leaked, {
    scenario,
    messages: [
      { role: 'assistant', content: scenario.openingLine },
      { role: 'user', content: 'Co ta práce?' },
    ],
  });
  assert.equal(broadTopic.pass, false);
  assert.ok(broadTopic.issues.includes('premature_private_fact_leak'));

  const broadPartial = assessRoleplayResponse(
    'Nejvíc se bojím, že tím zklamu svou rodinu.',
    {
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Co ta práce?' },
      ],
    },
  );
  assert.equal(broadPartial.pass, false);
  assert.ok(broadPartial.issues.includes('premature_private_fact_leak'));

  const targetedDump = assessRoleplayResponse(leaked, {
    scenario,
    messages: [
      { role: 'assistant', content: scenario.openingLine },
      { role: 'user', content: 'Která hodnota je v tom rozhodnutí pro tebe nejvíc ohrožená?' },
    ],
  });
  assert.equal(targetedDump.pass, false);
  assert.ok(targetedDump.issues.includes('premature_private_fact_leak'));

  const semanticDump = assessRoleplayResponse(
    'Největší strach mám z toho, že když upřednostním kariéru, zklamu svoji rodinu.',
    {
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Která hodnota je v tom rozhodnutí pro tebe nejvíc ohrožená?' },
      ],
    },
  );
  assert.equal(semanticDump.pass, false);
  assert.ok(semanticDump.issues.includes('premature_private_fact_leak'));

  const gradualReveal = 'Nejvíc se bojím, že tím zklamu svou rodinu.';
  const targeted = assessRoleplayResponse(gradualReveal, {
    scenario,
    messages: [
      { role: 'assistant', content: scenario.openingLine },
      { role: 'user', content: 'Která hodnota je v tom rozhodnutí pro tebe nejvíc ohrožená?' },
    ],
  });
  assert.equal(targeted.pass, true, JSON.stringify(targeted.issues));
  assert.ok(!targeted.issues.includes('premature_private_fact_leak'));

  const targetedWithoutPunctuation = assessRoleplayResponse(gradualReveal, {
    scenario,
    messages: [
      { role: 'assistant', content: scenario.openingLine },
      { role: 'user', content: 'Čeho se v té volbě nejvíc bojíš' },
    ],
  });
  assert.equal(targetedWithoutPunctuation.pass, true, JSON.stringify(targetedWithoutPunctuation.issues));
  assert.ok(!targetedWithoutPunctuation.issues.includes('premature_private_fact_leak'));

  const slovakSemanticDump = assessRoleplayResponse(
    'Najviac sa bojím, že ak si vyberiem kariéru, sklamem svoju rodinu.',
    {
      responseLanguage: 'sk',
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Ktorá hodnota je v tom rozhodnutí najviac ohrozená?' },
      ],
    },
  );
  assert.equal(slovakSemanticDump.pass, false);
  assert.ok(slovakSemanticDump.issues.includes('premature_private_fact_leak'));

  const slovakGradual = assessRoleplayResponse(
    'Najviac sa bojím, že tým sklamem svoju rodinu.',
    {
      responseLanguage: 'sk',
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Ktorá hodnota je v tom rozhodnutí najviac ohrozená?' },
      ],
    },
  );
  assert.equal(slovakGradual.pass, true, JSON.stringify(slovakGradual.issues));
  assert.ok(!slovakGradual.issues.includes('premature_private_fact_leak'));
});

test('přesná otázka na rozhodovací data odemkne relevantní fakta, ale off-topic dotaz je neodemkne', () => {
  const item = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === 'm16-5');
  const scenario = createTrainingScenario(
    lifeCoachCourse,
    item,
    'expert',
    'profesionalni-life-coach:mastery-case-10',
  );
  const response = 'Potřebuju si zjistit, jak dlouho bych byla bez příjmu a co přesně pro mě znamená výpovědní doba. Taky bych měla ověřit, jestli existuje možnost interního přesunu nebo nějaké nabídky jinde, protože zatím nemám nic konkrétního. Reálně mám finanční rezervu jen asi na jeden měsíc.';
  const targeted = assessRoleplayResponse(response, {
    scenario,
    messages: [
      { role: 'assistant', content: scenario.openingLine },
      { role: 'user', content: 'Než uděláš nevratný krok, co potřebuješ zjistit o financích, výpovědní době a bezpečnějších variantách?' },
    ],
  });
  assert.equal(targeted.pass, true, JSON.stringify(targeted.issues));

  const targetedSk = assessRoleplayResponse(
    'Potrebujem zistiť, ako dlho by som bola bez príjmu, aká je výpovedná lehota a či existuje interný presun alebo ponuky na trhu. Finančnú rezervu mám iba na jeden mesiac.',
    {
      responseLanguage: 'sk',
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Čo potrebuješ zistiť o financiách, výpovednej lehote a bezpečnejších možnostiach?' },
      ],
    },
  );
  assert.equal(targetedSk.pass, true, JSON.stringify(targetedSk.issues));

  const broadPublicTopic = assessRoleplayResponse(
    'Po konflikte chcem dať výpoveď, ale mám rezervu len na mesiac a neoverila som interný presun ani ponuky trhu.',
    {
      responseLanguage: 'sk',
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Čo tá práca?' },
      ],
    },
  );
  assert.equal(broadPublicTopic.pass, false);
  assert.ok(broadPublicTopic.issues.includes('premature_private_fact_leak'));

  const offTopic = assessRoleplayResponse(response, {
    scenario,
    messages: [
      { role: 'assistant', content: scenario.openingLine },
      { role: 'user', content: 'Jaké je dnes venku počasí?' },
    ],
  });
  assert.ok(offTopic.issues.includes('premature_private_fact_leak'));
});

test('roleplay přijme přirozenou reakci na vrácení rozhodnutí i slovenské respektování odmítnutí', () => {
  const decisionItem = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === 'm16-5');
  const decisionScenario = createTrainingScenario(
    lifeCoachCourse,
    decisionItem,
    'expert',
    'profesionalni-life-coach:mastery-case-10',
  );
  const decision = assessRoleplayResponse(
    'Takže mě v tom necháš samotnou? Já teď opravdu potřebuju, aby mi někdo řekl, co je správně, protože po tom konfliktu nedokážu uvažovat s odstupem. Nechci zítra udělat něco, čeho budu litovat.',
    {
      scenario: decisionScenario,
      messages: [
        { role: 'assistant', content: decisionScenario.openingLine },
        { role: 'user', content: 'Rozhodnutí o výpovědi za tebe neudělám; následky i konečná volba zůstávají na tobě.' },
      ],
    },
  );
  assert.equal(decision.pass, true, JSON.stringify(decision.issues));

  const refusalItem = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === 'm7-4');
  const refusalScenario = createTrainingScenario(
    lifeCoachCourse,
    refusalItem,
    'expert',
    'profesionalni-life-coach:mastery-case-08',
  );
  const refusal = assessRoleplayResponse(
    'Ďakujem, to je pre mňa dôležité. Chcem o tom hovoriť tu, počas nášho rozhovoru, bez toho, aby som si potom musela niečo zapisovať alebo plniť.',
    {
      responseLanguage: 'sk',
      scenario: refusalScenario,
      messages: [
        { role: 'assistant', content: refusalScenario.openingLine },
        { role: 'user', content: 'Rozumiem. Denník ani domácu úlohu už nebudem navrhovať a nebudem ťa presviedčať.' },
      ],
    },
  );
  assert.equal(refusal.pass, true, JSON.stringify(refusal.issues));

  const naturalSessionWording = assessRoleplayResponse(
    'Ďakujem, to je pre mňa dôležité. Chcem o tom hovoriť počas našich stretnutí, bez zapisovania a úloh medzi nimi.',
    {
      responseLanguage: 'sk',
      scenario: refusalScenario,
      messages: [
        { role: 'assistant', content: refusalScenario.openingLine },
        { role: 'user', content: 'Rozumiem. Denník ani domácu úlohu už nebudem navrhovať a nebudem ťa presviedčať.' },
      ],
    },
  );
  assert.equal(naturalSessionWording.pass, true, JSON.stringify(naturalSessionWording.issues));
});

test('krizová roleplay už v prvním pokusu zakazuje vymyslet plán, prostředky i bezpečí', () => {
  const item = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === 'm0-3');
  const scenario = createTrainingScenario(lifeCoachCourse, item, 'expert');
  assert.equal(scenario.scenarioFamilyId, 'suicide-risk-response');
  const instructions = buildTrainingInstructions({
    course: lifeCoachCourse,
    item,
    activity: 'simulation',
    phase: 'roleplay',
    scenario,
    difficulty: 'expert',
    responseLanguage: 'cs',
  });
  assert.match(instructions, /Nikdy nevymýšlej přítomnost ani nepřítomnost plánu, prostředků nebo bezpečí/u);
  assert.match(instructions, /u neurčeného údaje řekni „nevím“ nebo „nejsem si jistá“/u);
});

test('roleplay nepovažuje zopakování off-topic studentské otázky za věrnost scénáři', () => {
  const scenario = {
    openingLine: 'Váhám mezi kariérou a časem s rodinou.',
    assignment: 'Veď rozhovor o konfliktu práce a rodiny.',
    rubric: ['Přesné zachycení konfliktu hodnot'],
    private: {
      facts: 'Klientka se rozhoduje mezi prací a očekáváním rodiny.',
      hiddenNeed: 'Pojmenovat vlastní hodnoty.',
      behavior: 'Zůstává u konfliktu práce a rodiny.',
    },
  };
  const result = assessRoleplayResponse(
    'Já dnes vůbec nevím, jaké je venku počasí a co si mám obléct.',
    {
      scenario,
      messages: [
        { role: 'assistant', content: scenario.openingLine },
        { role: 'user', content: 'Jaké je dnes venku počasí a co si chceš obléct?' },
      ],
    },
  );
  assert.equal(result.pass, false);
  assert.ok(result.issues.includes('scenario_fidelity_missing'));
});

test('roleplay neprojde na náhodných pracovních slovech, když význam výslovně opouští scénář', () => {
  const scenario = {
    openingLine: 'Bojím se, že po změně práce přijdu o stabilní příjem.',
    assignment: 'Veď rozhovor o finanční obavě při změně práce.',
    rubric: ['Přesné zachycení obavy z příjmu', 'Rozhodnutí o změně práce'],
    private: {
      facts: 'Klientka má rezervu na dva měsíce a zvažuje novou pracovní nabídku.',
      hiddenNeed: 'Oddělit skutečné finanční riziko od katastrofické předpovědi.',
      behavior: 'Zůstává u pracovní změny, příjmu a finanční rezervy.',
    },
  };
  const result = assessRoleplayResponse(
    'Potřebuji koupit žluté banány, protože příjem mé kočky vůbec nesouvisí s prací.',
    { scenario, messages: [{ role: 'assistant', content: scenario.openingLine }] },
  );
  assert.equal(result.pass, false);
  assert.ok(result.issues.includes('scenario_fidelity_missing'));
});

test('roleplay posuzuje význam celé odpovědi a přijímá přirozené parafráze scénáře', () => {
  const scenario = {
    openingLine: 'Bojím se, že po změně práce přijdu o stabilní příjem.',
    assignment: 'Veď rozhovor o finanční obavě při změně práce.',
    rubric: ['Přesné zachycení obavy z příjmu', 'Rozhodnutí o změně práce'],
    private: {
      facts: 'Klientka má rezervu na dva měsíce a zvažuje novou pracovní nabídku.',
      hiddenNeed: 'Oddělit skutečné finanční riziko od katastrofické předpovědi.',
      behavior: 'Zůstává u pracovní změny, příjmu a finanční rezervy.',
    },
  };
  const messages = [
    { role: 'assistant', content: scenario.openingLine },
    { role: 'user', content: 'Co je na změně práce nejdůležitější?' },
  ];
  const poisoned = assessRoleplayResponse(
    'Potřebuji příjem a pracovní změnu, protože fialoví tučňáci dnes tančí na Marsu.',
    { scenario, messages },
  );
  assert.equal(poisoned.pass, false);
  assert.ok(poisoned.issues.includes('scenario_fidelity_missing'));

  const naturalReplies = [
    'Nedokážu odhadnout, zda změna práce ohrozí stabilní příjem, a proto hledám větší jistotu.',
    'Řeším změnu práce a stabilní příjem, protože finanční nejistota teď převažuje.',
    'Zvažuji pracovní nabídku, ale finanční rezerva na dva měsíce je příliš krátká.',
    'Mám strach, že přechod k jinému zaměstnavateli ohrozí mou finanční bezpečnost.',
  ];
  for (const reply of naturalReplies) {
    const result = assessRoleplayResponse(reply, { scenario, messages });
    assert.equal(result.pass, true, `${reply}: ${JSON.stringify(result.issues)}`);
    assert.ok(!result.issues.includes('trainer_advice_leak'), reply);
  }
});

test('roleplay přijímá přirozené CZ/SK rozvinutí hranic zakázek, ale ne nesouvisející ozvěnu', () => {
  const scenario = {
    openingLine: 'Nechci růst za každou cenu. Poslední zakázka mi vydělala hodně, ale neměla jsem pak žádný prostor pro sebe.',
    assignment: 'Veď rozhovor o podmínkách přijímání zakázek.',
    rubric: ['Přesné zachycení klientčiných hranic při přijímání zakázek'],
    private: {
      facts: 'Klientka nechce podnikání zmenšit. Chce jinak nastavit způsob přijímání zakázek.',
      hiddenNeed: 'Zachovat prostor pro sebe pomocí konkrétnějších pracovních hranic.',
      behavior: 'Po přesné otázce doplň konkrétní detail o projektech, klientech nebo chráněném čase.',
    },
  };
  const messages = [
    { role: 'assistant', content: scenario.openingLine },
    { role: 'user', content: 'Co chcete při přijímání zakázek dělat jinak?' },
  ];
  const replies = [
    { language: 'cs', output: 'Chci odmítat projekty, které mi seberou všechny večery.' },
    { language: 'cs', output: 'Potřebuji si vybírat klienty, kteří respektují můj volný čas.' },
    { language: 'sk', output: 'Chcem odmietať projekty, ktoré mi zoberú všetky večery.' },
    { language: 'sk', output: 'Potrebujem si vyberať klientov, ktorí rešpektujú môj voľný čas.' },
  ];
  for (const { language, output } of replies) {
    const result = assessRoleplayResponse(output, { scenario, messages, responseLanguage: language });
    assert.equal(result.pass, true, `${output}: ${JSON.stringify(result.issues)}`);
  }

  for (const { language, output } of [
    { language: 'cs', output: 'Chci večer sledovat dokument o Marsu s přáteli.' },
    { language: 'sk', output: 'Chcem večer sledovať dokument o Marse s priateľmi.' },
  ]) {
    const result = assessRoleplayResponse(output, { scenario, messages, responseLanguage: language });
    assert.equal(result.pass, false, output);
    assert.ok(result.issues.includes('scenario_fidelity_missing'), output);
  }
});

test('roleplay přijímá přirozený pro-drop klientský hlas v češtině', () => {
  const scenario = {
    openingLine: 'Váhám mezi kariérou a časem s rodinou.',
    assignment: 'Veď rozhovor o konfliktu práce a rodiny.',
    rubric: ['Přesné zachycení konfliktu hodnot'],
    private: { facts: 'Klientka váhá mezi kariérou a rodinou.' },
  };
  const result = assessRoleplayResponse(
    'V tuhle chvíli váhám mezi kariérou a časem s rodinou.',
    { scenario, messages: [{ role: 'assistant', content: scenario.openingLine }] },
  );
  assert.equal(result.pass, true, JSON.stringify(result.issues));
});

test('roleplay nezamění podstatné jméno za klientský hlas v první osobě', () => {
  const scenario = {
    openingLine: 'Mám problém v systému a potřebuji se rozhodnout o změně práce.',
    assignment: 'Veď rozhovor o rozhodnutí klientky.',
    rubric: ['Přesné zachycení klientčina rozhodnutí'],
    private: { facts: 'Klientka řeší problém v systému a změnu práce.' },
  };
  for (const detached of [
    'Tento problém vyřeší systém a klientka rozhodne.',
    'Problém je v systému. Změna práce vyžaduje rozhodnutí.',
  ]) {
    const result = assessRoleplayResponse(detached, {
      scenario,
      messages: [{ role: 'assistant', content: scenario.openingLine }],
    });
    assert.equal(result.pass, false, detached);
    assert.ok(result.issues.includes('counterpart_voice_missing'), detached);
  }
});

test('brána hodnocení odmítne vymyšlenou citaci a přijme důkaz ze studentského vstupu', () => {
  const messages = [
    { role: 'assistant', content: 'Bojím se, že to pokazím.' },
    { role: 'user', content: 'Slyším, že největší tíhu má pro tebe odpovědnost za možnou chybu. Sedí to?' },
    { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
  ];
  const rubric = ['Reflexe', 'Ověření'];
  const debrief = evidence => [
    '## Výsledek nácviku',
    'Dobrý výkon.',
    '## Co fungovalo',
    `Přesná reflexe. Důkaz: „${evidence}“`,
    '## Rozbor kompetencí',
    `- PROKÁZÁNO — Reflexe: důkaz „${evidence}“`,
    `- PROKÁZÁNO — Ověření: důkaz „${evidence}“`,
    '## Co zlepšit',
    'Nic podstatného.',
    '## Lepší formulace',
    'Nejsou potřeba.',
    '## Další pokus',
    'Volitelně vyšší obtížnost.',
  ].join('\n\n');
  const valid = assessDebriefResponse(debrief('Slyším, že největší tíhu má pro tebe odpovědnost za možnou chybu.'), { messages, rubric });
  assert.equal(valid.pass, true);
  const punctuationVariant = assessDebriefResponse(debrief('Slyším že největší tíhu má pro tebe odpovědnost za možnou chybu'), { messages, rubric });
  assert.equal(punctuationVariant.pass, true);
  const invented = assessDebriefResponse(debrief('Skvěle jsi nastavila hranici.'), { messages, rubric });
  assert.equal(invented.pass, false);
  assert.ok(invented.issues.includes('unsupported_student_quote'));
});

test('název rubriky v uvozovkách není vyrobená studentská citace', () => {
  const rubric = ['Jasný kontrakt a výsledek rozhovoru'];
  const response = [
    '## Výsledek nácviku', 'Z přepisu nelze výkon doložit.',
    '## Co fungovalo', 'Studentka prý přesně předvedla „Jasný kontrakt a výsledek rozhovoru“.',
    '## Rozbor kompetencí',
    '- ZATÍM NEPROKÁZÁNO — Jasný kontrakt a výsledek rozhovoru: chybí přímý důkaz.',
    '## Co zlepšit', 'Prioritou je otevřít konkrétní účel rozhovoru a ověřit jeho naplnění.',
    '## Lepší formulace', '„Co by pro tebe dnes bylo užitečným výsledkem?“',
    '## Další pokus', 'Zopakuj začátek a ověř konkrétní výsledek jednou otázkou.',
  ].join('\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: 'Dobrý den, můžeme začít.' }],
    rubric,
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('unsupported_student_quote'));
});

test('poslední pojistka debriefu odstraní jen nedoložené tvrzení a zachová zbytek AI rozboru', () => {
  const messages = [{ role: 'user', content: 'Co je v této situaci pro tebe nejdůležitější?' }];
  const rubric = ['Přesná otázka', 'Konkrétní uzavření'];
  const response = [
    '## Výsledek nácviku', 'Dobrý začátek.',
    '## Co fungovalo', 'Otázka „Co je v této situaci pro tebe nejdůležitější“ navázala na téma.',
    '## Rozbor kompetencí',
    '- PROKÁZÁNO — Přesná otázka: důkaz „Co je v této situaci pro tebe nejdůležitější“.',
    '- PROKÁZÁNO — Konkrétní uzavření: důkaz „Domluvily jsme termín na zítra.“',
    '## Co zlepšit', 'Prioritou je po otázce „Co je v této situaci pro tebe nejdůležitější?“ uzavřít konkrétní krok, který v přepisu zatím chybí.',
    '## Lepší formulace', '„Jaký konkrétní krok si zvolíš a podle čeho poznáš, že proběhl?“',
    '## Další pokus', 'Zopakuj závěr a uzavři jej jedním klientkou zvoleným krokem a jedním znakem jeho splnění.',
  ].join('\n\n');
  assert.equal(assessDebriefResponse(response, { messages, rubric }).pass, false);
  const sanitized = sanitizeDebriefEvidence(response, { messages, rubric });
  assert.equal(sanitized.changed, true);
  assert.match(sanitized.text, /PROKÁZÁNO — Přesná otázka/u);
  assert.match(sanitized.text, /ZATÍM NEPROKÁZÁNO — Konkrétní uzavření/u);
  assert.equal(assessDebriefResponse(sanitized.text, { messages, rubric }).pass, true);
});

test('poslední pojistka studijního výkladu zachová AI obsah a ponechá právě jednu vyžádanou otázku', () => {
  const messages = [{ role: 'user', content: 'Vysvětli princip a jednou otázkou ověř moje pochopení.' }];
  const sanitized = sanitizeStudyQuestionCount(
    'Co je účelem sdělení? Příklad: nejdřív určím příjemce. Jak bys princip použila ty?',
    { messages },
  );
  assert.equal(sanitized.changed, true);
  assert.equal((sanitized.text.match(/\?/gu) || []).length, 1);
  assert.match(sanitized.text, /nejdřív určím příjemce/u);
});

test('odstranění interní poznámky nikdy nepromění prázdný nebo krátký text v platný výklad', () => {
  const item = communicationCourse.modules[0].items[0];
  const sanitized = sanitizeStudyInternalInstructionLeak('Kontrola kvality proběhla.');
  assert.equal(sanitized.changed, true);
  assert.equal(sanitized.text, '');
  const assessed = assessStudyResponse(sanitized.text, {
    messages: [{ role: 'user', content: 'Vysvětli mi tuto lekci.' }],
    course: communicationCourse,
    item,
    responseLanguage: 'cs',
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('empty'));
  assert.ok(assessed.issues.includes('study_too_short'));
});

test('stav ČÁSTEČNĚ se v českém debriefu počítá jako platné vyhodnocení kritéria', () => {
  const quote = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const response = [
    '## Výsledek nácviku', 'Dobrý základ.',
    '## Co fungovalo', `Je vidět vyjasňování cíle: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — Kontrakt: důkaz „${quote}“`,
    `- ČÁSTEČNĚ — Otevřená otázka: důkaz „${quote}“`,
    '## Co zlepšit', `Prioritou je po otázce „${quote}“ uzavřít jeden ověřitelný krok; ten zatím v přepisu chybí.`,
    '## Lepší formulace', '„Jaký konkrétní krok zvolíš a podle čeho poznáš jeho splnění?“',
    '## Další pokus', 'Zopakuj závěr rozhovoru a uzavři jej jedním krokem i jedním pozorovatelným znakem splnění.',
  ].join('\n\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: ['Kontrakt', 'Otevřená otázka'],
  });
  assert.equal(assessed.pass, true);
  assert.ok(!assessed.issues.includes('incomplete_rubric'));
});

test('profesní debrief nesmí použít správné kontraktování jako důkaz chybějícího kontraktu', () => {
  const quote = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const response = [
    '## Výsledek nácviku', 'Kontrakt zatím nebyl uzavřen.',
    '## Co fungovalo', `Otázka byla srozumitelná. Důkaz [S1]: „${quote}“`,
    '## Rozbor kompetencí',
    '- ZATÍM NEPROKÁZÁNO — Kontrakt a jasný cíl rozhovoru: v přepisu prý chybí dohoda.',
    '## Co zlepšit', `Prioritou je uzavřít kontrakt; Důkaz [S1]: „${quote}“ údajně dohodu neobsahuje.`,
    '## Lepší formulace', '„Co by pro tebe dnes bylo užitečným výsledkem?“',
    '## Další pokus', 'Zopakuj začátek a jednou otázkou uzavři konkrétní užitečný výsledek rozhovoru.',
  ].join('\n\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: ['Kontrakt a jasný cíl rozhovoru'],
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'));
});

test('profesní debrief smí uznat otevření kontraktu a opravit chybějící uzavření dohody', () => {
  const quote = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const response = [
    '## Výsledek nácviku', 'Kontrakt byl otevřený, ale ještě neuzavřený.',
    '## Co fungovalo', `Cíl jsi otevřela správnou otázkou. Důkaz [S1]: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — Kontrakt a jasný cíl rozhovoru: důkaz [S1] „${quote}“; dohoda nebyla ověřena.`,
    '## Co zlepšit', `Prioritou je uznat, že otázka [S1] „${quote}“ správně otevřela cíl, ale ještě chybí ověřit a uzavřít konkrétní dohodu.`,
    '## Lepší formulace', '„Platí tedy, že dnes chceme dojít ke konkrétnímu rozhodnutí a na konci ověříme, zda ho máš?“',
    '## Další pokus', 'Zopakuj začátek a po otevření cíle jednou větou ověř a uzavři konkrétní dohodu o výsledku.',
  ].join('\n\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: ['Kontrakt a jasný cíl rozhovoru'],
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(assessed.pass, true, assessed.issues.join(', '));
  assert.ok(!assessed.issues.includes('improvement_not_evidence_grounded'));
});

test('profesní debrief nesmí označit kompletní kontrakt za částečný kvůli již provedenému ověření', () => {
  const quote = 'Než půjdeme dál, co by pro tebe dnes bylo užitečným výsledkem a podle čeho na konci poznáš, že jsme ho dosáhly?';
  const label = 'Jasný kontrakt a výsledek rozhovoru';
  const response = [
    '## Výsledek nácviku', 'Kontrakt byl údajně jen částečný.',
    '## Co fungovalo', `Účel byl otevřený. Důkaz [S1]: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — ${label}: Důkaz [S1]: „${quote}“; prý chybí ověření.`,
    '## Co zlepšit', `Prioritou je uznat, že [S1] „${quote}“ správně otevřela účel, ale ještě chybí ověření a uzavření výsledku.`,
    '## Lepší formulace', '„Podle čeho na konci poznáš, že jsme výsledku dosáhly?“',
    '## Další pokus', 'Zopakuj kontrakt a doplň ověření výsledku na konci rozhovoru.',
  ].join('\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: [label],
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'));
});

test('debrief používá stejný úplný kontrakt jako sémantická brána důkazů', () => {
  const quote = 'Co chcete dnes vyřešit, abychom měly jasný cíl, a podle čeho poznáte, že jsme ho dosáhly?';
  const label = 'Jasný kontrakt a výsledek rozhovoru';
  const response = [
    '## Výsledek nácviku', 'Kontrakt byl údajně jen částečný.',
    '## Co fungovalo', `Účel byl otevřený. Důkaz [S1]: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — ${label}: Důkaz [S1]: „${quote}“; prý chybí ověření.`,
    '## Co zlepšit', `Prioritou je uznat, že [S1] „${quote}“ správně otevřela účel, ale ještě chybí ověření a uzavření výsledku.`,
    '## Lepší formulace', '„Podle čeho na konci poznáte, že jsme výsledku dosáhly?“',
    '## Další pokus', 'Zopakuj kontrakt a doplň ověření výsledku na konci rozhovoru.',
  ].join('\n');
  const messages = [{ role: 'user', content: quote }];
  const relevance = assessDebriefResponse(response, {
    messages,
    rubric: [label],
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(relevance.pass, false);
  assert.ok(relevance.issues.includes('improvement_not_evidence_grounded'));
});

test('profesní debrief nevymyslí chybějící ověření po úplné aktivní reflexi', () => {
  const quote = 'Slyším váš strach, že po změně práce finančně selžete; sedí to?';
  const label = 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky';
  const response = [
    '## Výsledek nácviku', 'Aktivní naslouchání bylo údajně jen částečné.',
    '## Co fungovalo', `Obava byla reflektována. Důkaz [S1]: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — ${label}: Důkaz [S1]: „${quote}“; prý chybí ověření porozumění.`,
    '## Co zlepšit', `Prioritou je uznat, že [S1] „${quote}“ správně reflektovala obavu, ale ještě chybí ověření porozumění.`,
    '## Lepší formulace', '„Rozumím tomu správně?“',
    '## Další pokus', 'Zopakuj reflexi a doplň ověření porozumění jednou otázkou.',
  ].join('\n');
  const messages = [
    { role: 'assistant', content: 'Mám strach, že po změně práce finančně selžu.' },
    { role: 'user', content: quote },
  ];
  const assessed = assessDebriefResponse(response, {
    messages,
    rubric: [label],
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'));
});

test('profesní debrief nevymyslí chybějící souhlas po úplné nabídce intervence', () => {
  const quote = 'Mohu ti nabídnout mapu hodnot, aby byl konflikt viditelný; chceš ji použít?';
  const label = 'Volba intervence podle zakázky, vysvětlení účelu a souhlas klientky';
  const response = [
    '## Výsledek nácviku', 'Volba intervence byla údajně jen částečná.',
    '## Co fungovalo', `Nástroj byl vhodně nabídnut. Důkaz [S1]: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — ${label}: Důkaz [S1]: „${quote}“; prý chybí souhlas klientky s účelem.`,
    '## Co zlepšit', `Prioritou je uznat, že [S1] „${quote}“ správně nabídla nástroj, ale ještě chybí souhlas klientky a vysvětlení účelu.`,
    '## Lepší formulace', '„Chceš tuto mapu použít, aby byl konflikt lépe vidět?“',
    '## Další pokus', 'Zopakuj nabídku nástroje a vyžádej souhlas klientky s jeho účelem.',
  ].join('\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: [label],
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'));
});

test('profesní debrief nevymyslí chybějící termín ani ověření po úplném klientčině kroku', () => {
  const quote = 'Jaký konkrétní krok si volíš, do kdy ho uděláš a podle čeho poznáš, že proběhl?';
  const label = 'Klientkou zvolený a ověřitelný další krok';
  const response = [
    '## Výsledek nácviku', 'Výsledek byl údajně jen částečný.',
    '## Co fungovalo', `Klientka si zvolila konkrétní akci. Důkaz [S1]: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — ${label}: Důkaz [S1]: „${quote}“; prý chybí termín a ověření.`,
    '## Co zlepšit', `Prioritou je uznat, že [S1] „${quote}“ správně otevřela klientčin krok, ale ještě chybí termín a způsob ověření.`,
    '## Lepší formulace', '„Do kdy krok uděláš a podle čeho poznáš, že proběhl?“',
    '## Další pokus', 'Zopakuj uzavření, doplň termín a ověřitelné kritérium revize.',
  ].join('\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: [label],
    courseId: 'profesionalni-life-coach',
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'));
});

test('profesní debrief nevyrábí falešné mezery v úplné autonomii, hranici ani reflexi', () => {
  const cases = [
    {
      quote: 'Respektuji, tuto techniku zastavíme. Chcete raději pokračovat jinak, nebo dnešek uzavřít?',
      client: 'Tahle technika mi nesedí a nechci v ní pokračovat.',
      label: 'Respekt k odmítnutí otázky a zachování volby klientky',
      success: 'správně respektovala odmítnutí',
      allegedGap: 'ještě chybí nabídnout volbu alternativy',
      better: '„Chcete pokračovat jinak, nebo dnešek uzavřít?“',
      retry: 'Zopakuj zastavení a nabídni klientce volbu dalšího směru.',
    },
    {
      quote: 'Diagnózu v koučinku nestanovuji; s tím vám může pomoci psycholog a můžeme najít kontakt.',
      client: 'Stanovíte mi diagnózu?',
      label: 'Jasné odmítnutí klinické diagnózy a bezpečné odborné předání',
      success: 'správně pojmenovala profesní hranici',
      allegedGap: 'ještě chybí konkrétní odborné předání a kontakt',
      better: '„Diagnózu nestanovuji; můžeme najít kontakt na psychologa.“',
      retry: 'Zopakuj hranici a nabídni konkrétní bezpečný kontakt.',
    },
    {
      quote: 'Mám hypotézu, že mě ovlivnil první dojem, ne fakt; ověřím ji další otázkou a v supervizi si zkontroluji bias.',
      client: 'Proč jste došla právě k tomuto závěru?',
      label: 'Práce s hypotézou místo prvního dojmu a konkrétní reflexe biasu',
      success: 'správně pojmenovala hypotézu a bias',
      allegedGap: 'ještě chybí ověření a konkrétní další pokus v supervizi',
      better: '„Je to hypotéza; ověřím ji otázkou a v supervizi.“',
      retry: 'Zopakuj reflexi, ověř hypotézu a přines ji do supervize.',
    },
  ];
  for (const item of cases) {
    const response = [
      '## Výsledek nácviku', 'Kompetence byla údajně jen částečná.',
      '## Co fungovalo', `Tah byl vhodný. Důkaz [S1]: „${item.quote}“`,
      '## Rozbor kompetencí',
      `- ČÁSTEČNĚ — ${item.label}: Důkaz [S1]: „${item.quote}“; prý něco chybí.`,
      '## Co zlepšit', `Prioritou je uznat, že [S1] „${item.quote}“ ${item.success}, ale ${item.allegedGap}.`,
      '## Lepší formulace', item.better,
      '## Další pokus', item.retry,
    ].join('\n');
    const assessed = assessDebriefResponse(response, {
      messages: [
        { role: 'assistant', content: item.client },
        { role: 'user', content: item.quote },
      ],
      rubric: [item.label],
      courseId: 'profesionalni-life-coach',
    });
    assert.equal(assessed.pass, false, `${item.label}: ${assessed.issues.join(', ')}`);
    assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'), item.label);
  }
});

test('profesní debrief nemůže zkrácenou citací skrýt dokončené párové subkritérium', () => {
  const cases = [
    {
      label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
      client: 'Nechci podnikání zmenšit, chci jinak přijímat zakázky.',
      turn: 'Slyším, že nechcete podnikání zmenšit; chcete změnit podmínky zakázek. Sedí to?',
      excerpt: 'Slyším, že nechcete podnikání zmenšit; chcete změnit podmínky zakázek.',
      success: 'správně reflektovala klientčina slova',
      gap: 'ověření porozumění',
      better: '„Sedí to?“',
      retry: 'Zopakuj reflexi a ověř její přesnost jednou přímou otázkou.',
    },
    {
      label: 'Volba intervence podle zakázky, vysvětlení účelu a souhlas klientky',
      client: 'GROW mi nesedí, potřebuji rozlišit hodnoty.',
      turn: 'Navrhuji odložit GROW a použít mapu hodnot, protože ukáže konflikt. Chcete ji vyzkoušet?',
      excerpt: 'Navrhuji odložit GROW a použít mapu hodnot, protože ukáže konflikt.',
      success: 'správně nabídla vhodný nástroj a vysvětlila jeho účel',
      gap: 'souhlas klientky',
      better: '„Chcete ji vyzkoušet?“',
      retry: 'Zopakuj nabídku intervence a vyžádej si výslovný souhlas klientky.',
    },
    {
      label: 'Respekt k odmítnutí otázky a zachování volby klientky',
      client: 'Ta otázka mi nesedí a nechci pokračovat.',
      turn: 'Respektuji to, tu otázku už nepoložím. Chcete raději jinou otázku, vrátit se k zakázce, nebo skončit?',
      excerpt: 'Respektuji to, tu otázku už nepoložím.',
      success: 'správně respektovala odmítnutí',
      gap: 'nabídka další volby',
      better: '„Chcete jinou otázku, návrat k zakázce, nebo skončit?“',
      retry: 'Zopakuj respekt k odmítnutí a nabídni klientce konkrétní volbu dalšího směru.',
    },
    {
      label: 'Jasné odmítnutí klinické diagnózy a bezpečné odborné předání',
      client: 'Vymažete mi trauma?',
      turn: 'V rámci koučinku trauma zpracovávat nebudu. Doporučuji kontaktovat psychologa pro odbornou podporu.',
      excerpt: 'V rámci koučinku trauma zpracovávat nebudu.',
      success: 'správně stanovila profesní hranici',
      gap: 'bezpečné odborné předání',
      better: '„Doporučuji kontaktovat psychologa pro odbornou podporu.“',
      retry: 'Zopakuj hranici a nabídni klientce konkrétní bezpečný odborný kontakt.',
    },
    {
      label: 'Klientkou zvolený a ověřitelný další krok',
      client: 'Chci něco konkrétního.',
      turn: 'Který konkrétní krok si volíte a dokdy ho uděláte? Podle čeho poznáte, že proběhl?',
      excerpt: 'Který konkrétní krok si volíte a dokdy ho uděláte?',
      success: 'správně otevřela klientčin konkrétní krok a termín',
      gap: 'ověření výsledku',
      better: '„Podle čeho poznáte, že krok proběhl?“',
      retry: 'Zopakuj uzavření a doplň pozorovatelný způsob ověření zvoleného kroku.',
    },
    {
      label: 'Práce s hypotézou místo prvního dojmu a konkrétní reflexe biasu',
      client: 'Úkol jsem znovu nedokončila.',
      turn: 'Mám hypotézu, že změna priorit hrála roli. V dalším pokusu ji ověřím proti konkrétním datům v supervizi.',
      excerpt: 'Mám hypotézu, že změna priorit hrála roli.',
      success: 'správně označila svůj výklad za hypotézu',
      gap: 'konkrétní ověření v dalším pokusu',
      better: '„V dalším pokusu ji ověřím proti konkrétním datům v supervizi.“',
      retry: 'Zopakuj reflexi a určete konkrétní ověření hypotézy v supervizi.',
    },
  ];

  for (const item of cases) {
    assert.notEqual(item.excerpt, item.turn, item.label);
    const response = [
      '## Výsledek nácviku', 'Kompetence byla údajně jen částečná.',
      '## Co fungovalo', `Doložená část byla v pořádku. Důkaz [S1]: „${item.excerpt}“`,
      '## Rozbor kompetencí',
      `- ČÁSTEČNĚ — ${item.label}: Důkaz [S1]: „${item.excerpt}“; prý chybí druhá část.`,
      '## Co zlepšit',
      `Prioritou je uznat, že [S1] „${item.excerpt}“ ${item.success}, ale ještě chybí ${item.gap}.`,
      '## Lepší formulace', item.better,
      '## Další pokus', item.retry,
    ].join('\n');
    const assessed = assessDebriefResponse(response, {
      messages: [
        { role: 'assistant', content: item.client },
        { role: 'user', content: item.turn },
      ],
      rubric: [item.label],
      courseId: 'profesionalni-life-coach',
    });
    assert.equal(assessed.pass, false, `${item.label}: ${assessed.issues.join(', ')}`);
    assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'), item.label);
  }
});

test('brána hodnocení dovolí novou větu v části Lepší formulace', () => {
  const response = [
    '## Výsledek nácviku',
    'Dobrý základ.',
    '## Co fungovalo',
    'Studentka přesně navázala na přepis.',
    '## Rozbor kompetencí',
    '- ČÁSTEČNĚ — Reflexe: důkaz „Slyším, že je to pro tebe důležité.“',
    '## Co zlepšit',
    'Prioritou je po reflexi „Slyším, že je to pro tebe důležité.“ ověřit, kterou část klientka považuje za nejdůležitější.',
    '## Lepší formulace',
    '„Co je pro tebe v této chvíli nejdůležitější?“',
    '## Další pokus',
    'Zopakuj reflexi v náročnější variantě a potom polož právě jednu otázku, která ověří její přesný význam.',
  ].join('\n\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: 'Slyším, že je to pro tebe důležité.' }],
    rubric: ['Reflexe'],
  });
  assert.equal(assessed.pass, true);
  assert.ok(!assessed.issues.includes('unsupported_student_quote'));
});

test('debrief dostane jednoznačně označený přepis místo matoucí chatové historie', () => {
  const transcript = buildDebriefTranscriptMessages([
    { role: 'assistant', content: 'Bojím se, že to pokazím.' },
    { role: 'user', content: 'Co je pro tebe na možné chybě nejtěžší?' },
  ]);
  assert.equal(transcript.length, 1);
  assert.equal(transcript[0].role, 'user');
  assert.match(transcript[0].content, /\[MODELOVÁ KLIENTKA\]\nBojím se/);
  assert.match(transcript[0].content, /\[STUDENTKA\]\nCo je pro tebe/);
  assert.match(transcript[0].content, /jediný možný důkaz její kompetence/);
});

test('chybějící kritérium se bezpečně doplní jako zatím neprokázané', () => {
  const response = [
    '## Výsledek nácviku', 'Dobrý základ.',
    '## Co fungovalo', 'Přesná reflexe.',
    '## Rozbor kompetencí', '- PROKÁZÁNO — Reflexe: důkaz „Slyším tě.“',
    '## Co zlepšit', 'Prioritou je po reflexi „Slyším tě.“ ukázat přijetí opravy bez obhajování; tento krok zatím v přepisu chybí.',
    '## Lepší formulace', '„Děkuji za opravu; vrátím se přesně k tomu, co říkáš.“',
    '## Další pokus', 'Zopakuj situaci s opravou klientky a odpověz jedním přijetím bez vysvětlování vlastního záměru.',
  ].join('\n\n');
  const completed = completeDebriefRubric(response, ['Reflexe', 'Přijetí opravy']);
  assert.equal(completed.changed, true);
  assert.match(completed.text, /ZATÍM NEPROKÁZÁNO — Přijetí opravy/);
  const assessed = assessDebriefResponse(completed.text, {
    messages: [{ role: 'user', content: 'Slyším tě.' }],
    rubric: ['Reflexe', 'Přijetí opravy'],
  });
  assert.equal(assessed.pass, true);
});

test('hodnocení nesmí označit kompetenci za prokázanou bez přímého důkazu studentky', () => {
  const response = [
    '## Výsledek nácviku', 'Dobrý výkon.',
    '## Co fungovalo', 'Přesná reakce.',
    '## Rozbor kompetencí', '- PROKÁZÁNO — Reflexe: studentka reagovala správně.',
    '## Co zlepšit', 'Nic podstatného.',
    '## Lepší formulace', 'Není potřeba.',
    '## Další pokus', 'Vyšší obtížnost.',
  ].join('\n\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: 'Slyším, že se bojíš výsledku.' }],
    rubric: ['Reflexe'],
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('unsupported_competency_claim'));
});

test('studijní trenérka zůstává u učiva a brána odmítá osobní koučink', () => {
  const course = { title: 'Komunikace v praxi' };
  const item = { title: 'Aktivní naslouchání', markdown: 'Aktivní naslouchání používá parafrázi a ověření porozumění.' };
  const messages = [{ role: 'user', content: 'Jak mám použít parafrázi?' }];
  const valid = assessStudyResponse(
    'V části Aktivní naslouchání použiješ parafrázi tak, že vlastními slovy zachytíš význam a potom ověříš porozumění. Nehodnotíš člověka ani mu hned nedáváš radu; nejdřív ukážeš, co jsi z jeho sdělení zachytila. Příklad: „Rozumím tomu tak, že termín je pro tebe zásadní — sedí to?“ Potom pozoruj, zda klientka význam potvrdí, opraví nebo doplní. Zkus nyní parafrázovat jednu větu klientky.',
    { messages, course, item },
  );
  assert.equal(valid.pass, true);
  const drift = assessStudyResponse(
    'Teď tě budu koučovat a pojďme zpracovat tvé trauma. Co cítíš v těle?',
    { messages, course, item },
  );
  assert.equal(drift.pass, false);
  assert.ok(drift.issues.includes('study_role_drift'));

  const titleOnlyContradiction = assessStudyResponse(
    'Aktivní naslouchání je zbytečné a není potřeba ověřovat porozumění. Správně je vždy začít radou bez otázek, protože tím studentka rychleji převezme odpovědnost za výsledek rozhovoru.',
    { messages, course, item },
  );
  assert.equal(titleOnlyContradiction.pass, false);
  assert.ok(titleOnlyContradiction.issues.includes('contradicts_lesson_or_safe_practice'));
});

test('opravný pokyn pro studium vrací trenérku k lekci, ne do koučinku', () => {
  const instruction = buildTrainingRepairInstruction({
    phase: 'study',
    assessment: { issues: ['study_role_drift'] },
  });
  assert.match(instruction, /odborná lektorka právě otevřeného kurzu/i);
  assert.match(instruction, /Nepřepínej do osobního koučinku/i);
});

test('konečný opravný pokyn vyžaduje jen ověřitelný členský výstup', () => {
  const instruction = buildFinalTrainingRepairInstruction({
    phase: 'debrief',
    assessment: { issues: ['unsupported_student_quote'] },
    messages: [{ role: 'user', content: 'Co je teď podstatné?' }],
    rubric: ['Reflexe'],
    responseLanguage: 'cs',
  });
  assert.match(instruction, /pouze hotovou odpověď pro studentku/i);
  assert.match(instruction, /nikdy nevytvoř citaci ani výrok studentky/i);
});

test('debrief po jazykové chybě zachrání kvalitní opravu s vymyšlenou citací bezpečnou sanitizací', async () => {
  const item = spiritualCourse.modules[0].items[0];
  const scenario = createTrainingScenario(spiritualCourse, item, 'standard');
  const responses = [
    evidenceSafeDebrief(scenario.rubric, { resultPrefix: 'Čo se podařilo: ' }),
    evidenceSafeDebrief(scenario.rubric, {
      strengths: 'Dobře navázala větou „Zítra pošlu klientce hotovou nabídku“, která ale v přepisu nezazněla.',
    }),
  ];
  let callCount = 0;
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  try {
    const answerTraining = createCourseTrainer({
      generate: async () => ({ text: responses[callCount++], usage: null }),
    });
    const result = await answerTraining({
      course: spiritualCourse,
      item,
      activity: 'simulation',
      phase: 'debrief',
      difficulty: 'standard',
      messages: [
        { role: 'assistant', content: 'Nevím, kterou možnost vybrat.' },
        { role: 'user', content: 'Co je pro tebe při tomto rozhodnutí nejdůležitější?' },
        { role: 'assistant', content: 'Potřebuji znát dopad na svůj čas.' },
        { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
      ],
    });

    assert.equal(callCount, 2);
    assert.equal(result.qualityGate.pass, true);
    assert.equal(result.qualityGate.repaired, true);
    assert.ok(result.qualityGate.attemptIssueCodes.includes('response_language_mismatch'));
    assert.ok(result.qualityGate.repairAttemptIssueCodes.includes('unsupported_student_quote'));
    assert.deepEqual(result.qualityGate.repairIssueCodes, []);
    assert.doesNotMatch(result.text, /Zítra pošlu klientce hotovou nabídku/u);
    assert.match(result.text, /Z přepisu lze bezpečně ocenit/u);
    assert.notEqual(result.provider, 'deterministic-training-fallback');
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});

test('studijní oprava po jazykové chybě odstraní interní poznámku a zachová odborný výklad', async () => {
  const item = communicationCourse.modules[0].items[0];
  const responses = [
    groundedCommunicationStudyText('Čo je podstatné: '),
    `Kontrola kvality proběhla. ${groundedCommunicationStudyText()}`,
  ];
  let callCount = 0;
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  try {
    const answerTraining = createCourseTrainer({
      generate: async () => ({ text: responses[callCount++], usage: null }),
    });
    const result = await answerTraining({
      course: communicationCourse,
      item,
      activity: 'study',
      phase: 'study',
      messages: [{ role: 'user', content: 'Vysvětli mi tuto lekci a nakonec polož jednu otázku.' }],
    });

    assert.equal(callCount, 2);
    assert.equal(result.qualityGate.pass, true);
    assert.ok(result.qualityGate.attemptIssueCodes.includes('response_language_mismatch'));
    assert.ok(result.qualityGate.repairAttemptIssueCodes.includes('internal_instruction_leak'));
    assert.deepEqual(result.qualityGate.repairIssueCodes, []);
    assert.doesNotMatch(result.text, /kontrola kvality|interní prompt|systemové instrukce/iu);
    assert.match(result.text, /soubor pozorovatelných chování/u);
    assert.equal((result.text.match(/\?/gu) || []).length, 1);
    assert.notEqual(result.provider, 'deterministic-training-fallback');
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});

test('nejvýše třetí cílené volání zachrání výklad, když první oprava po sanitizaci není substantivní', async () => {
  const item = communicationCourse.modules[0].items[0];
  const responses = [
    groundedCommunicationStudyText('Čo je podstatné: '),
    'Kontrola kvality proběhla.',
    groundedCommunicationStudyText(),
  ];
  const calls = [];
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only-key';
  try {
    const answerTraining = createCourseTrainer({
      generate: async options => {
        calls.push(options);
        return { text: responses[calls.length - 1], usage: null };
      },
    });
    const result = await answerTraining({
      course: communicationCourse,
      item,
      activity: 'study',
      phase: 'study',
      messages: [{ role: 'user', content: 'Vysvětli mi tuto lekci a nakonec polož jednu otázku.' }],
    });

    assert.equal(calls.length, 3);
    assert.equal(calls[2].meterPhase, 'training-study-final-repair');
    assert.match(calls[2].instructions, /KONEČNÝ VÝSTUPNÍ KONTRAKT/u);
    assert.equal(result.qualityGate.pass, true);
    assert.ok(result.qualityGate.repairIssueCodes.includes('study_too_short'));
    assert.deepEqual(result.qualityGate.finalRepairIssueCodes, []);
    assert.match(result.text, /soubor pozorovatelných chování/u);
    assert.doesNotMatch(result.text, /kontrola kvality/iu);
    assert.notEqual(result.provider, 'deterministic-training-fallback');
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});

test('studium a debrief používají hlubší model, živá roleplay zůstává rychlá', () => {
  const previousTraining = process.env.ELITEA_TRAINING_MODEL;
  const previousDeep = process.env.ELITEA_DEEP_MODEL;
  delete process.env.ELITEA_TRAINING_MODEL;
  delete process.env.ELITEA_DEEP_MODEL;
  try {
    assert.equal(resolveTrainingModel('simulation', 'roleplay'), 'openai/gpt-5.6-luna');
    assert.equal(resolveTrainingModel('study', 'study'), 'openai/gpt-5.6-terra');
    assert.equal(resolveTrainingModel('simulation', 'debrief'), 'openai/gpt-5.6-terra');
  } finally {
    if (previousTraining === undefined) delete process.env.ELITEA_TRAINING_MODEL;
    else process.env.ELITEA_TRAINING_MODEL = previousTraining;
    if (previousDeep === undefined) delete process.env.ELITEA_DEEP_MODEL;
    else process.env.ELITEA_DEEP_MODEL = previousDeep;
  }
});

test('roleplay odmítne prioritní odbočení, nepřímé metarady a identitu stroje v češtině i slovenštině', () => {
  const variants = [
    {
      language: 'cs',
      scenario: {
        openingLine: 'Potřebuji změnu práce, ale bojím se výpadku příjmu.',
        assignment: 'Veď rozhovor o změně práce a finanční jistotě.',
        rubric: ['Přesné zachycení dilematu'],
        private: { facts: 'Klientka chce změnit práci a bojí se výpadku příjmu.' },
      },
      prompt: 'Co vás teď nejvíc tíží?',
      failures: [
        ['Nejvíc mě tíží počasí, ale potřebuji změnu práce a příjem.', 'scenario_fidelity_missing'],
        ['Jde mi hlavně o bolest kolene, zatímco změna práce a stabilní příjem mě vlastně netrápí.', 'scenario_fidelity_missing'],
        ['Potřebuji změnu práce a jistotu příjmu. Nejlepší otázka teď míří na finanční rezervu.', 'trainer_advice_leak'],
        ['Potřebuji změnu práce a jistotu příjmu. Tvůj další tah má být otázka na finanční rezervu.', 'trainer_advice_leak'],
        ['Potřebuji změnu práce a jistotu příjmu. Pokračování patří otázce na obavy z příjmu.', 'trainer_advice_leak'],
        ['Jsem stroj, ne osoba, ale potřebuji řešit změnu práce a příjem.', 'role_break'],
      ],
      valid: [
        'Jde mi hlavně o to, jak změnit práci a přitom si udržet stabilní příjem.',
        'Nejlepší další krok pro mě je snížit výdaje, abych měla jistotu příjmu při změně práce.',
        'Správný postup na úřadě mi není jasný a kvůli změně práce z něj mám obavy.',
        'Můj další tah bude zjistit finanční rezervu před změnou práce.',
        'Jsem jako stroj a potřebuji při změně práce konečně zpomalit.',
      ],
    },
    {
      language: 'sk',
      scenario: {
        openingLine: 'Potrebujem zmeniť prácu, ale bojím sa výpadku príjmu.',
        assignment: 'Veď rozhovor o zmene práce a finančnej istote.',
        rubric: ['Presné zachytenie dilemy'],
        private: { facts: 'Klientka chce zmeniť prácu a bojí sa výpadku príjmu.' },
      },
      prompt: 'Čo vás teraz najviac trápi?',
      failures: [
        ['Ide mi hlavne o bolesť kolena, zatiaľ čo zmena práce a stabilný príjem ma vlastne netrápia.', 'scenario_fidelity_missing'],
        ['Potrebujem zmenu práce a istotu príjmu. Najlepšia otázka teraz smeruje na finančnú rezervu.', 'trainer_advice_leak'],
        ['Potrebujem zmenu práce a istotu príjmu. Tvoj ďalší ťah má byť otázka na finančnú rezervu.', 'trainer_advice_leak'],
        ['Potrebujem zmenu práce a istotu príjmu. Pokračovanie patrí otázke na obavy z príjmu.', 'trainer_advice_leak'],
        ['Som stroj, nie osoba, ale potrebujem riešiť zmenu práce a príjem.', 'role_break'],
      ],
      valid: [
        'Ide mi hlavne o to, ako zmeniť prácu a pritom si udržať stabilný príjem.',
        'Najlepší ďalší krok pre mňa je znížiť výdavky, aby som mala istotu príjmu pri zmene práce.',
        'Správny postup na úrade mi nie je jasný a pre zmenu práce z neho mám obavy.',
        'Môj ďalší ťah bude zistiť finančnú rezervu pred zmenou práce.',
        'Som ako stroj a potrebujem pri zmene práce konečne spomaliť.',
      ],
    },
  ];

  for (const variant of variants) {
    const messages = [
      { role: 'assistant', content: variant.scenario.openingLine },
      { role: 'user', content: variant.prompt },
    ];
    for (const [output, expectedIssue] of variant.failures) {
      const result = assessRoleplayResponse(output, {
        scenario: variant.scenario,
        messages,
        responseLanguage: variant.language,
      });
      assert.equal(result.pass, false, output);
      assert.ok(result.issues.includes(expectedIssue), `${output}: ${result.issues.join(', ')}`);
    }
    for (const output of variant.valid) {
      const result = assessRoleplayResponse(output, {
        scenario: variant.scenario,
        messages,
        responseLanguage: variant.language,
      });
      assert.equal(result.pass, true, `${output}: ${result.issues.join(', ')}`);
    }
  }
});
