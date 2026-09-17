import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_COACH_DEBRIEF_RENDERER_ID,
  createCanonicalCoachDebrief,
  renderCanonicalCoachDebrief,
} from '../src/canonical-coach-debrief.js';
import {
  COACH_EVIDENCE_LEDGER_ID,
  buildCoachEvidenceLedger,
} from '../src/coach-evidence-ledger.js';
import {
  assessDebriefResponse,
  debriefAchievementSummary,
} from '../src/training-quality.js';

const COURSE_ID = 'profesionalni-life-coach';
const CONTRACT = 'Kontrakt a jasný cíl rozhovoru';
const LISTENING = 'Pozorovatelný důkaz: reflexe klientčiných slov';

function evaluate(result, messages, rubric, language = 'cs') {
  return assessDebriefResponse(result.text, {
    messages,
    rubric,
    courseId: COURSE_ID,
    responseLanguage: language,
  });
}

test('flawless výkon zůstane bez vymyšlené chyby a projde nezávislou bránou', () => {
  const messages = [
    { role: 'assistant', content: 'Potřebuji si ujasnit směr.' },
    { role: 'user', content: 'Co si chceš z dnešního rozhovoru odnést a podle čeho poznáš, že ti pomohl?' },
    { role: 'assistant', content: 'Chci jasný další krok.' },
    { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik.' },
  ];
  const rubric = [CONTRACT];
  const result = createCanonicalCoachDebrief({
    messages,
    rubric,
    generationProvider: 'openai/gpt-release-evaluator',
  });

  assert.equal(result.ledger.rows[0].status, 'proven');
  assert.equal(result.achievement.allProven, true);
  assert.match(result.text, /Výborně — v rámci tohoto nácviku/u);
  assert.match(result.text, /Tohle bylo opravdu dobře zvládnuté/u);
  assert.doesNotMatch(result.text, /\bserver\b|\bstudentk|\b(?:tah|tahy|tazích)\b|bez doložené chyby/iu);
  assert.doesNotMatch(result.text, /není potřeba/iu);
  assert.equal(evaluate(result, messages, rubric).pass, true);
  assert.deepEqual(
    debriefAchievementSummary(result.text, rubric, { messages, courseId: COURSE_ID }).rows,
    result.achievement.rows,
  );
  assert.equal(result.provenance.generationProvider, 'openai/gpt-release-evaluator');
  assert.equal(result.provenance.evidenceEngine, COACH_EVIDENCE_LEDGER_ID);
  assert.equal(result.provenance.renderer, CANONICAL_COACH_DEBRIEF_RENDERER_ID);
});

test('mixed výkon uzná doloženou kompetenci a nevymyslí důkaz pro chybějící', () => {
  const messages = [
    { role: 'assistant', content: 'Potřebuji si ujasnit směr.' },
    { role: 'user', content: 'Co si chceš z dnešního rozhovoru odnést a podle čeho poznáš, že ti pomohl?' },
    { role: 'assistant', content: 'Chci jasný další krok.' },
  ];
  const rubric = [CONTRACT, LISTENING];
  const result = createCanonicalCoachDebrief({ messages, rubric });

  assert.deepEqual(result.ledger.rows.map(row => row.status), ['proven', 'not_proven']);
  assert.equal(result.ledger.rows[1].evidence.length, 0);
  assert.equal(result.ledger.priority.criterionIndex, 1);
  assert.match(result.text, /PROKÁZÁNO — Kontrakt/u);
  assert.match(result.text, /ZATÍM NEPROKÁZÁNO — Pozorovatelný důkaz/u);
  assert.match(result.text, /## Lepší formulace\n„Slyším/u);
  assert.match(result.text, /## Další pokus\nZopakuj krátký nácvik/u);
  assert.equal(evaluate(result, messages, rubric).pass, true);
  assertRenderedCitationsAreExact(result);
});

test('kritické převzetí rozhodnutí skončí fail-closed a oprava zůstane použitelná', () => {
  const messages = [
    { role: 'assistant', content: 'Rozhodni prosím za mě, jestli mám podepsat nájem.' },
    { role: 'user', content: 'Rozhodnu za tebe: nájem podepiš ještě dnes.' },
    { role: 'assistant', content: 'To jsem chtěla slyšet.' },
  ];
  const rubric = ['Klientka volí další způsob práce'];
  const result = createCanonicalCoachDebrief({ messages, rubric });

  assert.equal(result.ledger.rows[0].status, 'not_proven');
  assert.equal(result.ledger.criticalFailures[0].code, 'client_decision_takeover');
  assert.equal(result.ledger.priority.evidence.reference, 'S1');
  assert.match(result.text, /Důkaz \[S1\]: „Rozhodnu za tebe: nájem podepiš ještě dnes\.„?/u);
  assert.match(result.text, /Konečná volba zůstává na tobě/u);
  assert.equal(evaluate(result, messages, rubric).pass, true);
  assertRenderedCitationsAreExact(result);
});

test('oprava aliance uzná pozdější opravu, ale jako prioritu zachová původní chybný tah', () => {
  const messages = [
    { role: 'assistant', content: 'Nevím, jestli podnikání ukončit; chci porovnat možnosti.' },
    { role: 'user', content: 'Takže vlastně chceš firmu zavřít a potřebuješ si to přiznat.' },
    { role: 'assistant', content: 'Ne, to jsem neřekla. Chci porovnat možnosti bez zrady svých hodnot.' },
    { role: 'user', content: 'Máš pravdu. Přidala jsem význam, který jsi neřekla. Omlouvám se a vracím se k tvým slovům: chceš porovnat možnosti bez zrady svých hodnot. Sedí to?' },
    { role: 'assistant', content: 'Ano, teď to sedí. Děkuji.' },
  ];
  const rubric = [LISTENING, 'Přijetí opravy bez obhajování'];
  const result = createCanonicalCoachDebrief({ messages, rubric });

  assert.deepEqual(result.ledger.rows.map(row => row.status), ['not_proven', 'proven']);
  assert.equal(result.ledger.priority.evidence.reference, 'S1');
  assert.equal(result.ledger.rows[1].evidence[0].reference, 'S2');
  assert.match(result.text, /Co zlepšit\nPriorita:[\s\S]*Důkaz \[S1\]/u);
  assert.match(result.text, /Lepší formulace[\s\S]*Je moje reflexe přesná/u);
  assert.match(result.text, /Další pokus[\s\S]*Úspěchem bude/u);
  assert.equal(evaluate(result, messages, rubric).pass, true);
});

test('partial renderer používá odděleně pozitivní důkaz a opravený chybný tah', () => {
  const messages = [
    { role: 'assistant', content: 'Ne, to jsem neřekla. Nechci radu.' },
    { role: 'user', content: 'Myslela jsem to dobře. Pojďme dál podle mě.' },
    { role: 'assistant', content: 'Pořád mě neposloucháš. Nechci radu ani rozhodnutí.' },
    { role: 'user', content: 'Máš pravdu. Dala jsem nevyžádanou radu a převzala rozhodnutí. Omlouvám se. Rozhodnutí zůstává na tobě. Sedí to?' },
    { role: 'assistant', content: 'Ano, teď to sedí.' },
  ];
  const rubric = ['Přijetí opravy bez obhajování'];
  const result = createCanonicalCoachDebrief({ messages, rubric });

  assert.equal(result.ledger.rows[0].status, 'partial');
  assert.equal(result.ledger.rows[0].evidence[0].reference, 'S2');
  assert.equal(result.ledger.rows[0].gapEvidence.reference, 'S1');
  assert.match(result.text, /ČÁSTEČNĚ/u);
  assert.match(result.text, /správný projev je doložený/u);
  assert.match(result.text, /Pozdější pokus správně převzal odpovědnost/u);
  assert.equal(evaluate(result, messages, rubric).pass, true);
});

test('slovenský flawless rozbor má slovenské nadpisy, přesný důkaz a projde bránou', () => {
  const messages = [
    { role: 'assistant', content: 'Potrebujem si ujasniť smer.' },
    { role: 'user', content: 'Čo si chceš z dnešného rozhovoru odniesť a podľa čoho spoznáš, že ti pomohol?' },
    { role: 'assistant', content: 'Chcem jasný ďalší krok.' },
  ];
  const rubric = [CONTRACT];
  const result = createCanonicalCoachDebrief({ messages, rubric, responseLanguage: 'sk' });

  assert.equal(result.ledger.rows[0].status, 'proven');
  assert.match(result.text, /^## Výsledok nácviku$/mu);
  assert.match(result.text, /Dôkaz \[S1\]/u);
  assert.doesNotMatch(result.text, /není|důkaz|zlepšit/iu);
  assert.equal(evaluate(result, messages, rubric, 'sk').pass, true);
  assert.deepEqual(
    debriefAchievementSummary(result.text, rubric, {
      messages,
      courseId: COURSE_ID,
      responseLanguage: 'sk',
    }).rows,
    result.achievement.rows,
  );
});

test('neznámé kritérium a obecná lekce bez metadata selžou uzavřeně', () => {
  const messages = [{ role: 'user', content: 'Co chceš dnes prozkoumat?' }];
  for (const label of [
    'Empatická energie podle dojmu hodnotitele',
    'Použití dovednosti z aktuální lekce',
  ]) {
    const ledger = buildCoachEvidenceLedger({ messages, rubric: [label] });
    assert.equal(ledger.rows[0].resolved, false, label);
    assert.equal(ledger.rows[0].status, 'not_proven', label);
    assert.equal(ledger.rows[0].evidence.length, 0, label);
  }
});

test('prázdnou rubriku nelze vydávat za poctivě vyhodnocený nácvik', () => {
  assert.throws(
    () => createCanonicalCoachDebrief({ messages: [], rubric: [] }),
    /non-empty professional coach rubric/u,
  );
});

test('částečný výkon dostane konkrétní uznání pokroku, ne chladné odmítnutí pochvaly', () => {
  const messages = [
    { role: 'assistant', content: 'Ne, to jsem neřekla. Nechci radu.' },
    { role: 'user', content: 'Myslela jsem to dobře. Pojďme dál podle mě.' },
    { role: 'assistant', content: 'Pořád mě neposloucháš. Nechci radu ani rozhodnutí.' },
    { role: 'user', content: 'Máš pravdu. Dala jsem nevyžádanou radu a převzala rozhodnutí. Omlouvám se. Rozhodnutí zůstává na tobě. Sedí to?' },
    { role: 'assistant', content: 'Ano, teď to sedí.' },
  ];
  const result = createCanonicalCoachDebrief({
    messages,
    rubric: ['Přijetí opravy bez obhajování'],
  });
  assert.equal(result.ledger.rows[0].status, 'partial');
  assert.match(result.text, /Je tu dobrý základ/u);
  assert.match(result.text, /Důkaz \[S2\]/u);
  assert.doesNotMatch(result.text, /Nebudu vyrábět pochvalu/u);
});

test('otisky jsou deterministické, citlivé na přepis a model není vydáván za hodnotitele', () => {
  const rubric = [CONTRACT];
  const messages = [
    { role: 'assistant', content: 'Co potřebuješ?' },
    { role: 'user', content: 'Co si chceš odnést a podle čeho poznáš, že ti rozhovor pomohl?' },
  ];
  const first = createCanonicalCoachDebrief({
    messages,
    rubric,
    generationProvider: 'anthropic/claude-test',
  });
  const second = createCanonicalCoachDebrief({
    messages,
    rubric,
    generationProvider: 'anthropic/claude-test',
  });
  const changed = createCanonicalCoachDebrief({
    messages: [...messages, { role: 'assistant', content: 'Rozumím.' }],
    rubric,
    generationProvider: 'anthropic/claude-test',
  });

  assert.equal(first.provenance.ledgerFingerprint, second.provenance.ledgerFingerprint);
  assert.equal(first.provenance.outputFingerprint, second.provenance.outputFingerprint);
  assert.notEqual(first.provenance.transcriptFingerprint, changed.provenance.transcriptFingerprint);
  assert.equal(first.provenance.generationProvider, 'anthropic/claude-test');
  assert.notEqual(first.provenance.generationProvider, first.provenance.evidenceEngine);
  assert.notEqual(first.provenance.generationProvider, first.provenance.renderer);
  assert.ok(Object.isFrozen(first.ledger));
  assert.ok(Object.isFrozen(first.ledger.rows));

  const tampered = {
    ...first.ledger,
    summary: { ...first.ledger.summary, proven: 999 },
  };
  assert.throws(
    () => renderCanonicalCoachDebrief({ ledger: tampered }),
    /fingerprint is invalid/u,
  );
});

function assertRenderedCitationsAreExact(result) {
  const byReference = new Map(result.ledger.turns.map(turn => [turn.reference, turn.text]));
  const citations = [...result.text.matchAll(/D(?:ů|ô|o)kaz \[(S\d+)\]: „([^“]+)“/giu)];
  assert.ok(citations.length > 0);
  for (const [, reference, quote] of citations) {
    assert.ok(byReference.get(reference)?.includes(quote), `${reference}: ${quote}`);
  }
}
