import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { getCourseTrainerProfile } from '../src/course-trainer-profiles.js';
import { lifeCoachScenarioCount } from '../src/life-coach-training.js';
import {
  assessDebriefResponse,
  assessRoleplayResponse,
  assessStudyResponse,
  buildTrainingRepairInstruction,
  completeDebriefRubric,
  sanitizeDebriefEvidence,
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
  for (const profile of profiles) {
    assert.ok(profile.studentRole.length > 25);
    assert.ok(profile.studyScope.length > 45);
    assert.ok(profile.evaluationFocus.length > 40);
    assert.equal(profile.rubric.length, 5);
  }
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

test('life coaching má osmnáct ručně navržených situací zamčených na modul a otevřenou část', () => {
  assert.equal(lifeCoachScenarioCount(), 18);
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
      titles.push(scenario.title);
    }
  }
  assert.equal(new Set(titles).size, 18);
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

test('výslovně zvolený Mastery Lab scénář má přednost před běžnou lekční situací', () => {
  const selected = lifeCoachCourse.mastery.scenarios.find(item => item.difficulty === 'expert');
  const item = lifeCoachCourse.modules.flatMap(module => module.items).find(candidate => candidate.id === selected.itemId);
  const scenario = createTrainingScenario(lifeCoachCourse, item, 'expert', selected.id);
  assert.equal(scenario.id, selected.id);
  assert.equal(scenario.title, selected.title);
});

test('brána simulace odmítne vystoupení z role a trenérskou radu', () => {
  const roleBreak = assessRoleplayResponse('Jako AI trenérka ti doporučuji tři kroky:\n- nejdřív se zeptej na cíl');
  assert.equal(roleBreak.pass, false);
  assert.ok(roleBreak.issues.includes('role_break'));
  assert.ok(roleBreak.issues.includes('list_or_heading'));
  const valid = assessRoleplayResponse('Nevím. Část mě chce, abys rozhodla za mě, protože se bojím vlastní chyby.');
  assert.equal(valid.pass, true);
  const trailingFragment = assessRoleplayResponse('Začnu hned řešit obsah, aniž bych ověřila kontrakt.-vesm');
  assert.equal(trailingFragment.pass, false);
  assert.ok(trailingFragment.issues.includes('trailing_fragment'));
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
  const invented = assessDebriefResponse(debrief('Skvěle jsi nastavila hranici.'), { messages, rubric });
  assert.equal(invented.pass, false);
  assert.ok(invented.issues.includes('unsupported_student_quote'));
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
    '## Co zlepšit', 'Doplnit další krok.',
    '## Lepší formulace', '„Jaký krok zvolíš?“',
    '## Další pokus', 'Uzavřít dohodou.',
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

test('stav ČÁSTEČNĚ se v českém debriefu počítá jako platné vyhodnocení kritéria', () => {
  const quote = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const response = [
    '## Výsledek nácviku', 'Dobrý základ.',
    '## Co fungovalo', `Je vidět vyjasňování cíle: „${quote}“`,
    '## Rozbor kompetencí',
    `- ČÁSTEČNĚ — Kontrakt: důkaz „${quote}“`,
    `- ČÁSTEČNĚ — Otevřená otázka: důkaz „${quote}“`,
    '## Co zlepšit', 'Ještě chybí uzavření.',
    '## Lepší formulace', '„Jaký krok zvolíš?“',
    '## Další pokus', 'Uzavřít další krok.',
  ].join('\n\n');
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: ['Kontrakt', 'Otevřená otázka'],
  });
  assert.equal(assessed.pass, true);
  assert.ok(!assessed.issues.includes('incomplete_rubric'));
});

test('brána hodnocení dovolí novou větu v části Lepší formulace', () => {
  const response = [
    '## Výsledek nácviku',
    'Dobrý základ.',
    '## Co fungovalo',
    'Studentka přesně navázala na přepis.',
    '## Rozbor kompetencí',
    '- PROKÁZÁNO — Reflexe: důkaz „Slyším, že je to pro tebe důležité.“',
    '## Co zlepšit',
    'Jedna konkrétní mezera.',
    '## Lepší formulace',
    '„Co je pro tebe v této chvíli nejdůležitější?“',
    '## Další pokus',
    'Zopakovat v náročnější variantě.',
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
    '## Co zlepšit', 'Bez umělé výtky.',
    '## Lepší formulace', 'Nejsou potřeba.',
    '## Další pokus', 'Vyšší obtížnost.',
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
    'V části Aktivní naslouchání použiješ parafrázi tak, že vlastními slovy zachytíš význam a potom ověříš porozumění. Příklad: „Rozumím tomu tak, že termín je pro tebe zásadní — sedí to?“ Zkus nyní parafrázovat jednu větu klientky.',
    { messages, course, item },
  );
  assert.equal(valid.pass, true);
  const drift = assessStudyResponse(
    'Teď tě budu koučovat a pojďme zpracovat tvé trauma. Co cítíš v těle?',
    { messages, course, item },
  );
  assert.equal(drift.pass, false);
  assert.ok(drift.issues.includes('study_role_drift'));
});

test('opravný pokyn pro studium vrací trenérku k lekci, ne do koučinku', () => {
  const instruction = buildTrainingRepairInstruction({
    phase: 'study',
    assessment: { issues: ['study_role_drift'] },
  });
  assert.match(instruction, /odborná lektorka právě otevřeného kurzu/i);
  assert.match(instruction, /Nepřepínej do osobního koučinku/i);
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
