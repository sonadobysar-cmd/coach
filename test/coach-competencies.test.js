import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COACH_COMPETENCIES,
  PROFESSIONAL_LIFE_COACH_COURSE_ID,
  assessCoachEvidenceRelevance,
  coachCompetencyIdForCriterion,
  detectCoachCriticalFailures,
  indexedCoachStudentTurns,
} from '../src/coach-competencies.js';
import {
  assessDebriefResponse,
  buildTrainingRepairInstruction,
  completeDebriefRubric,
  debriefAchievementSummary,
  sanitizeDebriefEvidence,
} from '../src/training-quality.js';
import {
  buildDebriefTranscriptMessages,
  buildTrainingInstructions,
  createCourseTrainer,
  createTrainingScenario,
} from '../src/training.js';

const COURSE_ID = PROFESSIONAL_LIFE_COACH_COURSE_ID;

function debrief({ rows, result = 'Doložený výkon.', praise = 'Hodnocení vychází pouze z přepisu.', improvement = 'Nic dalšího.', better = 'Není potřeba.', retry = 'Vyšší obtížnost.' }) {
  return [
    '## Výsledek nácviku', result,
    '## Co fungovalo', praise,
    '## Rozbor kompetencí', ...rows,
    '## Co zlepšit', improvement,
    '## Lepší formulace', better,
    '## Další pokus', retry,
  ].join('\n');
}

test('profesní výcvik má jednu stabilní mapu devíti koučovacích kompetencí', () => {
  assert.deepEqual(
    COACH_COMPETENCIES.map(competency => competency.id),
    [
      'contract',
      'active_listening',
      'questions',
      'intervention_choice',
      'refusal_autonomy',
      'alliance_repair',
      'ethical_boundaries',
      'outcome',
      'reflection',
    ],
  );
  assert.equal(coachCompetencyIdForCriterion('Jasný kontrakt a výsledek rozhovoru'), 'contract');
  assert.equal(coachCompetencyIdForCriterion('Přijetí opravy bez obhajování'), 'alliance_repair');
  assert.equal(coachCompetencyIdForCriterion('Jasné odmítnutí léčebného slibu'), 'ethical_boundaries');
  assert.equal(coachCompetencyIdForCriterion('Alespoň dvě intervence přímo navazují na slova modelové klientky.'), 'active_listening');
  assert.equal(coachCompetencyIdForCriterion('Reflexe pojmenuje konkrétní důkaz, mezeru a cíl dalšího pokusu.'), 'reflection');
});

test('S-indexy označují jen skutečné odborné tahy studentky', () => {
  const messages = [
    { role: 'assistant', content: 'Co chceš dnes řešit?' },
    { role: 'user', content: 'Jaký výsledek by pro tebe dnes byl užitečný?' },
    { role: 'assistant', content: 'Chci mít jasno v dalším kroku.' },
    { role: 'user', content: 'Co si jako další krok volíš?' },
    { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
  ];
  const turns = indexedCoachStudentTurns(messages);
  assert.deepEqual(turns.map(turn => turn.reference), ['S1', 'S2']);
  assert.match(turns[1].previousCounterpartText, /dalším kroku/u);

  const transcript = buildDebriefTranscriptMessages(messages, { courseId: COURSE_ID });
  assert.match(transcript[0].content, /\[STUDENTKA\]\n\[S1\]/u);
  assert.match(transcript[0].content, /\[STUDENTKA\]\n\[S2\]/u);
  assert.match(transcript[0].content, /\[ADMINISTRATIVNÍ POKYN — NENÍ DŮKAZ\]/u);
  assert.doesNotMatch(transcript[0].content, /\[S3\]/u);
});

test('strict debrief vyžaduje správný S-index i významově relevantní důkaz', () => {
  const label = 'Kontrakt a jasný cíl rozhovoru';
  const greeting = 'Jak se dnes máš?';
  const contract = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const messages = [
    { role: 'assistant', content: 'Nevím, kde začít.' },
    { role: 'user', content: greeting },
    { role: 'assistant', content: 'Potřebuji si ujasnit, kam dojít.' },
    { role: 'user', content: contract },
    { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
  ];
  const responseFor = evidence => debrief({
    rows: [`- PROKÁZÁNO — ${label}: ${evidence}`],
  });

  const valid = assessDebriefResponse(
    responseFor(`Důkaz [S2]: „${contract}“`),
    { messages, rubric: [label], courseId: COURSE_ID },
  );
  assert.equal(valid.pass, true);

  const wrongTurn = assessDebriefResponse(
    responseFor(`Důkaz [S1]: „${contract}“`),
    { messages, rubric: [label], courseId: COURSE_ID },
  );
  assert.equal(wrongTurn.pass, false);
  assert.ok(wrongTurn.issues.includes('evidence_turn_mismatch'));

  const missingIndex = assessDebriefResponse(
    responseFor(`Důkaz: „${contract}“`),
    { messages, rubric: [label], courseId: COURSE_ID },
  );
  assert.ok(missingIndex.issues.includes('missing_evidence_turn_index'));

  const administrativeIndex = assessDebriefResponse(
    responseFor(`Důkaz [S3]: „Ukončuji simulaci. Vyhodnoť celý nácvik.“`),
    { messages, rubric: [label], courseId: COURSE_ID },
  );
  assert.ok(administrativeIndex.issues.includes('invalid_evidence_turn_index'));

  const irrelevant = assessDebriefResponse(
    responseFor(`Důkaz [S1]: „${greeting}“`),
    { messages, rubric: [label], courseId: COURSE_ID },
  );
  assert.equal(irrelevant.pass, false);
  assert.ok(irrelevant.issues.includes('semantically_irrelevant_evidence:contract'));

  const legacyOtherCourse = assessDebriefResponse(
    responseFor(`Důkaz: „${contract}“`),
    { messages, rubric: [label], courseId: 'komunikace-v-praxi' },
  );
  assert.equal(legacyOtherCourse.pass, true);
});

test('kritérium vyžadující dvě intervence nelze doložit opakováním jediného tahu', () => {
  const label = 'Alespoň dvě intervence přímo navazují na slova modelové klientky.';
  const first = 'Slyším, že tě nejvíc zatěžuje nejistota kolem ceny. Sedí to?';
  const second = 'Říkáš, že potřebuješ nejdřív znát své náklady. Chápu to správně?';
  const messages = [
    { role: 'assistant', content: 'Nejvíc mě zatěžuje nejistota kolem ceny.' },
    { role: 'user', content: first },
    { role: 'assistant', content: 'Potřebuji nejdřív znát své náklady.' },
    { role: 'user', content: second },
  ];
  const responseFor = evidence => debrief({
    rows: [`- PROKÁZÁNO — ${label}: ${evidence}`],
  });
  const oneTurn = assessDebriefResponse(
    responseFor(`Důkaz [S1]: „${first}“`),
    { messages, rubric: [label], courseId: COURSE_ID },
  );
  assert.ok(oneTurn.issues.includes('insufficient_distinct_competency_evidence'));

  const twoTurns = assessDebriefResponse(
    responseFor(`Důkaz [S1]: „${first}“ Důkaz [S2]: „${second}“`),
    { messages, rubric: [label], courseId: COURSE_ID },
  );
  assert.equal(twoTurns.pass, true);
});

test('sémantická brána rozpozná pozorovatelný důkaz všech devíti kompetencí', () => {
  const cases = [
    ['Kontrakt a jasný cíl rozhovoru', 'Co by pro tebe dnes bylo užitečným výsledkem?', 'Nevím, kde začít.'],
    ['Přesné naslouchání a plynulý proces', 'Slyším, že nechceš podnikání zmenšit; chceš změnit podmínky zakázek. Sedí to?', 'Nechci podnikání zmenšit, chci jinak přijímat zakázky.'],
    ['Jedna otázka s jedním účelem', 'Co bylo jiné v jediném delegování, které fungovalo?', 'Jednou delegování fungovalo.'],
    ['Pojmenování účelu bez obhajoby modelu', 'Potřebuješ nejdřív rozlišit hodnoty; GROW odložme. Můžu nabídnout mapu hodnot?', 'GROW mi nesedí, potřebuji rozlišit hodnoty.'],
    ['Respekt k odmítnutí otázky', 'Rozumím, tu otázku pokládat nebudu; vrátíme se k zakázce.', 'Ta otázka mi nesedí.'],
    ['Přijetí opravy bez obhajování', 'Děkuji za opravu. Přidala jsem význam, který jsi neřekla; vrátím se k tvým slovům.', 'Ne, takhle jsem to nemyslela.'],
    ['Jasné odmítnutí léčebného slibu', 'Traumatickou vzpomínku zpracovávat nebudu; můžeme pracovat na bezpečné přípravě prezentace.', 'Vymažeš mi trauma?'],
    ['Klientkou zvolený ověřitelný krok', 'Jaký krok si volíš a podle čeho poznáš, že proběhl?', 'Chci udělat něco konkrétního.'],
    ['Práce s hypotézou místo prvního dojmu', 'Mám hypotézu, ale nechci si domýšlet: jaká data ji podporují a co jí odporuje?', 'Úkol jsem znovu nedokončila.'],
  ];

  for (const [label, quote, clientText] of cases) {
    const result = assessCoachEvidenceRelevance({
      label,
      quote,
      turnIndex: 1,
      messages: [
        { role: 'assistant', content: clientText },
        { role: 'user', content: quote },
      ],
    });
    assert.equal(result.relevant, true, `${result.competencyId}: ${result.reason}`);
  }
});

test('stejný strict důkazní režim přijímá přirozenou slovenštinu', () => {
  const label = 'Kontrakt a jasný cíl rozhovoru';
  const quote = 'Čo by bolo pre teba dnes užitočným výsledkom?';
  const messages = [
    { role: 'assistant', content: 'Neviem, kde začať.' },
    { role: 'user', content: quote },
    { role: 'user', content: 'Ukončujem simuláciu. Vyhodnoť celý nácvik.' },
  ];
  const response = [
    '## Výsledok nácviku', 'Doložený výkon.',
    '## Čo fungovalo', 'Hodnotenie vychádza iba z prepisu.',
    '## Rozbor kompetencií', `- PREUKÁZANÉ — Jasný kontrakt a cieľ rozhovoru: Dôkaz [S1]: „${quote}“`,
    '## Čo zlepšiť', 'Nič podstatné.',
    '## Lepšia formulácia', 'Nie je potrebná.',
    '## Ďalší pokus', 'Voliteľne vyššia náročnosť.',
  ].join('\n');
  const assessment = assessDebriefResponse(response, {
    messages,
    rubric: [label],
    courseId: COURSE_ID,
  });
  assert.equal(assessment.studentTurnCount, 1);
  assert.equal(assessment.pass, true);
  assert.equal(assessment.responseLanguage, 'sk');

  const achievement = debriefAchievementSummary(response, [label], {
    messages,
    courseId: COURSE_ID,
  });
  assert.equal(achievement.proven, 1);
  assert.equal(achievement.allProven, true);

  assert.ok(detectCoachCriticalFailures([
    { role: 'user', content: 'Garantujem vyšší príjem do troch mesiacov.' },
  ]).some(failure => failure.code === 'outcome_guarantee'));
  assert.deepEqual(detectCoachCriticalFailures([
    { role: 'user', content: 'Výsledok ti nemôžem zaručiť.' },
  ]), []);
});

test('slovenský sanitizer a doplnění rubriky zachovají slovenské nadpisy i stavy', () => {
  const labels = [
    'Kontrakt a jasný cíl rozhovoru',
    'Klientkou zvolený ověřitelný krok',
  ];
  const messages = [
    { role: 'assistant', content: 'Neviem, kde začať.' },
    { role: 'user', content: 'Ako sa dnes máš?' },
    { role: 'user', content: 'Ukončujem simuláciu. Vyhodnoť celý nácvik.' },
  ];
  const incomplete = [
    '## Výsledok nácviku', 'Pokus je doložený iba prepisom.',
    '## Čo fungovalo', 'Hodnotím iba viditeľné vstupy.',
    '## Rozbor kompetencií', '- PREUKÁZANÉ — Jasný kontrakt: Dôkaz [S1]: „Ako sa dnes máš?“',
    '## Čo zlepšiť', 'Zamerať sa na zmluvu a výsledok.',
    '## Lepšia formulácia', 'Čo by bolo dnes užitočným výsledkom?',
    '## Ďalší pokus', 'Zopakovať zmluvu.',
  ].join('\n');

  const completed = completeDebriefRubric(incomplete, labels, {
    messages,
    responseLanguage: 'sk',
  });
  assert.equal(completed.changed, true);
  assert.match(completed.text, /ZATIAĽ NEPREUKÁZANÉ — Povinné kritérium 2/u);
  assert.doesNotMatch(completed.text, /ZATÍM NEPROKÁZÁNO/u);

  const sanitized = sanitizeDebriefEvidence(completed.text, {
    messages,
    rubric: labels,
    courseId: COURSE_ID,
    responseLanguage: 'sk',
  });
  assert.equal(sanitized.changed, true);
  assert.match(sanitized.text, /^## Čo zlepšiť$/mu);
  assert.match(sanitized.text, /ZATIAĽ NEPREUKÁZANÉ — Jasný kontrakt/u);
  assert.doesNotMatch(sanitized.text, /^## (?:Co zlepšit|Rozbor kompetencí)$/mu);
  assert.equal(assessDebriefResponse(sanitized.text, {
    messages,
    rubric: labels,
    courseId: COURSE_ID,
    responseLanguage: 'sk',
  }).pass, true);
});

test('sémantická brána odmítne double-barrel, mechanickou metodu i předčasné domyšlení', () => {
  const badQuestion = 'Co je důležité a jaká fakta už máš?';
  assert.equal(assessCoachEvidenceRelevance({
    label: 'Jedna otázka s jedním účelem',
    quote: badQuestion,
    turnIndex: 1,
    messages: [{ role: 'assistant', content: 'Nevím, kde začít.' }, { role: 'user', content: badQuestion }],
  }).relevant, false);

  const mechanical = 'Dokončíme GROW, protože je to správný model.';
  assert.equal(assessCoachEvidenceRelevance({
    label: 'Pojmenování účelu bez obhajoby modelu',
    quote: mechanical,
    turnIndex: 1,
    messages: [{ role: 'assistant', content: 'GROW mi nesedí.' }, { role: 'user', content: mechanical }],
  }).relevant, false);

  const premature = 'Slyším, že firma chce poznámky ze sezení. Sedí to?';
  assert.equal(assessCoachEvidenceRelevance({
    label: 'Přesné naslouchání a plynulý proces',
    quote: premature,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: 'Nejsem si jistá, kde začít.' },
      { role: 'user', content: premature },
      { role: 'assistant', content: 'Firma opravdu chce poznámky ze sezení.' },
    ],
  }).relevant, false);
});

test('kritická profesní porušení jsou sticky a bezpečné negace nejsou false positive', () => {
  const criticalCases = [
    [[{ role: 'user', content: 'Zavři oči, trauma zpracujeme.' }], 'clinical_scope_breach'],
    [[{ role: 'user', content: 'Pošlu HR poznámky ze sezení.' }], 'confidentiality_breach'],
    [[{ role: 'user', content: 'Zaručuji vyšší příjem do tří měsíců.' }], 'outcome_guarantee'],
    [[
      { role: 'assistant', content: 'Ta otázka mi nesedí, nechci pokračovat.' },
      { role: 'user', content: 'Zkus ji přesto.' },
    ], 'ignored_explicit_refusal'],
  ];
  for (const [messages, expectedCode] of criticalCases) {
    assert.ok(detectCoachCriticalFailures(messages).some(failure => failure.code === expectedCode));
  }

  const sticky = detectCoachCriticalFailures([
    { role: 'user', content: 'Pošlu HR poznámky ze sezení.' },
    { role: 'assistant', content: 'To nechci.' },
    { role: 'user', content: 'Omlouvám se, neposkytnu je.' },
  ]);
  assert.ok(sticky.some(failure => failure.code === 'confidentiality_breach'));

  const safeStatements = [
    'Výsledek ti zaručit nemohu.',
    'Trauma s tebou zpracovávat nebudu.',
    'Poznámky bez souhlasu neposkytnu.',
    'Otázku můžeš odmítnout.',
  ];
  for (const statement of safeStatements) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: statement }]), []);
  }
});

test('správný debrief kritické porušení přizná, ale mastery zůstane neúspěšné', () => {
  const label = 'Rozlišení koučinku, mentoringu a garance výsledku';
  const unsafe = 'Zaručuji vyšší příjem do tří měsíců.';
  const messages = [
    { role: 'assistant', content: 'Zaručíš mi, že budu vydělávat víc?' },
    { role: 'user', content: unsafe },
  ];
  const acknowledged = debrief({
    result: 'Pokus obsahuje kritické porušení profesní hranice.',
    rows: [`- ZATÍM NEPROKÁZÁNO — ${label}: nepřípustná garance. Důkaz [S1]: „${unsafe}“`],
    improvement: `Garance výsledku je nekompenzovatelné porušení. Důkaz [S1]: „${unsafe}“`,
    better: '„Výsledek zaručit nemohu; mohu přesně popsat proces.“',
    retry: 'Zopakovat pravdivé kontraktování bez garance.',
  });
  const assessed = assessDebriefResponse(acknowledged, {
    messages,
    rubric: [label],
    courseId: COURSE_ID,
  });
  assert.equal(assessed.pass, true);
  assert.equal(assessed.criticalFailures[0].code, 'outcome_guarantee');

  const achievement = debriefAchievementSummary(acknowledged, [label], {
    messages,
    courseId: COURSE_ID,
  });
  assert.equal(achievement.hasCriticalFailure, true);
  assert.equal(achievement.allProven, false);

  const laterSafeSentence = 'Výsledek zaručit nemohu; mohu přesně popsat proces.';
  const overlooked = debrief({
    result: 'Výborný výkon.',
    rows: [`- PROKÁZÁNO — ${label}: Důkaz [S2]: „${laterSafeSentence}“`],
  });
  const overlookedAssessment = assessDebriefResponse(overlooked, {
    messages: [...messages, { role: 'user', content: laterSafeSentence }],
    rubric: [label],
    courseId: COURSE_ID,
  });
  assert.equal(overlookedAssessment.pass, false);
  assert.ok(overlookedAssessment.issues.includes('critical_failure_unacknowledged:outcome_guarantee'));
});

test('strict sanitizer stáhne sémanticky nedoložené pozitivní tvrzení', () => {
  const label = 'Kontrakt a jasný cíl rozhovoru';
  const greeting = 'Jak se dnes máš?';
  const messages = [{ role: 'assistant', content: 'Nevím.' }, { role: 'user', content: greeting }];
  const unsafeDebrief = debrief({
    rows: [`- PROKÁZÁNO — ${label}: Důkaz [S1]: „${greeting}“`],
  });
  const sanitized = sanitizeDebriefEvidence(unsafeDebrief, {
    messages,
    rubric: [label],
    courseId: COURSE_ID,
  });
  assert.equal(sanitized.changed, true);
  assert.match(sanitized.text, /ZATÍM NEPROKÁZÁNO — Kontrakt/u);
  assert.equal(assessDebriefResponse(sanitized.text, {
    messages,
    rubric: [label],
    courseId: COURSE_ID,
  }).pass, true);
});

test('life-coach instrukce i opravný pokyn nesou strict důkazní kontrakt', () => {
  const course = { id: COURSE_ID, title: 'Profesionální life coach', categoryId: 'coaching-mental-health' };
  const item = { id: 'm0-1', title: 'Etika a hranice', markdown: 'Kontrakt, hranice a pravdivé sliby.' };
  const scenario = {
    title: 'Test profesní hranice',
    assignment: 'Vyjednej pravdivou zakázku.',
    rubric: ['Kontrakt a jasný cíl rozhovoru'],
    role: 'Klientka',
    counterpart: 'modelová klientka',
    private: { facts: 'Fakta', hiddenNeed: 'Potřeba', behavior: 'Chování' },
  };
  const instructions = buildTrainingInstructions({
    course,
    item,
    activity: 'simulation',
    phase: 'debrief',
    scenario,
    difficulty: 'advanced',
  });
  assert.match(instructions, /Důkaz \[S#\]/u);
  assert.match(instructions, /kritické profesní porušení/iu);

  const repair = buildTrainingRepairInstruction({
    phase: 'debrief',
    assessment: { issues: ['missing_evidence_turn_index'] },
    messages: [
      { role: 'user', content: 'Co by dnes bylo užitečným výsledkem?' },
      { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
    ],
    rubric: scenario.rubric,
    courseId: COURSE_ID,
  });
  assert.match(repair, /\[S1\] Co by dnes/u);
  assert.doesNotMatch(repair, /\[S2\]/u);
  assert.match(repair, /významově dokazovat právě hodnocenou kompetenci/u);

  for (const [activity, phase] of [
    ['study', 'study'],
    ['simulation', 'roleplay'],
    ['simulation', 'debrief'],
  ]) {
    const slovakInstructions = buildTrainingInstructions({
      course,
      item,
      activity,
      phase,
      scenario,
      difficulty: 'advanced',
      responseLanguage: 'sk',
    });
    assert.match(slovakInstructions, /Odpovedaj prirodzenou súčasnou slovenčinou/u);
    assert.match(slovakInstructions, /nepremiešavaj do odpovede české tvary/u);
    if (phase === 'debrief') {
      assert.match(slovakInstructions, /„Výsledok nácviku“/u);
      assert.match(slovakInstructions, /PREUKÁZANÉ, ČIASTOČNE alebo ZATIAĽ NEPREUKÁZANÉ/u);
      assert.match(slovakInstructions, /Dôkaz \[S#\]/u);
    }
  }
});

test('course trainer odvodí slovenštinu z odborného tahu před administrativním ukončením', async () => {
  const course = {
    id: COURSE_ID,
    slug: 'profesionalni-life-coach-od-kontraktu-k-vysledku',
    title: 'Profesionální life coach',
    categoryId: 'coaching-mental-health',
    modules: [{ items: [{ id: 'm0-1', title: 'Etika a hranice', markdown: 'Kontrakt a hranice.' }] }],
  };
  const item = course.modules[0].items[0];
  const calls = [];
  const generate = async options => {
    calls.push(options);
    const rowCount = createTrainingScenario(course, item, 'advanced').rubric.length;
    return {
      text: [
        '## Výsledok nácviku', 'Zatiaľ chýba dostatok dôkazov.',
        '## Čo fungovalo', 'Hodnotenie vychádza iba z prepisu.',
        '## Rozbor kompetencií',
        ...Array.from({ length: rowCount }, (_value, index) => (
          `- ZATIAĽ NEPREUKÁZANÉ — Povinné kritérium ${index + 1}: priamy dôkaz chýba.`
        )),
        '## Čo zlepšiť', 'V ďalšom pokuse predveď jednu zručnosť po druhej.',
        '## Lepšia formulácia', 'Náhradná formulácia teraz nie je potrebná.',
        '## Ďalší pokus', 'Začni jasnou zmluvou.',
      ].join('\n'),
      usage: null,
    };
  };
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only';
  try {
    const trainer = createCourseTrainer({ generate });
    const result = await trainer({
      course,
      item,
      activity: 'simulation',
      phase: 'debrief',
      difficulty: 'advanced',
      messages: [
        { role: 'assistant', content: 'Neviem, kde začať.' },
        { role: 'user', content: 'Chcem najprv dohodnúť cieľ nášho rozhovoru.' },
        { role: 'user', content: 'Ukončujem simuláciu. Vyhodnoť celý nácvik.' },
      ],
    });
    assert.equal(calls.length, 1);
    assert.equal(result.responseLanguage, 'sk');
    assert.equal(result.qualityGate.pass, true);
    assert.match(calls[0].instructions, /Odpovedaj prirodzenou súčasnou slovenčinou/u);
    assert.match(calls[0].instructions, /„Výsledok nácviku“/u);
    assert.match(calls[0].messages[0].content, /\[ŠTUDENTKA\]\n\[S1\]/u);
    assert.match(calls[0].messages[0].content, /\[ADMINISTRATÍVNY POKYN — NIE JE DÔKAZ\]/u);
    assert.match(result.text, /^## Rozbor kompetencií$/mu);
    assert.doesNotMatch(result.text, /^## Rozbor kompetencí$/mu);
  } finally {
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
  }
});

test('course trainer aktivuje strict režim jen podle life-coach course id a opraví chybějící index', async () => {
  const course = {
    id: COURSE_ID,
    slug: 'profesionalni-life-coach-od-kontraktu-k-vysledku',
    title: 'Profesionální life coach',
    categoryId: 'coaching-mental-health',
    modules: [{ items: [{ id: 'm0-1', title: 'Etika a hranice', markdown: 'Kontrakt a hranice.' }] }],
  };
  const item = course.modules[0].items[0];
  const scenario = createTrainingScenario(course, item, 'advanced');
  const quote = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const first = debrief({
    rows: [`- PROKÁZÁNO — ${scenario.rubric[0]}: Důkaz: „${quote}“`],
  });
  const repaired = debrief({
    result: 'Pro poctivé hodnocení zatím chybí dost důkazů.',
    rows: scenario.rubric.map(label => `- ZATÍM NEPROKÁZÁNO — ${label}: přímý důkaz chybí.`),
    improvement: 'V dalším pokusu předveď jednu kompetenci po druhé.',
    retry: 'Začni jasným kontraktem.',
  });
  const calls = [];
  const generate = async options => {
    calls.push(options);
    return { text: calls.length === 1 ? first : repaired, usage: null };
  };
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = 'test-only';
  try {
    const trainer = createCourseTrainer({ generate });
    const result = await trainer({
      course,
      item,
      activity: 'simulation',
      phase: 'debrief',
      difficulty: 'advanced',
      messages: [
        { role: 'assistant', content: 'Nevím, kde začít.' },
        { role: 'user', content: quote },
        { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
      ],
    });
    assert.equal(calls.length, 2);
    assert.ok(result.qualityGate.attemptIssueCodes.includes('missing_evidence_turn_index'));
    assert.equal(result.qualityGate.pass, true);
    assert.equal(result.qualityGate.repaired, true);
    assert.match(calls[0].messages[0].content, /\[STUDENTKA\]\n\[S1\]/u);
    assert.match(calls[1].instructions, /Důkaz \[S#\]/u);
  } finally {
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
  }
});
