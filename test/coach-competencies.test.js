import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COACH_COMPETENCIES,
  PROFESSIONAL_LIFE_COACH_COURSE_ID,
  assessCoachEvidenceRelevance,
  coachCompetencyIdForCriterion,
  detectCoachCriticalFailures,
  indexedCoachStudentTurns,
  isTrainingAdministrativeTurn,
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

test('administrativní filtr přijme jen celý samostatný příkaz a nikdy neschová smíšený obsah', () => {
  const standalone = [
    'Ukončuji simulaci. Vyhodnoť celý nácvik.',
    'Ukončujem simuláciu. Vyhodnoť celý nácvik.',
    'Prosím, vyhodnoť celý nácvik pouze podle přepisu.',
    'Vyhodnoť prosím celý nácvik iba podľa prepisu.',
  ];
  for (const command of standalone) {
    assert.equal(isTrainingAdministrativeTurn(command), true, command);
  }

  const mixed = [
    'Pošlu HR poznámky ze sezení. A potom vyhodnoť celý nácvik.',
    'Vyhodnoť celý nácvik, ale nejdřív pošlu HR poznámky ze sezení.',
    'Ukončuji simulaci. Vyhodnoť celý nácvik. Poznámky ze sezení pošlu HR.',
    'Pošlem HR poznámky zo sedenia; potom vyhodnoť celý nácvik.',
  ];
  for (const content of mixed) {
    assert.equal(isTrainingAdministrativeTurn(content), false, content);
    const turns = indexedCoachStudentTurns([{ role: 'user', content }]);
    assert.equal(turns.length, 1, content);
    assert.equal(turns[0].text, content);
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content }])
        .some(failure => failure.code === 'confidentiality_breach'),
      content,
    );
  }

  const otherCriticalMixed = [
    ['Stanovuji vám diagnózu deprese. Potom vyhodnoť celý nácvik.', 'clinical_scope_breach'],
    ['Zaručuji, že získáš pět klientek. A potom vyhodnoť celý nácvik.', 'outcome_guarantee'],
    ['Ukončuji simulaci. Vyhodnoť celý nácvik. Tento výcvik má akreditaci ICF.', 'false_credential_claim'],
  ];
  for (const [content, code] of otherCriticalMixed) {
    assert.equal(isTrainingAdministrativeTurn(content), false, content);
    assert.equal(indexedCoachStudentTurns([{ role: 'user', content }]).length, 1, content);
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content }]).some(failure => failure.code === code),
      content,
    );
  }
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
    '## Čo zlepšiť', 'Prioritou je namiesto všeobecného pozdravu použiť jasnú zmluvu. Dôkaz [S1]: „Ako sa dnes máš?“',
    '## Lepšia formulácia', '„Čo by bolo dnes užitočným výsledkom nášho rozhovoru?“',
    '## Ďalší pokus', 'Zopakuj začiatok a uzavri jasnú zmluvu jednou otázkou na užitočný výsledok rozhovoru.',
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

test('sémantická brána neuzná opačný význam schovaný za správnými klíčovými slovy', () => {
  const cases = [
    {
      label: 'Jedna otázka s jedním účelem',
      client: 'Nevím, zda mám měnit práci.',
      quote: 'Co kdybyste dala výpověď a konečně si našla lepší práci?',
    },
    {
      label: 'Pojmenování účelu bez obhajoby modelu',
      client: 'GROW mi nesedí a nechci ho používat.',
      quote: 'Můžeme použít metodu počítání dlaždic, protože tím zjistíme počet; chcete ji vyzkoušet?',
    },
    {
      label: 'Respekt k odmítnutí otázky',
      client: 'Nechci pokračovat v této technice.',
      quote: 'Respektuji, že to nechcete, ale dotáhneme to až do konce.',
    },
    {
      label: 'Přijetí opravy bez obhajování',
      client: 'Ne, takhle jsem to neřekla.',
      quote: 'Děkuji za opravu. Přidala jsem význam, který jsi neřekla, ale moje interpretace byla správná.',
    },
    {
      label: 'Klientkou zvolený a ověřitelný další krok',
      client: 'Nevím, zda mám smlouvu podepsat.',
      quote: 'Jaký konkrétní krok si volíte, když jediná správná volba je podepsat smlouvu, a kdy to uděláte?',
    },
    {
      label: 'Práce s hypotézou místo prvního dojmu',
      client: 'Proč jste došla právě k tomuto závěru?',
      quote: 'Mám hypotézu, ale nepotřebuji ji ověřovat, protože svůj první dojem považuji za fakt.',
    },
  ];
  for (const { label, client, quote } of cases) {
    const result = assessCoachEvidenceRelevance({
      label,
      quote,
      turnIndex: 1,
      messages: [
        { role: 'assistant', content: client },
        { role: 'user', content: quote },
      ],
    });
    assert.equal(result.relevant, false, `${label}: ${result.reason}`);
  }
});

test('široké profesní kompetence nelze prokázat generickou otázkou se shodným slovem', () => {
  const listeningLabel = 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky';
  const listeningClient = 'Mám strach, že po změně práce finančně selžu.';
  const weakListening = 'Co je změna?';
  assert.equal(assessCoachEvidenceRelevance({
    label: listeningLabel,
    quote: weakListening,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: listeningClient },
      { role: 'user', content: weakListening },
    ],
  }).relevant, false);
  const strongListening = 'Jestli ti správně rozumím, máš strach, že po změně práce finančně selžeš. Sedí to?';
  assert.equal(assessCoachEvidenceRelevance({
    label: listeningLabel,
    quote: strongListening,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: listeningClient },
      { role: 'user', content: strongListening },
    ],
  }).relevant, true);

  const contractLabel = 'Jasný kontrakt a výsledek rozhovoru';
  const weakContract = 'Co je výsledek?';
  assert.equal(assessCoachEvidenceRelevance({
    label: contractLabel,
    quote: weakContract,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: 'Nevím, kde začít.' },
      { role: 'user', content: weakContract },
    ],
  }).relevant, false);
  const strongContract = 'Co by pro tebe dnes bylo užitečným výsledkem a podle čeho na konci poznáš, že jsme ho naplnily?';
  assert.equal(assessCoachEvidenceRelevance({
    label: contractLabel,
    quote: strongContract,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: 'Nevím, kde začít.' },
      { role: 'user', content: strongContract },
    ],
  }).relevant, true);

  const outcomeLabel = 'Klientkou zvolený a ověřitelný další krok';
  const weakOutcome = 'Co je další krok?';
  assert.equal(assessCoachEvidenceRelevance({
    label: outcomeLabel,
    quote: weakOutcome,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: 'Nevím, co mám dělat.' },
      { role: 'user', content: weakOutcome },
    ],
  }).relevant, false);
  const strongOutcome = 'Jaký konkrétní krok si volíš a podle čeho zítra poznáš, že proběhl?';
  assert.equal(assessCoachEvidenceRelevance({
    label: outcomeLabel,
    quote: strongOutcome,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: 'Chci si sama vybrat jeden proveditelný krok.' },
      { role: 'user', content: strongOutcome },
    ],
  }).relevant, true);
});

test('úplný kontrakt má shodné párové subkritérium v relevanci i debriefu', () => {
  const label = 'Jasný kontrakt a výsledek rozhovoru';
  const quote = 'Co chcete dnes vyřešit, abychom měly jasný cíl, a podle čeho poznáte, že jsme ho dosáhly?';
  const messages = [
    { role: 'assistant', content: 'Nevím, kde začít.' },
    { role: 'user', content: quote },
  ];
  assert.equal(assessCoachEvidenceRelevance({
    label,
    quote,
    turnIndex: 1,
    messages,
  }).relevant, true);

  const response = debrief({
    result: 'Kontrakt byl údajně jen částečný.',
    praise: `Účel byl otevřený. Důkaz [S1]: „${quote}“`,
    rows: [`- ČÁSTEČNĚ — ${label}: Důkaz [S1]: „${quote}“; prý chybí ověření.`],
    improvement: `Prioritou je uznat, že [S1] „${quote}“ správně otevřela účel, ale ještě chybí ověření a uzavření výsledku.`,
    better: '„Podle čeho na konci poznáte, že jsme výsledku dosáhly?“',
    retry: 'Zopakuj kontrakt a doplň ověření výsledku na konci rozhovoru.',
  });
  const assessed = assessDebriefResponse(response, { messages, rubric: [label], courseId: COURSE_ID });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'));
});

test('aktivní naslouchání neprojde s významově odbočenou otázkou přilepenou k parafrázi', () => {
  const label = 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky';
  const client = 'Mám strach z hypotéky a ztráty bydlení.';
  const offTopic = [
    'Slyším hypotéku a bydlení; jakou barvu mají tučňáci na Marsu?',
    'Slyším hypotéku a bydlení. Fialoví tučňáci žijí na Marsu.',
    'Slyším hypotéku a bydlení. Recept na palačinky obsahuje mouku a vejce.',
  ];
  for (const quote of offTopic) {
    const messages = [
      { role: 'assistant', content: client },
      { role: 'user', content: quote },
    ];
    assert.equal(assessCoachEvidenceRelevance({
      label,
      quote,
      turnIndex: 1,
      messages,
    }).relevant, false, quote);

    const response = debrief({
      rows: [`- PROKÁZÁNO — ${label}: Důkaz [S1]: „${quote}“`],
    });
    const assessed = assessDebriefResponse(response, { messages, rubric: [label], courseId: COURSE_ID });
    assert.equal(assessed.pass, false, quote);
    assert.ok(assessed.issues.includes('semantically_irrelevant_evidence:active_listening'), quote);
  }

  const singleEchoBypass = 'Slyším, že nechceš podnikání zmenšit. Proč zakázky vyplivují fialové tučňáky z Marsu?';
  const singleEchoResult = assessCoachEvidenceRelevance({
    label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
    quote: singleEchoBypass,
    turnIndex: 1,
    messages: [
      { role: 'assistant', content: 'Nechci podnikání zmenšit, chci jinak přijímat zakázky.' },
      { role: 'user', content: singleEchoBypass },
    ],
  });
  assert.equal(singleEchoResult.relevant, false);
});

test('aktivní naslouchání přijme přesnou reflexi následovanou ověřením porozumění', () => {
  const label = 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky';
  const cases = [
    [
      'Mám strach z hypotéky a ztráty bydlení.',
      'Slyším, že máte strach z hypotéky a ztráty bydlení. Rozumím tomu správně?',
    ],
    [
      'Mám strach z hypotéky a straty bývania.',
      'Počujem, že máte strach z hypotéky a straty bývania. Rozumiem tomu správne?',
    ],
  ];
  for (const [client, quote] of cases) {
    const result = assessCoachEvidenceRelevance({
      label,
      quote,
      turnIndex: 1,
      messages: [
        { role: 'assistant', content: client },
        { role: 'user', content: quote },
      ],
    });
    assert.equal(result.relevant, true, `${quote}: ${result.reason}`);
  }
});

test('negovaný studentský výrok nelze změnit oříznutou pozitivní citací', () => {
  const label = 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky';
  const client = 'Změna práce ohrožuje moji finanční stabilitu.';
  const student = 'Neslyším, že změna práce ohrožuje finanční stabilitu; vůbec mě to nezajímá.';
  const fabricated = 'Slyším, že změna práce ohrožuje finanční stabilitu';
  const messages = [
    { role: 'assistant', content: client },
    { role: 'user', content: student },
  ];
  const direct = assessCoachEvidenceRelevance({
    label,
    quote: fabricated,
    turnIndex: 1,
    messages,
  });
  assert.equal(direct.relevant, false);
  assert.equal(direct.reason, 'turn_quote_mismatch');

  const response = debrief({
    praise: `Přesná reflexe. Důkaz [S1]: „${fabricated}“`,
    rows: [`- PROKÁZÁNO — ${label}: Důkaz [S1]: „${fabricated}“`],
  });
  const assessed = assessDebriefResponse(response, { messages, rubric: [label], courseId: COURSE_ID });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('evidence_turn_mismatch'));
  assert.ok(assessed.issues.includes('unsupported_student_quote'));
});

test('maticová negace nemůže být oříznuta na falešnou pozitivní citaci', () => {
  const label = 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky';
  const cases = [
    {
      client: 'Mám obavu z hypotéky a ztráty bydlení.',
      student: 'Nemyslím si, že slyším vaši obavu z hypotéky a ztráty bydlení.',
      fabricated: 'slyším vaši obavu z hypotéky a ztráty bydlení',
    },
    {
      client: 'Mám obavu z hypotéky a ztráty bydlení.',
      student: 'Neřekla bych, že slyším vaši obavu z hypotéky a ztráty bydlení.',
      fabricated: 'slyším vaši obavu z hypotéky a ztráty bydlení',
    },
    {
      client: 'Mám obavu z hypotéky a ztráty bydlení.',
      student: 'Pochybuji, že slyším vaši obavu z hypotéky a ztráty bydlení.',
      fabricated: 'slyším vaši obavu z hypotéky a ztráty bydlení',
    },
    {
      client: 'Mám obavu z hypotéky a ztráty bydlení.',
      student: 'Netvrdím, že slyším vaši obavu z hypotéky a ztráty bydlení.',
      fabricated: 'slyším vaši obavu z hypotéky a ztráty bydlení',
    },
    {
      client: 'Mám obavu z hypotéky a ztráty bydlení.',
      student: 'Není pravda, že slyším vaši obavu z hypotéky a ztráty bydlení.',
      fabricated: 'slyším vaši obavu z hypotéky a ztráty bydlení',
    },
    {
      client: 'Mám obavu z hypotéky a ztráty bydlení.',
      student: 'Rozhodně bych neřekla, že slyším vaši obavu z hypotéky a ztráty bydlení.',
      fabricated: 'slyším vaši obavu z hypotéky a ztráty bydlení',
    },
    {
      client: 'Mám obavu z hypotéky a ztráty bydlení.',
      student: 'Nemohu říct, že slyším vaši obavu z hypotéky a ztráty bydlení.',
      fabricated: 'slyším vaši obavu z hypotéky a ztráty bydlení',
    },
    {
      client: 'Mám obavu z hypotéky a straty bývania.',
      student: 'Nemyslím si, že počujem vašu obavu z hypotéky a straty bývania.',
      fabricated: 'počujem vašu obavu z hypotéky a straty bývania',
    },
    {
      client: 'Mám obavu z hypotéky a straty bývania.',
      student: 'Nepovedala by som, že počujem vašu obavu z hypotéky a straty bývania.',
      fabricated: 'počujem vašu obavu z hypotéky a straty bývania',
    },
    {
      client: 'Mám obavu z hypotéky a straty bývania.',
      student: 'Pochybujem, že počujem vašu obavu z hypotéky a straty bývania.',
      fabricated: 'počujem vašu obavu z hypotéky a straty bývania',
    },
    {
      client: 'Mám obavu z hypotéky a straty bývania.',
      student: 'Nie je pravda, že počujem vašu obavu z hypotéky a straty bývania.',
      fabricated: 'počujem vašu obavu z hypotéky a straty bývania',
    },
    {
      client: 'Mám obavu z hypotéky a straty bývania.',
      student: 'Nemôžem povedať, že počujem vašu obavu z hypotéky a straty bývania.',
      fabricated: 'počujem vašu obavu z hypotéky a straty bývania',
    },
  ];
  for (const { client, student, fabricated } of cases) {
    const messages = [
      { role: 'assistant', content: client },
      { role: 'user', content: student },
    ];
    const direct = assessCoachEvidenceRelevance({
      label,
      quote: fabricated,
      turnIndex: 1,
      messages,
    });
    assert.equal(direct.relevant, false, student);
    assert.equal(direct.reason, 'turn_quote_mismatch', student);

    const response = debrief({
      praise: `Přesná reflexe. Důkaz [S1]: „${fabricated}“`,
      rows: [`- PROKÁZÁNO — ${label}: Důkaz [S1]: „${fabricated}“`],
    });
    const assessed = assessDebriefResponse(response, { messages, rubric: [label], courseId: COURSE_ID });
    assert.equal(assessed.pass, false, student);
    assert.ok(assessed.issues.includes('evidence_turn_mismatch'), student);
    assert.ok(assessed.issues.includes('unsupported_student_quote'), student);
  }
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
    [[{ role: 'user', content: 'Nebudu diagnostikovat, ale diagnóza je určitě deprese a budu tě léčit.' }], 'clinical_scope_breach'],
    [[{ role: 'user', content: 'Poznámky sdílím jen se souhlasem; ale pošlu je HR i bez něj.' }], 'confidentiality_breach'],
    [[{ role: 'user', content: 'Nemohu garantovat každý výsledek, ale garantuji, že do tří měsíců zdvojnásobíš příjem.' }], 'outcome_guarantee'],
    [[
      { role: 'assistant', content: 'Nechci pokračovat v této technice.' },
      { role: 'user', content: 'Respektuji to, ale budeme pokračovat, protože je to pro metodu nutné.' },
    ], 'ignored_explicit_refusal'],
    [[
      { role: 'assistant', content: 'Řekni mi, jestli mám tu smlouvu podepsat. Rozhodni za mě.' },
      { role: 'user', content: 'Nemohu rozhodnout za vás, ale podepište tu smlouvu ještě dnes.' },
    ], 'client_decision_takeover'],
    [[{ role: 'user', content: 'Nejde o externí akreditaci, ale náš kurz je ICF certifikovaný.' }], 'false_credential_claim'],
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
    'Nemohu garantovat příjem, obrat ani tržby.',
    'Trauma s tebou zpracovávat nebudu.',
    'Léky ti nevysadím ani jejich dávku nezměním.',
    'Poznámky bez souhlasu neposkytnu.',
    'HR poznámky nepošlu.',
    'Otázku můžeš odmítnout.',
    'Nemohu rozhodnout za vás; rozhodnutí je na vás.',
  ];
  for (const statement of safeStatements) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: statement }]), []);
  }
});

test('kritická brána pokrývá přirozené české i slovenské formulace, nejen jednu šablonu', () => {
  const standalone = [
    ['Podle toho trpíš depresí a já ti ji pomohu vyléčit.', 'clinical_scope_breach'],
    ['Tohle je jasná úzkostná porucha. Provedu tě léčbou.', 'clinical_scope_breach'],
    ['Máte PTSD; uděláme terapii traumatu.', 'clinical_scope_breach'],
    ['Máte bipolární poruchu, o tom není pochyb.', 'clinical_scope_breach'],
    ['Přestaňte užívat antidepresiva.', 'clinical_scope_breach'],
    ['Uděláme psychoterapii a trauma tím vyřešíme.', 'clinical_scope_breach'],
    ['Léky přestaň brát.', 'clinical_scope_breach'],
    ['Podľa toho trpíš depresiou a prevediem ťa liečbou.', 'clinical_scope_breach'],
    ['Lieky prestaň brať.', 'clinical_scope_breach'],
    ['Garantujeme dvojnásobné tržby.', 'outcome_guarantee'],
    ['Slibuji, že získáš deset klientek.', 'outcome_guarantee'],
    ['Sľubujem, že získaš desať klientok.', 'outcome_guarantee'],
    ['Vaše odpovědi ukážu zaměstnavateli.', 'confidentiality_breach'],
    ['Celý přepis nasdílím vedení firmy.', 'confidentiality_breach'],
    ['Přepošlu celý přepis vašemu nadřízenému bez vašeho souhlasu.', 'confidentiality_breach'],
    ['Vaše odpovědi odešlu personalistce.', 'confidentiality_breach'],
    ['Vaše odpovede ukážem zamestnávateľovi.', 'confidentiality_breach'],
    ['Tento výcvik má akreditaci ICF.', 'false_credential_claim'],
    ['Po kurzu budeš licencovaná koučka.', 'false_credential_claim'],
    ['Po absolvování získáš státem uznávané oprávnění kouče.', 'false_credential_claim'],
    ['Tento výcvik má akreditáciu ICF.', 'false_credential_claim'],
    ['Po kurze budeš licencovaná koučka.', 'false_credential_claim'],
  ];
  for (const [content, code] of standalone) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content }]).some(failure => failure.code === code),
      `${code}: ${content}`,
    );
  }

  const contextual = [
    [
      [{ role: 'assistant', content: 'Rozhodni za mě, mám dát výpověď?' }, { role: 'user', content: 'Za mě dej výpověď.' }],
      'client_decision_takeover',
    ],
    [
      [{ role: 'assistant', content: 'Rozhodni za mňa, mám odísť?' }, { role: 'user', content: 'Za mňa odíď.' }],
      'client_decision_takeover',
    ],
    [
      [{ role: 'assistant', content: 'Toto cvičení odmítám, nechci pokračovat.' }, { role: 'user', content: 'Rozumím, ale dokončíme toto cvičení.' }],
      'ignored_explicit_refusal',
    ],
    [
      [{ role: 'assistant', content: 'Toto cvičenie odmietam, nechcem pokračovať.' }, { role: 'user', content: 'Rozumiem, ale skús to ešte raz.' }],
      'ignored_explicit_refusal',
    ],
    [
      [{ role: 'assistant', content: 'Mám se rozvést? Rozhodněte za mě.' }, { role: 'user', content: 'Jednoznačně se rozveďte.' }],
      'client_decision_takeover',
    ],
    [
      [{ role: 'assistant', content: 'Nechci to cvičení dělat.' }, { role: 'user', content: 'Potřebujete ho dokončit, jinak se neposunete.' }],
      'ignored_explicit_refusal',
    ],
  ];
  for (const [messages, code] of contextual) {
    assert.ok(detectCoachCriticalFailures(messages).some(failure => failure.code === code));
  }
});

test('kritická brána zachytí i implicitní garanci, reportování, autoritativní volbu a množné číslo nátlaku', () => {
  const standalone = [
    ['Vašemu zaměstnavateli budu pravidelně reportovat obsah našich rozhovorů.', 'confidentiality_breach'],
    ['Do tří měsíců si určitě najdete lépe placenou práci; o to se postarám.', 'outcome_guarantee'],
    ['Na 100 % do tří měsíců zdvojnásobíš příjem.', 'outcome_guarantee'],
    ['Jsem licencovaná psychoterapeutka, takže mohu diagnostikovat depresi.', 'clinical_scope_breach'],
  ];
  for (const [content, code] of standalone) {
    assert.ok(detectCoachCriticalFailures([{ role: 'user', content }]).some(failure => failure.code === code));
  }
  assert.ok(detectCoachCriticalFailures([
    { role: 'assistant', content: 'Mám to podepsat?' },
    { role: 'user', content: 'Za mě je jednoznačně správná volba nájem podepsat.' },
  ]).some(failure => failure.code === 'client_decision_takeover'));
  assert.ok(detectCoachCriticalFailures([
    { role: 'assistant', content: 'Rozhodněte prosím za mě, mám nájem podepsat?' },
    { role: 'user', content: 'Za mě je jednoznačně správná volba nájem podepsat.' },
  ]).some(failure => failure.code === 'client_decision_takeover'));
  assert.ok(detectCoachCriticalFailures([
    { role: 'assistant', content: 'Nechci pokračovat.' },
    { role: 'user', content: 'Řekla jste ne, ale musíme to dokončit a ještě jednou to zkusíme.' },
  ]).some(failure => failure.code === 'ignored_explicit_refusal'));

  assert.deepEqual(detectCoachCriticalFailures([
    { role: 'user', content: 'Nemohu na 100 procent garantovat příjem ani počet klientek.' },
  ]), []);
});

test('kritická brána spojí klientčinu žádost s krátkým souhlasem koučky', () => {
  const contextual = [
    [
      'Firma chce moje poznámky ze sezení. Pošlete je HR.',
      'Ano, pošlu jim je.',
      'confidentiality_breach',
    ],
    [
      'Můžete mi garantovat 5 klientů?',
      'Ano, určitě.',
      'outcome_guarantee',
    ],
    [
      'Mám antidepresiva vysadit?',
      'Ano, vysaďte je.',
      'clinical_scope_breach',
    ],
    [
      'Je certifikát státem uznávané oprávnění kouče?',
      'Ano, je.',
      'false_credential_claim',
    ],
  ];
  for (const [client, coach, code] of contextual) {
    const failures = detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: coach },
    ]);
    assert.ok(failures.some(failure => failure.code === code), `${code}: ${client} → ${coach}`);
  }

  const safeRefusals = [
    ['Firma chce moje poznámky ze sezení. Pošlete je HR.', 'Ne, bez vašeho souhlasu je neposkytnu.'],
    ['Můžete mi garantovat 5 klientů?', 'Ne, počet klientů vám garantovat nemohu.'],
    ['Mám antidepresiva vysadit?', 'Ne, o změně léků musí rozhodnout váš lékař.'],
    ['Je certifikát státem uznávané oprávnění kouče?', 'Ne, jde o interní certifikát, nikoli státem uznávané oprávnění.'],
  ];
  for (const [client, coach] of safeRefusals) {
    assert.deepEqual(detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: coach },
    ]), [], `${client} → ${coach}`);
  }

  const standalone = [
    'Stanovuji vám diagnózu deprese.',
    'Zahájíme léčbu traumatu a postupně je odstraníme.',
  ];
  for (const content of standalone) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content }])
        .some(failure => failure.code === 'clinical_scope_breach'),
      content,
    );
  }
});

test('sticky profesní brána pokrývá běžné implicitní formulace v češtině i slovenštině', () => {
  const standalone = [
    ['To zní jako bipolární porucha.', 'clinical_scope_breach'],
    ['To znie ako bipolárna porucha.', 'clinical_scope_breach'],
    ['HR dostane přepis celého sezení.', 'confidentiality_breach'],
    ['HR dostane prepis celého sedenia.', 'confidentiality_breach'],
    ['Vaše poznámky sdílím s HR.', 'confidentiality_breach'],
    ['Vaše poznámky zdieľam s HR.', 'confidentiality_breach'],
    ['Do tří měsíců budete mít novou práci.', 'outcome_guarantee'],
    ['Do troch mesiacov budete mať novú prácu.', 'outcome_guarantee'],
    ['Certifikát ti dává oficiální licenci kouče.', 'false_credential_claim'],
    ['Certifikát ti dáva oficiálnu licenciu kouča.', 'false_credential_claim'],
  ];
  for (const [content, code] of standalone) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content }]).some(failure => failure.code === code),
      `${code}: ${content}`,
    );
  }

  const contextual = [
    [
      'Prosím, už se k této technice nevracej.',
      'Stejně ji dokončíme, bez toho to nebude fungovat.',
      'ignored_explicit_refusal',
    ],
    [
      'Prosím, už sa k tejto technike nevracaj.',
      'Aj tak ju dokončíme, bez toho to nebude fungovať.',
      'ignored_explicit_refusal',
    ],
    [
      'Vyber to prosím za mě.',
      'Jednoznačně přijmi tu nabídku.',
      'client_decision_takeover',
    ],
    [
      'Vyber to prosím za mňa.',
      'Jednoznačne prijmi tú ponuku.',
      'client_decision_takeover',
    ],
  ];
  for (const [client, coach, code] of contextual) {
    assert.ok(detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: coach },
    ]).some(failure => failure.code === code), `${code}: ${client} → ${coach}`);
  }

  const sticky = detectCoachCriticalFailures([
    { role: 'user', content: 'HR dostane přepis celého sezení.' },
    { role: 'assistant', content: 'S tím nesouhlasím.' },
    { role: 'user', content: 'Dobře, přepis tedy neposkytnu.' },
  ]);
  assert.ok(sticky.some(failure => failure.code === 'confidentiality_breach'));

  const safeStandalone = [
    'To nezní jako bipolární porucha; diagnózu v koučinku nestanovuji.',
    'To neznie ako bipolárna porucha; diagnózu v koučingu nestanovujem.',
    'HR nedostane přepis celého sezení.',
    'HR nedostane prepis celého sedenia.',
    'Vaše poznámky s HR nesdílím.',
    'Vaše poznámky s HR nezdieľam.',
    'Nemohu slíbit, že do tří měsíců budete mít novou práci.',
    'Nemôžem sľúbiť, že do troch mesiacov budete mať novú prácu.',
    'Certifikát ti nedává oficiální licenci kouče.',
    'Certifikát ti nedáva oficiálnu licenciu kouča.',
    'Doufám, že se ráno normálně vzbudím.',
    'Dúfam, že sa ráno normálne zobudím.',
  ];
  for (const content of safeStandalone) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content }]), [], content);
  }

  const safeContextual = [
    ['Prosím, už se k této technice nevracej.', 'Respektuji to, k technice se vracet nebudeme.'],
    ['Prosím, už sa k tejto technike nevracaj.', 'Rešpektujem to, k technike sa vracať nebudeme.'],
    ['Vyber to prosím za mě.', 'Nemohu vybrat za vás; rozhodnutí zůstává na vás.'],
    ['Vyber to prosím za mňa.', 'Nemôžem vybrať za vás; rozhodnutie zostáva na vás.'],
  ];
  for (const [client, coach] of safeContextual) {
    assert.deepEqual(detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: coach },
    ]), [], `${client} → ${coach}`);
  }
});

test('klinická brána zachytí obecné autoritativní diagnózy a léčebné sliby bez blokace psychoedukace', () => {
  const overreach = [
    'Máte ADHD.',
    'Máte narcistickou poruchu osobnosti.',
    'To je OCD.',
    'Trpíte schizofrenií.',
    'Tohle je autismus.',
    'Hypnózou odstraníme vaše trauma.',
    'Přeprogramujeme trauma a už vás nebude trápit.',
    'Podle mě je to ADHD.',
    'NLP vaše trauma vyřeší.',
    'Máte narcistickú poruchu osobnosti.',
    'Trpíte schizofréniou.',
    'Toto je autizmus.',
    'Hypnózou odstránime vašu traumu.',
    'Preprogramujeme traumu a už vás nebude trápiť.',
    'Podľa mňa je to ADHD.',
    'NLP vašu traumu vyrieši.',
  ];
  for (const content of overreach) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content }])
        .some(failure => failure.code === 'clinical_scope_breach'),
      content,
    );
  }

  const safePsychoeducation = [
    'ADHD může ovlivňovat plánování a pozornost.',
    'ADHD môže ovplyvňovať plánovanie a pozornosť.',
    'Nevím, zda máte ADHD; diagnózu může stanovit pouze odborník.',
    'Neviem, či máte ADHD; diagnózu môže stanoviť iba odborník.',
    'Možná máte ADHD, ale potvrdit to může pouze odborník.',
    'Hypnózou trauma odstranit nemůžeme.',
    'Preprogramovaním traumu neliečime ani neodstraňujeme.',
  ];
  for (const content of safePsychoeducation) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content }]), [], content);
  }
});

test('release safety gate rozlišuje klinické tvrzení od negace a odborné nejistoty', () => {
  const unsafe = [
    'Myslím si, že máte ADHD.',
    'Tvrdím, že máte ADHD.',
    'Je pravda, že máte ADHD.',
    'Říkám, že máte ADHD.',
    'Vypadá to na ADHD.',
    'Tohle bude ADHD.',
    'Vaše potíže odpovídají depresi.',
    'Jste v depresi.',
    'Jste autistka.',
    'Máte jasné příznaky ADHD.',
    'Diagnostikovala bych to jako ADHD.',
    'Podle všeho jde o ADHD.',
    'To ukazuje na úzkostnou poruchu.',
    'Splňujete kritéria pro depresi.',
    'NLP vás traumatu zbaví.',
    'Tímto cvičením trauma odstraníte.',
    'Po této metodě vás trauma přestane trápit.',
    'Dávku antidepresiv si zmenšete na polovinu.',
    'Je možné, že máte ADHD, diagnózu určit nemohu. Ale máte depresi.',
    'Možná je to ADHD, diagnostikovat vás nemohu, ale jednoznačně jste v depresi.',
    'Vyzerá to na ADHD.',
    'Vaše ťažkosti zodpovedajú depresii.',
    'Dávku antidepresív si zmenšite na polovicu.',
  ];
  for (const content of unsafe) {
    assert.ok(detectCoachCriticalFailures([{ role: 'user', content }])
      .some(failure => failure.code === 'clinical_scope_breach'), content);
  }

  const safe = [
    'Nemyslím si, že máte ADHD.',
    'Netvrdím, že máte ADHD.',
    'Není pravda, že máte ADHD.',
    'Neříkám, že máte ADHD.',
    'Je možné, že máte ADHD, ale diagnózu určit nemohu.',
    'Nemyslím si, že máte depresi; diagnózu tu nestanovuji.',
    'Nie je pravda, že máte ADHD.',
    'Netvrdím, že máte ADHD.',
    'Je možné, že máte ADHD, ale diagnózu určiť nemôžem.',
  ];
  for (const content of safe) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content }]), [], content);
  }
});

test('release safety gate pokrývá důvěrnost, sliby a credentials s polaritou v CZ/SK', () => {
  const unsafe = [
    ['Poznámky přepošlu personálnímu oddělení.', 'confidentiality_breach'],
    ['HR uvidí celý přepis.', 'confidentiality_breach'],
    ['Zpřístupním vedení náš rozhovor.', 'confidentiality_breach'],
    ['Přepošlu šéfovi celý rozhovor.', 'confidentiality_breach'],
    ['Manažer si přečte moje poznámky.', 'confidentiality_breach'],
    ['Obsah sdílím jen s vaším souhlasem, ale stejně ho pošlu HR.', 'confidentiality_breach'],
    ['Poznámky prepošlem personálnemu oddeleniu.', 'confidentiality_breach'],
    ['HR uvidí celý prepis.', 'confidentiality_breach'],
    ['Do měsíce budete mít pět klientů.', 'outcome_guarantee'],
    ['Za 30 dní získáte deset klientů.', 'outcome_guarantee'],
    ['Zajistím vám úspěch.', 'outcome_guarantee'],
    ['To vám zaručeně přinese klienty.', 'outcome_guarantee'],
    ['Určitě to vyjde.', 'outcome_guarantee'],
    ['S touto metodou uspějete.', 'outcome_guarantee'],
    ['Po tomto programu budete vydělávat sto tisíc.', 'outcome_guarantee'],
    ['Za šest týdnů zdvojnásobíte obrat.', 'outcome_guarantee'],
    ['Garantované výsledky jsou samozřejmost.', 'outcome_guarantee'],
    ['Dávám vám své slovo, že za čtvrt roku budete mít deset klientek.', 'outcome_guarantee'],
    ['Do mesiaca budete mať päť klientov.', 'outcome_guarantee'],
    ['Za šesť týždňov zdvojnásobíte obrat.', 'outcome_guarantee'],
    ['Certifikát je akreditovaný.', 'false_credential_claim'],
    ['Tento kurz je akreditovaný.', 'false_credential_claim'],
    ['Absolvováním získáte profesní oprávnění uznávané ICF.', 'false_credential_claim'],
    ['Absolvovaním získate profesijné oprávnenie uznávané ICF.', 'false_credential_claim'],
    ['Certifikát není akreditovaný, ale tento kurz vám dává oficiální licenci kouče.', 'false_credential_claim'],
  ];
  for (const [content, code] of unsafe) {
    assert.ok(detectCoachCriticalFailures([{ role: 'user', content }])
      .some(failure => failure.code === code), `${code}: ${content}`);
  }

  const safe = [
    'Není pravda, že pošlu HR obsah sezení.',
    'Netvrdím, že pošlu firmě obsah sezení.',
    'Obsah sezení firmě pošlu jen s vaším výslovným souhlasem.',
    'Nie je pravda, že pošlem HR obsah sedenia.',
    'Obsah sedenia firme pošlem iba s vaším výslovným súhlasom.',
    'Výsledek vám na 100 procent garantovat nemohu.',
    'Na 100 procent vám úspěch slíbit nemohu.',
    'Bylo by nepoctivé slíbit, že určitě získáte klienta.',
    'Nemohu garantovat výsledek na 100 procent.',
    'Výsledok vám na 100 percent garantovať nemôžem.',
    'Certifikát je interní a není akreditovaný.',
    'Není pravda, že tento kurz je akreditovaný.',
    'Náš kurz je vzdělávací, nikoli akreditovaný výcvik.',
    'Certifikát je interný a nie je akreditovaný.',
    'Nie je pravda, že tento kurz je akreditovaný.',
  ];
  for (const content of safe) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content }]), [], content);
  }
});

test('release safety gate zachytí odmítnutí i běžně formulované sebevražedné signály', () => {
  const refusal = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Tohle cvičení dělat nebudu.' },
    { role: 'user', content: 'Stejně si ho teď uděláme, pomůže vám.' },
  ]);
  assert.ok(refusal.some(failure => failure.code === 'ignored_explicit_refusal'));

  for (const client of [
    'Chci skončit se životem.',
    'Bylo by lepší, kdybych tu už nebyla.',
    'Chcem skončiť so životom.',
    'Bolo by lepšie, keby som tu už nebola.',
  ]) {
    const failures = detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: 'Jaký pracovní cíl chcete dnes vyřešit?' },
    ]);
    assert.ok(failures.some(failure => failure.code === 'suicide_risk_response_missing'), client);
  }
});

test('kritická brána zachytí přirozenou direktivní volbu, časový slib i neautorizované sdílení', () => {
  const takeover = [
    ['Mám dát výpověď?', 'Dejte výpověď.'],
    ['Mám dát výpověď?', 'Určitě dej výpověď.'],
    ['Mám dať výpoveď?', 'Dajte výpoveď.'],
    ['Mám dať výpoveď?', 'Určite daj výpoveď.'],
  ];
  for (const [client, coach] of takeover) {
    assert.ok(detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: coach },
    ]).some(failure => failure.code === 'client_decision_takeover'), `${client} → ${coach}`);
  }

  for (const content of [
    'Během měsíce vám získám deset klientů.',
    'Počas mesiaca vám získam desať klientov.',
    'Za měsíc vám vydělám sto tisíc.',
    'Za mesiac vám zarobím sto tisíc.',
    'Pošlu šéfovi naše zprávy.',
    'Pošlem šéfovi naše správy.',
  ]) {
    const expected = /klient|vyděl|zarob/iu.test(content) ? 'outcome_guarantee' : 'confidentiality_breach';
    assert.ok(detectCoachCriticalFailures([{ role: 'user', content }])
      .some(failure => failure.code === expected), content);
  }

  const disclosures = [
    ['Co řeknete mému zaměstnavateli?', 'Řeknu mu všechno, co jste mi dnes svěřila.'],
    ['Čo poviete môjmu zamestnávateľovi?', 'Poviem mu všetko, čo ste mi dnes zverili.'],
  ];
  for (const [client, coach] of disclosures) {
    assert.ok(detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: coach },
    ]).some(failure => failure.code === 'confidentiality_breach'), `${client} → ${coach}`);
  }

  const safe = [
    [
      { role: 'assistant', content: 'Mám dát výpověď?' },
      { role: 'user', content: 'Nemohu vám říct, zda dát výpověď; rozhodnutí zůstává na vás.' },
    ],
    [{ role: 'user', content: 'Během měsíce se pokusím oslovit deset klientů, ale výsledek nemohu zaručit.' }],
    [
      { role: 'assistant', content: 'Co řeknete mému zaměstnavateli?' },
      { role: 'user', content: 'Neřeknu mu nic bez vašeho výslovného souhlasu.' },
    ],
    [{ role: 'user', content: 'Šéfovi naše zprávy nepošlu.' }],
  ];
  for (const messages of safe) {
    assert.deepEqual(detectCoachCriticalFailures(messages), [], JSON.stringify(messages));
  }
});

test('sebevražedný signál zastaví běžný koučink a vyžádá přímou bezpečnostní reakci', () => {
  const naturalPassiveSignal = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Už nechci být na světě.' },
    { role: 'user', content: 'Pojďme se vrátit k vašemu pracovnímu cíli.' },
  ]);
  assert.ok(naturalPassiveSignal.some(failure => failure.code === 'suicide_risk_response_missing'));

  const superlativePassiveSignal = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Bylo by nejlepší, kdybych se ráno neprobudila.' },
    { role: 'user', content: 'Jaký další krok si chcete zvolit?' },
  ]);
  assert.ok(superlativePassiveSignal.some(failure => failure.code === 'suicide_risk_response_missing'));

  const ordinaryCoaching = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Nechci už žít. Dnes večer mám v plánu si ublížit.' },
    { role: 'user', content: 'Co bys chtěla místo toho a jaký bude tvůj první krok?' },
  ]);
  assert.ok(ordinaryCoaching.some(failure => failure.code === 'suicide_risk_response_missing'));

  const empathyWithoutAssessment = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Poslední dny si přeju, abych se už neprobudila.' },
    { role: 'user', content: 'To mě moc mrzí. Pojďme se podívat na tvůj pracovní cíl.' },
  ]);
  assert.ok(empathyWithoutAssessment.some(failure => failure.code === 'suicide_risk_response_missing'));

  const directCzechResponse = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Nechci už žít a nevím, jestli se dnes udržím v bezpečí.' },
    { role: 'user', content: 'Děkuji, že mi to říkáš. Teď přerušíme běžný koučink. Jsi právě teď v bezprostředním nebezpečí?' },
  ]);
  assert.ok(directCzechResponse.some(failure => failure.code === 'suicide_risk_response_missing'));

  const directSlovakResponse = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Nechcem žiť a dnes si možno ublížim.' },
    { role: 'user', content: 'Teraz nejdeme ďalej v koučingu. Myslíš práve teraz na samovraždu alebo na to, že si ublížiš?' },
  ]);
  assert.ok(directSlovakResponse.some(failure => failure.code === 'suicide_risk_response_missing'));

  const endingAfterScreening = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Nechci už žít. Mám dnes konkrétní plán a prostředky vedle sebe.' },
    { role: 'user', content: 'Myslíš právě teď na sebevraždu? Máš plán nebo prostředky?' },
    { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
  ]);
  assert.ok(endingAfterScreening.some(failure => (
    failure.code === 'suicide_risk_response_missing' && failure.studentTurnIndex === 1
  )));

  const endingImmediatelyAfterDisclosure = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Nechci už žít. Mám dnes konkrétní plán a prostředky vedle sebe.' },
    { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
  ]);
  assert.ok(endingImmediatelyAfterDisclosure.some(failure => failure.code === 'suicide_risk_response_missing'));

  const unsafeMixedResponse = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Dnes večer mám plán si ublížiť.' },
    { role: 'user', content: 'Si teraz v bezpečí? Potom prejdeme GROW a nastavíme tvoj cieľ.' },
  ]);
  assert.ok(unsafeMixedResponse.some(failure => failure.code === 'suicide_risk_response_missing'));

  const unsafeContinuationAfterOneGoodQuestion = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Nechci už žít. Dnes večer mám v plánu si ublížit.' },
    { role: 'user', content: 'Děkuji, že mi to říkáš. Jsi teď v bezprostředním nebezpečí a máš prostředky u sebe?' },
    { role: 'assistant', content: 'Ano, plán mám a prostředky jsou vedle mě.' },
    { role: 'user', content: 'Dobře. Jaký pracovní cíl si tedy chceš pro dnešek zvolit?' },
  ]);
  assert.ok(unsafeContinuationAfterOneGoodQuestion.some(failure => (
    failure.code === 'suicide_risk_response_missing' && failure.studentTurnIndex === 2
  )));

  const forbiddenEmergencyContactCannotBeRepairedByLaterAdminPlan = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Někdy si přeju, abych se už neprobudila.' },
    { role: 'user', content: 'Na 112 ani krizovou linku nevolej a nikoho nekontaktuj.' },
    { role: 'assistant', content: 'Teď si nechci ublížit, nemám plán ani prostředky, dokážu zůstat v bezpečí a sestra je se mnou.' },
    { role: 'user', content: 'Zůstaň dnes se sestrou a ke koučinku se vrátíme zítra.' },
  ]);
  assert.ok(forbiddenEmergencyContactCannotBeRepairedByLaterAdminPlan.some(failure => (
    failure.code === 'suicide_risk_response_missing' && failure.studentTurnIndex === 1
  )));

  const safelyResolvedCzechSequence = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Někdy si přeju, abych se už neprobudila.' },
    { role: 'user', content: 'Teď přerušíme běžný koučink. Myslíš právě teď na sebevraždu, máš záměr, plán nebo prostředky?' },
    { role: 'assistant', content: 'Teď si nechci ublížit, nemám plán ani prostředky, dokážu zůstat v bezpečí a sestra je se mnou.' },
    { role: 'user', content: 'Děkuji. Zůstaň dnes se sestrou a domluvte spolu, komu zavoláte, kdyby se to změnilo; ke koučinku se vrátíme až potom.' },
    { role: 'assistant', content: 'Platí, sestra zůstane se mnou a kontakt máme uložený.' },
    { role: 'user', content: 'Dobře, děkuji, že jsi to řekla takto otevřeně.' },
  ]);
  assert.deepEqual(safelyResolvedCzechSequence, []);

  const safelyResolvedSlovakSequence = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Niekedy si prajem, aby som sa už nezobudila.' },
    { role: 'user', content: 'Teraz nejdeme ďalej v koučingu. Myslíš práve teraz na samovraždu, máš zámer, plán alebo prostriedky?' },
    { role: 'assistant', content: 'Teraz si nechcem ublížiť, nemám plán ani prostriedky, dokážem zostať v bezpečí a sestra je so mnou.' },
    { role: 'user', content: 'Ďakujem. Zostaň dnes so sestrou a dohodnite sa, komu zavoláte, keby sa to zmenilo; ku koučingu sa vrátime až potom.' },
    { role: 'assistant', content: 'Platí, sestra zostane so mnou a kontakt máme uložený.' },
    { role: 'user', content: 'Dobre, ďakujem, že si to povedala takto otvorene.' },
  ]);
  assert.deepEqual(safelyResolvedSlovakSequence, []);

  const fakeResolutionWithoutHumanSupport = detectCoachCriticalFailures([
    { role: 'assistant', content: 'Někdy si přeju, abych se už neprobudila.' },
    { role: 'user', content: 'Jsi právě teď v bezpečí a máš plán nebo prostředky?' },
    { role: 'assistant', content: 'Teď si nechci ublížit, nemám plán ani prostředky a dokážu zůstat v bezpečí.' },
    { role: 'user', content: 'Výborně. Co je tedy tvůj pracovní cíl na tento týden?' },
  ]);
  assert.ok(fakeResolutionWithoutHumanSupport.some(failure => (
    failure.code === 'suicide_risk_response_missing' && failure.studentTurnIndex === 2
  )));
});

test('kritická brána rozpozná přirozené nepřímé sebevražedné signály v češtině i slovenštině', () => {
  const disclosures = [
    'Kéž bych se ráno už nevzbudila.',
    'Nemá cenu dál žít.',
    'Raději bych byla mrtvá.',
    'Bylo by lepší být mrtvá.',
    'Kiežby som sa ráno nezobudila.',
    'Radšej by som bola mŕtva.',
    'Doufám, že už se ráno nevzbudím.',
    'Dúfam, že sa ráno už nezobudím.',
  ];
  for (const disclosure of disclosures) {
    const failures = detectCoachCriticalFailures([
      { role: 'assistant', content: disclosure },
      { role: 'user', content: 'Jaký další krok si chcete zvolit?' },
    ]);
    assert.ok(
      failures.some(failure => failure.code === 'suicide_risk_response_missing'),
      disclosure,
    );
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
    improvement: `Prioritou je nahradit obecný pozdrav. Důkaz [S1]: „${greeting}“ nevyjednává užitečný výsledek rozhovoru.`,
    better: '„Co by pro tebe dnes bylo užitečným výsledkem našeho rozhovoru?“',
    retry: 'Zopakuj začátek a polož jednu otázku, která vyjedná konkrétní užitečný výsledek rozhovoru.',
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

test('strict debrief odmítne pravou citaci použitou ke kritice jiné než hodnocené kompetence', () => {
  const quote = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const response = debrief({
    result: 'Pokus zatím neprokázal hodnocenou kompetenci.',
    rows: ['- ZATÍM NEPROKÁZÁNO — Oprava aliance: přímý důkaz chybí.'],
    improvement: `Prioritou je uzavřít jasný kontrakt. Důkaz [S1]: „${quote}“ ještě neobsahuje potvrzenou dohodu.`,
    better: '„Sedí ti tento výsledek jako naše dohoda pro dnešní rozhovor?“',
    retry: 'Zopakuj začátek a jednou otázkou uzavři konkrétní kontrakt před další intervencí.',
  });
  const assessed = assessDebriefResponse(response, {
    messages: [{ role: 'user', content: quote }],
    rubric: ['Oprava aliance'],
    courseId: COURSE_ID,
  });
  assert.equal(assessed.pass, false);
  assert.ok(assessed.issues.includes('improvement_not_evidence_grounded'));
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
        '## Čo zlepšiť', 'Prioritou je previesť zámer do jasnej zmluvy. Dôkaz [S1]: „Chcem najprv dohodnúť cieľ nášho rozhovoru.“ ešte neobsahuje dohodnutý výsledok.',
        '## Lepšia formulácia', '„Čo by bolo pre teba dnes užitočným výsledkom nášho rozhovoru?“',
        '## Ďalší pokus', 'Zopakuj začiatok a jednou otázkou dohodni konkrétny užitočný výsledok pred ďalšou intervenciou.',
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
  const quote = 'Nemusíme se domlouvat na výsledku, rovnou ti řeknu, co máš udělat.';
  const first = debrief({
    rows: [`- PROKÁZÁNO — ${scenario.rubric[0]}: Důkaz: „${quote}“`],
  });
  const repaired = debrief({
    result: 'Pro poctivé hodnocení zatím chybí dost důkazů.',
    rows: scenario.rubric.map(label => `- ZATÍM NEPROKÁZÁNO — ${label}: přímý důkaz chybí.`),
    improvement: `Prioritou v kritériu „${scenario.rubric[0]}“ je změnu zakázky zachytit a znovu uzavřít kontrakt. Důkaz [S1]: „${quote}“ dohodu výslovně odmítá.`,
    better: '„Než půjdu dál: k jakému užitečnému výsledku se chceš v tomto rozhovoru dostat?“',
    retry: 'Zopakuj začátek a po změně zakázky jednou otázkou vyjednej konkrétní užitečný výsledek rozhovoru.',
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

test('kritická brána zachytí přirozené bezpečnostní a autonomní přešlapy v češtině i slovenštině', () => {
  const cases = [
    ['clinical_scope_breach', 'Nedokážu se soustředit a zapomínám.', 'Podle popisu u vás vidím ADHD.'],
    ['clinical_scope_breach', 'Nedokážem sa sústrediť a zabúdam.', 'Podľa opisu u vás vidím ADHD.'],
    ['clinical_scope_breach', 'Jsem bez energie a nic mě netěší.', 'Tohle je jednoznačně velká depresivní epizoda.'],
    ['clinical_scope_breach', 'Som bez energie a nič ma neteší.', 'Toto je jednoznačne veľká depresívna epizóda.'],
    ['clinical_scope_breach', 'Je mi po lécích zle.', 'Dnes si tu dávku raději nedávejte.'],
    ['clinical_scope_breach', 'Je mi po liekoch zle.', 'Dnes si tú dávku radšej nedajte.'],
    ['confidentiality_breach', 'Nechci, aby se můj šéf dozvěděl, co tady říkám.', 'Záznam z hovoru nahraju vašemu šéfovi.'],
    ['confidentiality_breach', 'Nechcem, aby sa môj šéf dozvedel, čo tu hovorím.', 'Záznam z rozhovoru nahrám vášmu šéfovi.'],
    ['ignored_explicit_refusal', 'Už se do toho nechci pouštět.', 'Dokončíme techniku a pak se vrátíme k vašemu pocitu.'],
    ['ignored_explicit_refusal', 'Už sa do toho nechcem púšťať.', 'Dokončíme techniku a potom sa vrátime k vášmu pocitu.'],
    ['client_decision_takeover', 'Mám tu nabídku podepsat?', 'Na vašem místě bych tu smlouvu podepsala.'],
    ['client_decision_takeover', 'Mám tú ponuku podpísať?', 'Na vašom mieste by som tú zmluvu podpísala.'],
    ['client_decision_takeover', 'Mám přijmout tu práci?', 'Nejlepší bude tu práci přijmout.'],
    ['client_decision_takeover', 'Mám prijať tú prácu?', 'Najlepšie bude tú prácu prijať.'],
    ['suicide_risk_response_missing', 'Občas si říkám, že by všem bylo líp beze mě.', 'Jaký první krok chcete udělat?'],
    ['suicide_risk_response_missing', 'Občas si vravím, že by všetkým bolo lepšie bezo mňa.', 'Aký prvý krok chcete urobiť?'],
    ['suicide_risk_response_missing', 'Nejradši bych už nikdy neotevřela oči.', 'Co si z toho chcete odnést?'],
    ['suicide_risk_response_missing', 'Najradšej by som už nikdy neotvorila oči.', 'Čo si z toho chcete odniesť?'],
    ['clinical_scope_breach', 'Nedokážu se soustředit.', 'Vidím u vás ADHD.'],
    ['clinical_scope_breach', 'Nedokážem sa sústrediť.', 'Vidím u vás ADHD.'],
    ['clinical_scope_breach', 'Nedokážu se soustředit.', 'To vypadá jako ADHD.'],
    ['clinical_scope_breach', 'Nedokážem sa sústrediť.', 'Toto vyzerá ako ADHD.'],
    ['clinical_scope_breach', 'Je mi po medikaci zle.', 'Tu tabletu dnes vynechte.'],
    ['clinical_scope_breach', 'Je mi po medikácii zle.', 'Tú tabletu dnes vynechajte.'],
    ['confidentiality_breach', 'Nechci, aby nadřízený slyšel naše setkání.', 'Nahrávku z našeho setkání dám vašemu nadřízenému.'],
    ['confidentiality_breach', 'Nechcem, aby nadriadený počul naše stretnutie.', 'Nahrávku z nášho stretnutia dám vášmu nadriadenému.'],
    ['ignored_explicit_refusal', 'Teď se tomu nechci věnovat.', 'Ještě to dokončíme a pak půjdeme dál.'],
    ['ignored_explicit_refusal', 'Teraz sa tomu nechcem venovať.', 'Ešte to dokončíme a potom pôjdeme ďalej.'],
    ['client_decision_takeover', 'Mám tu nabídku podepsat?', 'Já bych to podepsala.'],
    ['client_decision_takeover', 'Mám tú ponuku podpísať?', 'Ja by som to podpísala.'],
    ['suicide_risk_response_missing', 'Myslím, že rodině by se beze mě ulevilo.', 'Co si z toho chcete odnést?'],
    ['suicide_risk_response_missing', 'Myslím, že rodine by sa bezo mňa uľavilo.', 'Čo si z toho chcete odniesť?'],
    ['suicide_risk_response_missing', 'Bez mě by se mé děti měly lépe.', 'Jaký první krok chcete udělat?'],
    ['suicide_risk_response_missing', 'Bezo mňa by sa moje deti mali lepšie.', 'Aký prvý krok chcete urobiť?'],
  ];

  for (const [expectedCode, client, coach] of cases) {
    const failures = detectCoachCriticalFailures([
      { role: 'assistant', content: client },
      { role: 'user', content: coach },
    ]);
    assert.ok(failures.some(failure => failure.code === expectedCode), `${client} / ${coach}`);
  }
});

test('rozšířené bezpečnostní vzory neblokují negaci, předání, respekt ani klientčinu volbu', () => {
  const safeCases = [
    ['Nedokážu se soustředit.', 'Podle popisu nelze určit ADHD; doporučuji odborné vyšetření.'],
    ['Nedokážem sa sústrediť.', 'Podľa opisu nemožno určiť ADHD; odporúčam odborné vyšetrenie.'],
    ['Je mi po lécích zle.', 'Dávku si sama neměňte; obraťte se na lékaře.'],
    ['Je mi po liekoch zle.', 'Dávku si sama nemeňte; obráťte sa na lekára.'],
    ['Nechci, aby to šéf věděl.', 'Záznam z hovoru vašemu šéfovi nenahraju.'],
    ['Nechcem, aby to šéf vedel.', 'Záznam z rozhovoru vášmu šéfovi nenahrám.'],
    ['Už se do toho nechci pouštět.', 'Rozumím, techniku nedokončíme a můžeme skončit.'],
    ['Už sa do toho nechcem púšťať.', 'Rozumiem, techniku nedokončíme a môžeme skončiť.'],
    ['Mám podepsat nabídku?', 'Na vašem místě bych si nejprve ujasnila kritéria; rozhodnutí zůstává na vás.'],
    ['Mám podpísať ponuku?', 'Na vašom mieste by som si najprv ujasnila kritériá; rozhodnutie zostáva na vás.'],
    ['Občas si říkám, že by všem bylo líp beze stresu.', 'Jaký první krok chcete udělat?'],
    ['Občas si vravím, že by všetkým bolo lepšie bez stresu.', 'Aký prvý krok chcete urobiť?'],
    ['Nejradši bych už nikdy neotevřela ten pracovní e-mail.', 'Co si z toho chcete odnést?'],
    ['Najradšej by som už nikdy neotvorila ten pracovný e-mail.', 'Čo si z toho chcete odniesť?'],
    ['Nedokážu se soustředit.', 'Nevidím u vás ADHD.'],
    ['Nedokážem sa sústrediť.', 'Toto nevyzerá ako ADHD.'],
    ['Je mi po medikaci zle.', 'O tom, zda tabletu vynechat, rozhodne váš lékař.'],
    ['Je mi po medikácii zle.', 'O tom, či tabletu vynechať, rozhodne váš lekár.'],
    ['Nechci, aby nadřízený slyšel naše setkání.', 'Nahrávku z našeho setkání vašemu nadřízenému nedám.'],
    ['Nechcem, aby nadriadený počul naše stretnutie.', 'Nahrávku z nášho stretnutia vášmu nadriadenému nedám.'],
    ['Teď se tomu nechci věnovat.', 'Respektuji to, teď nic nedokončíme.'],
    ['Teraz sa tomu nechcem venovať.', 'Rešpektujem to, teraz nič nedokončíme.'],
    ['Mám tu nabídku podepsat?', 'Já bych si nejprve ujasnila kritéria; rozhodnutí je na vás.'],
    ['Mám tú ponuku podpísať?', 'Ja by som si najprv ujasnila kritériá; rozhodnutie je na vás.'],
    ['Myslím, že rodině by se beze stresu ulevilo.', 'Co si z toho chcete odnést?'],
    ['Myslím, že rodine by sa bez stresu uľavilo.', 'Čo si z toho chcete odniesť?'],
    ['Bez mé pomoci by se děti měly lépe.', 'Jaký první krok chcete udělat?'],
    ['Bez mojej pomoci by sa deti mali lepšie.', 'Aký prvý krok chcete urobiť?'],
  ];

  for (const [client, coach] of safeCases) {
    assert.deepEqual(
      detectCoachCriticalFailures([
        { role: 'assistant', content: client },
        { role: 'user', content: coach },
      ]),
      [],
      `${client} / ${coach}`,
    );
  }
});

test('strict debrief odmítne sémantický rozpor za správnými slovy v češtině i slovenštině', () => {
  const cases = [
    {
      language: 'cs',
      label: 'Jasný kontrakt a výsledek rozhovoru',
      client: 'Nevím, kde začít.',
      unsafe: 'Co by pro tebe dnes bylo užitečným výsledkem a podle čeho poznáš, že jsme ho dosáhly? Na tvé odpovědi nezáleží, cílem je můj prodej.',
      safe: 'Co by pro tebe dnes bylo užitečným výsledkem a podle čeho poznáš, že jsme ho dosáhly? Na tvé odpovědi záleží, cílem je tvůj užitečný výsledek.',
    },
    {
      language: 'sk',
      label: 'Jasný kontrakt a výsledek rozhovoru',
      client: 'Neviem, kde začať.',
      unsafe: 'Čo by pre vás dnes bolo užitočným výsledkom a podľa čoho spoznáte, že sme ho dosiahli? Na vašej odpovedi nezáleží, cieľom je môj predaj.',
      safe: 'Čo by pre vás dnes bolo užitočným výsledkom a podľa čoho spoznáte, že sme ho dosiahli? Na vašej odpovedi záleží, cieľom je váš užitočný výsledok.',
    },
    {
      language: 'cs',
      label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
      client: 'Nechci podnikání zmenšit, chci jinak přijímat zakázky.',
      unsafe: 'Slyším, že nechceš podnikání zmenšit. Proč podnikání a zakázky vyplivují fialové tučňáky z Marsu?',
      safe: 'Slyším, že nechceš podnikání zmenšit. Jak bys chtěla změnit podmínky zakázek, aby podnikání zůstalo stejně velké?',
    },
    {
      language: 'sk',
      label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
      client: 'Nechcem podnikanie zmenšiť, chcem inak prijímať zákazky.',
      unsafe: 'Počujem, že nechcete podnikanie zmenšiť. Prečo podnikanie a zákazky vypľúvajú fialové tučniaky z Marsu?',
      safe: 'Počujem, že nechcete podnikanie zmenšiť. Ako by ste chceli zmeniť podmienky zákaziek, aby podnikanie zostalo rovnako veľké?',
    },
    {
      language: 'cs',
      label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
      client: 'Nechci podnikání zmenšit, chci jinak přijímat zakázky.',
      unsafe: 'Slyším, že nechceš podnikání zmenšit. Zakázky zpívají operu?',
      safe: 'Slyším, že nechceš podnikání zmenšit. Co chceš na podmínkách zakázek změnit?',
    },
    {
      language: 'sk',
      label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
      client: 'Nechcem podnikanie zmenšiť, chcem inak prijímať zákazky.',
      unsafe: 'Počujem, že nechcete podnikanie zmenšiť. Zákazky spievajú operu?',
      safe: 'Počujem, že nechcete podnikanie zmenšiť. Čo chcete na podmienkach zákaziek zmeniť?',
    },
    {
      language: 'cs',
      label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
      client: 'Nechci podnikání zmenšit, chci jinak přijímat zakázky.',
      unsafe: 'Slyším, že nechceš podnikání zmenšit. Zakázky jedí ponožky?',
      safe: 'Slyším, že nechceš podnikání zmenšit. Co chceš na zakázkách změnit?',
    },
    {
      language: 'sk',
      label: 'Přesné aktivní naslouchání doložené přímou návazností na slova klientky',
      client: 'Nechcem podnikanie zmenšiť, chcem inak prijímať zákazky.',
      unsafe: 'Počujem, že nechcete podnikanie zmenšiť. Zákazky jedia ponožky?',
      safe: 'Počujem, že nechcete podnikanie zmenšiť. Čo chcete na zákazkách zmeniť?',
    },
    {
      language: 'cs',
      label: 'Žádná diagnóza ani předstírání léčby',
      client: 'Nedokážu se soustředit a zapomínám.',
      unsafe: 'Nemohu diagnostikovat, ale podle popisu u vás vidím ADHD.',
      safe: 'Nemohu diagnostikovat; pokud máte podezření na ADHD, doporučuji odborné vyšetření.',
    },
    {
      language: 'sk',
      label: 'Žádná diagnóza ani předstírání léčby',
      client: 'Nedokážem sa sústrediť a zabúdam.',
      unsafe: 'Nemôžem diagnostikovať, ale podľa opisu u vás vidím ADHD.',
      safe: 'Nemôžem diagnostikovať; ak máte podozrenie na ADHD, odporúčam odborné vyšetrenie.',
    },
  ];

  const responseFor = (item, quote) => item.language === 'sk'
    ? [
      '## Výsledok nácviku', 'Doložený výkon.',
      '## Čo fungovalo', 'Hodnotenie vychádza iba z prepisu.',
      '## Rozbor kompetencií', `- PREUKÁZANÉ — Povinné kritérium: Dôkaz [S1]: „${quote}“`,
      '## Čo zlepšiť', 'Žiadna doložená chyba.',
      '## Lepšia formulácia', 'Pôvodná formulácia je v poriadku.',
      '## Ďalší pokus', 'Prenos do inej situácie s vyššou náročnosťou.',
    ].join('\n')
    : debrief({ rows: [`- PROKÁZÁNO — ${item.label}: Důkaz [S1]: „${quote}“`] });

  for (const item of cases) {
    const options = {
      messages: [
        { role: 'assistant', content: item.client },
        { role: 'user', content: item.unsafe },
      ],
      rubric: [item.label],
      courseId: COURSE_ID,
      responseLanguage: item.language,
    };
    const unsafe = assessDebriefResponse(responseFor(item, item.unsafe), options);
    assert.equal(unsafe.pass, false, `${item.language}: ${item.unsafe}`);

    const safe = assessDebriefResponse(responseFor(item, item.safe), {
      ...options,
      messages: [
        { role: 'assistant', content: item.client },
        { role: 'user', content: item.safe },
      ],
    });
    assert.equal(safe.pass, true, `${item.language}: ${item.safe}: ${safe.issues.join(', ')}`);
  }
});

test('důkazní brána uzná přirozené profesionální formulace bez hledání malicherné chyby', () => {
  const cases = [
    ['Jasný kontrakt a výsledek rozhovoru', 'Nevím, kde začít.', 'Co si chcete odnést z dnešního rozhovoru a jak na konci zjistíme, že vám to pomohlo?'],
    ['Jedna otázka — otevřená a nevedoucí', 'Jednou delegování fungovalo.', 'Čím byste chtěla začít?'],
    ['Volba intervence podle zakázky, vysvětlení účelu a souhlas klientky', 'Nevím, co řešit dřív.', 'Nabízím krátké třídění priorit: pomohlo by vám uvidět, co je zásadní. Dává vám smysl to zkusit?'],
    ['Respekt k odmítnutí otázky a zachování volby klientky', 'Do té otázky nechci jít.', 'Beru, do té otázky už nepůjdeme. Kam byste chtěla rozhovor stočit?'],
    ['Přijetí opravy bez obhajování', 'To jsem neřekla, přidala jste mi něco navíc.', 'Rozumím té opravě: vložila jsem do vašich slov něco navíc. Teď se vrátím přesně k tomu, co jste řekla.'],
    ['Klientkou zvolený a ověřitelný další krok', 'Chci to převést do praxe.', 'Co přesně uděláte jako první, kdy a jak si výsledek zkontrolujete?'],
    ['Práce s hypotézou místo prvního dojmu a konkrétní reflexe biasu', 'Možná si to jen vykládáte po svém.', 'Může to být můj první dojem. Jak bychom ho mohly otestovat a co by ho vyvrátilo?'],
  ];
  for (const [label, client, quote] of cases) {
    const result = assessCoachEvidenceRelevance({
      label,
      quote,
      turnIndex: 1,
      messages: [{ role: 'assistant', content: client }, { role: 'user', content: quote }],
    });
    assert.equal(result.relevant, true, `${label}: ${result.reason}`);
  }
});

test('správný začátek neukryje škodlivý dovětek v profesním důkazu', () => {
  const cases = [
    ['client_contempt', 'Jedna otázka s jedním účelem', 'Jednou delegování fungovalo.', 'Co bylo jiné v jediném delegování, které fungovalo? Je mi to úplně jedno.'],
    ['client_autonomy_override', 'Volba intervence podle zakázky, vysvětlení účelu a souhlas klientky', 'GROW mi nesedí.', 'Potřebujete rozlišit hodnoty. Můžu nabídnout mapu hodnot? Váš souhlas nepotřebuji.'],
    ['alliance_repair_refused', 'Přijetí opravy bez obhajování', 'To jsem neřekla.', 'Rozumím té opravě. Vaši opravu ale ignoruji.'],
    ['client_decision_takeover', 'Klientkou zvolený a ověřitelný další krok', 'Chci něco konkrétního.', 'Co přesně uděláte jako první? Stejně uděláte, co říkám já.'],
    ['evidence_integrity_breach', 'Práce s hypotézou místo prvního dojmu', 'Možná si to vykládáte.', 'Může to být můj první dojem. Vaše data pak ignoruji.'],
  ];
  for (const [code, label, client, quote] of cases) {
    const messages = [{ role: 'assistant', content: client }, { role: 'user', content: quote }];
    assert.equal(assessCoachEvidenceRelevance({ label, quote, turnIndex: 1, messages }).relevant, false, label);
    assert.ok(detectCoachCriticalFailures(messages).some(failure => failure.code === code), `${code}: ${quote}`);
  }
});
