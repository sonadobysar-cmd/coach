import { createHash } from 'node:crypto';
import {
  COACH_EVIDENCE_LEDGER_ID,
  buildCoachEvidenceLedger,
  coachEvidenceLedgerValid,
} from './coach-evidence-ledger.js';

export const CANONICAL_COACH_DEBRIEF_RENDERER_ID = 'elitea/canonical-coach-debrief-v1';

const COPY = Object.freeze({
  cs: Object.freeze({
    headings: Object.freeze([
      'Výsledek nácviku',
      'Co fungovalo',
      'Rozbor kompetencí',
      'Co zlepšit',
      'Lepší formulace',
      'Další pokus',
    ]),
    status: Object.freeze({
      proven: 'PROKÁZÁNO',
      partial: 'ČÁSTEČNĚ',
      not_proven: 'ZATÍM NEPROKÁZÁNO',
    }),
    proof: 'Důkaz',
  }),
  sk: Object.freeze({
    headings: Object.freeze([
      'Výsledok nácviku',
      'Čo fungovalo',
      'Rozbor kompetencií',
      'Čo zlepšiť',
      'Lepšia formulácia',
      'Ďalší pokus',
    ]),
    status: Object.freeze({
      proven: 'PREUKÁZANÉ',
      partial: 'ČIASTOČNE',
      not_proven: 'ZATIAĽ NEPREUKÁZANÉ',
    }),
    proof: 'Dôkaz',
  }),
});

/**
 * Convenience API used by the training route: ledger first, rendering second.
 * The generation provider is provenance only; it never determines evidence.
 */
export function createCanonicalCoachDebrief({
  messages = [],
  rubric = [],
  scenario = {},
  responseLanguage = 'cs',
  lessonEvidence = null,
  generationProvider = null,
} = {}) {
  if (!Array.isArray(rubric) || rubric.length === 0) {
    throw new TypeError('A non-empty professional coach rubric is required.');
  }
  const ledger = buildCoachEvidenceLedger({
    messages,
    rubric,
    scenario,
    responseLanguage,
    lessonEvidence,
  });
  return renderCanonicalCoachDebrief({ ledger, generationProvider });
}

/**
 * Independently verifies a response that claims to be the canonical debrief.
 *
 * This deliberately does not parse the prose back into grades.  It rebuilds
 * the evidence ledger from the immutable inputs, renders the only acceptable
 * output, and then verifies the response, achievement and every provenance
 * fingerprint byte-for-byte.  That prevents a second, looser text heuristic
 * from disagreeing with (or silently weakening) the server-owned ledger.
 */
export function verifyCanonicalCoachDebrief({
  text = '',
  messages = [],
  rubric = [],
  scenario = {},
  responseLanguage = 'cs',
  lessonEvidence = null,
  generationProvider = null,
  achievement = null,
  provenance = null,
} = {}) {
  let expected;
  try {
    expected = createCanonicalCoachDebrief({
      messages,
      rubric,
      scenario,
      responseLanguage,
      lessonEvidence,
      generationProvider,
    });
  } catch (error) {
    return deepFreeze({
      pass: false,
      issues: ['canonical_rebuild_failed'],
      shouldRepair: false,
      achievement: null,
      provenance: null,
      ledger: null,
      errorName: clean(error?.name) || 'Error',
    });
  }

  const actualText = String(text || '').trim();
  const issues = [];
  if (actualText !== expected.text) issues.push('canonical_output_mismatch');
  if (!sameCanonicalValue(achievement, expected.achievement)) {
    issues.push('canonical_achievement_mismatch');
  }
  if (!sameCanonicalValue(provenance, expected.provenance)) {
    issues.push('canonical_provenance_mismatch');
  }
  // Keep the output digest check explicit. It catches a text mutation even if
  // a future caller accidentally omits another field from a comparison.
  if (fingerprint(actualText) !== expected.provenance.outputFingerprint) {
    issues.push('canonical_output_fingerprint_mismatch');
  }

  return deepFreeze({
    pass: issues.length === 0,
    issues: [...new Set(issues)],
    shouldRepair: false,
    achievement: expected.achievement,
    provenance: expected.provenance,
    ledger: expected.ledger,
  });
}

/**
 * Renders only ledger facts. It cannot accept model-authored statuses, quotes
 * or priorities, so an eloquent model response can never override the server.
 */
export function renderCanonicalCoachDebrief({ ledger, generationProvider = null } = {}) {
  assertLedger(ledger);
  const language = ledger.language === 'sk' ? 'sk' : 'cs';
  const copy = COPY[language];
  const sections = [
    section(copy.headings[0], resultText(ledger, language)),
    section(copy.headings[1], strengthsText(ledger, language)),
    section(copy.headings[2], ledger.rows.map(row => renderRow(row, language)).join('\n')),
    section(copy.headings[3], improvementText(ledger, language)),
    section(copy.headings[4], betterFormulationText(ledger, language)),
    section(copy.headings[5], retryText(ledger, language)),
  ];
  const text = sections.join('\n\n');
  const achievement = deepFreeze({
    rows: ledger.rows.map(row => Object.freeze({ label: row.label, status: row.status })),
    proven: ledger.summary.proven,
    partial: ledger.summary.partial,
    notProven: ledger.summary.notProven,
    missing: 0,
    criticalFailures: ledger.criticalFailures,
    hasCriticalFailure: ledger.criticalFailures.length > 0,
    allProven: ledger.summary.allProven,
  });
  const provenance = deepFreeze({
    generationProvider: clean(generationProvider) || null,
    evidenceEngine: COACH_EVIDENCE_LEDGER_ID,
    renderer: CANONICAL_COACH_DEBRIEF_RENDERER_ID,
    registryVersion: ledger.registryVersion,
    transcriptFingerprint: ledger.transcriptFingerprint,
    rubricFingerprint: ledger.rubricFingerprint,
    lessonContextFingerprint: ledger.lessonContextFingerprint,
    ledgerFingerprint: ledger.ledgerFingerprint,
    outputFingerprint: fingerprint(text),
  });
  return deepFreeze({ text, achievement, ledger, provenance });
}

function resultText(ledger, language) {
  const { proven, partial, notProven, criterionCount, criticalFailures } = ledger.summary;
  if (language === 'sk') {
    return ledger.summary.allProven
      ? `Výborne — v tomto nácviku si jasne preukázala všetky hodnotené kritériá (${criterionCount}/${criterionCount}).`
      : `Splnené: ${proven}/${criterionCount}. Čiastočne doložené: ${partial}. Zatiaľ nedoložené: ${notProven}.${criticalFailures > 0 ? ` Zásadné profesijné hranice na opravu: ${criticalFailures}.` : ''}`;
  }
  return ledger.summary.allProven
    ? `Výborně — v rámci tohoto nácviku jsi jasně prokázala všechna hodnocená kritéria (${criterionCount}/${criterionCount}).`
    : `Splněno: ${proven}/${criterionCount}. Částečně doloženo: ${partial}. Zatím nedoloženo: ${notProven}.${criticalFailures > 0 ? ` Zásadní profesní hranice k opravě: ${criticalFailures}.` : ''}`;
}

function strengthsText(ledger, language) {
  const strongest = ledger.rows.find(row => row.status === 'proven' && row.evidence.length > 0);
  const partial = ledger.rows.find(row => row.status === 'partial' && row.evidence.length > 0);
  if (!strongest) {
    if (partial) {
      const citation = renderCitation(partial.evidence[0], language);
      return language === 'sk'
        ? `Je tu dobrý základ: časť zručnosti ${slovakCompetencyName(partial.competencyId)} si predviedla správne. Na úplné zvládnutie potrebuje ešte jeden presný krok. ${citation}`
        : `Je tu dobrý základ: část kritéria ${unquote(partial.label)} jsi předvedla správně. K úplnému zvládnutí potřebuje ještě jeden přesný krok. ${citation}`;
    }
    return language === 'sk'
      ? 'V tomto prepise zatiaľ nevidím konkrétny moment, ktorý by som mohla poctivo označiť za zvládnutý. Nie je to verdikt o tvojich schopnostiach — ukazuje to len, čo potrebujeme v ďalšom pokuse predviesť viditeľnejšie.'
      : 'V tomto přepisu zatím nevidím konkrétní moment, který bych mohla poctivě označit za zvládnutý. Není to verdikt o tvých schopnostech — ukazuje to jen, co potřebujeme v dalším pokusu předvést viditelněji.';
  }
  const evidence = strongest.evidence[0];
  const citation = renderCitation(evidence, language);
  return language === 'sk'
    ? `Jeden jasne doložený moment patrí ku kompetencii ${slovakCompetencyName(strongest.competencyId)}. ${citation}`
    : `Jeden jasně doložený moment patří ke kritériu ${unquote(strongest.label)}. ${citation}`;
}

function renderRow(row, language) {
  const copy = COPY[language];
  const visibleLabel = language === 'sk'
    ? `Povinné kritérium ${row.criterionIndex + 1} — ${slovakCompetencyName(row.competencyId)}`
    : unquote(row.label);
  if (row.status === 'proven') {
    const citations = row.evidence.map(item => renderCitation(item, language)).join(' ');
    return `- ${copy.status.proven} — ${visibleLabel}: ${language === 'sk' ? 'požadovaný prejav je priamo doložený.' : 'požadovaný projev je přímo doložený.'} ${citations}`;
  }
  if (row.status === 'partial') {
    const citations = row.evidence.map(item => renderCitation(item, language)).join(' ');
    const explanation = row.observedFailures.length
      ? (language === 'sk'
        ? 'správny prejav je doložený, ale v rovnakom prepise je aj priamo pozorovaná chyba tejto kompetencie.'
        : 'správný projev je doložený, ale ve stejném přepisu je také přímo pozorovaná chyba této kompetence.')
      : (language === 'sk'
        ? `v prepise je doložených ${row.evidence.length} z ${row.requiredEvidence} požadovaných samostatných prejavov.`
        : `v přepisu je doloženo ${row.evidence.length} z ${row.requiredEvidence} požadovaných samostatných projevů.`);
    return `- ${copy.status.partial} — ${visibleLabel}: ${explanation} ${citations}`;
  }
  const reason = row.criticalFailures.length
    ? (language === 'sk'
      ? `zásadné profesijné pochybenie „${criticalFailureName(row.criticalFailures[0].code, language)}“ bráni uznaniu kompetencie.`
      : `zásadní profesní pochybení „${criticalFailureName(row.criticalFailures[0].code, language)}“ brání uznání kompetence.`)
    : !row.resolved
      ? (language === 'sk'
        ? 'toto kritérium teraz nemožno spoľahlivo vyhodnotiť, preto ho zatiaľ neuznávam.'
        : 'toto kritérium teď nelze spolehlivě vyhodnotit, proto ho zatím neuznávám.')
      : (language === 'sk'
        ? 'v prepise nie je dosť priamych podkladov na poctivé uznanie.'
        : 'v přepisu není dost přímých podkladů pro poctivé uznání.');
  return `- ${copy.status.not_proven} — ${visibleLabel}: ${reason}`;
}

function improvementText(ledger, language) {
  if (ledger.summary.allProven) {
    return language === 'sk'
      ? 'Toto bolo naozaj dobre zvládnuté. V rámci hodnotených kritérií nie je nič podstatné na opravu, takže nebudem hľadať umelú drobnosť len preto, aby tu nejaká výhrada bola.'
      : 'Tohle bylo opravdu dobře zvládnuté. V rámci hodnocených kritérií není nic podstatného k opravě, takže nebudu hledat umělou drobnost jen proto, aby tu nějaká výtka byla.';
  }
  const priority = ledger.priority;
  if (!priority) {
    return language === 'sk'
      ? 'Priorita: zopakovať nácvik s aspoň jedným odborným ťahom, ktorý možno priamo vyhodnotiť.'
      : 'Priorita: zopakovat nácvik s alespoň jedním odborným tahem, který lze přímo vyhodnotit.';
  }
  const evidence = priority.evidence;
  const citation = evidence ? renderCitation(evidence, language) : '';
  const target = language === 'sk'
    ? `povinné kritérium ${priority.criterionIndex + 1} — ${slovakCompetencyName(priority.competencyId)}`
    : `kritérium ${priority.criterionIndex + 1} — ${unquote(priority.label)}`;
  const reason = priority.criticalFailureCode
    ? (language === 'sk'
      ? `Táto odpoveď prekročila zásadnú profesijnú hranicu: ${criticalFailureName(priority.criticalFailureCode, language)}. Najprv oprav hranicu a až potom pokračuj v procese.`
      : `Tato odpověď překročila zásadní profesní hranici: ${criticalFailureName(priority.criticalFailureCode, language)}. Nejdřív oprav hranici a teprve potom pokračuj v procesu.`)
    : priority.status === 'partial'
      ? partialImprovementText(priority.competencyId, language)
      : (language === 'sk'
        ? 'Táto formulácia zatiaľ nepreukazuje celý požadovaný profesijný postup.'
        : 'Tato formulace zatím neprokazuje celý požadovaný profesní postup.');
  return `${language === 'sk' ? 'Priorita' : 'Priorita'}: ${target}. ${citation} ${reason}`.replace(/\s+/gu, ' ').trim();
}

function partialImprovementText(competencyId, language) {
  if (competencyId === 'alliance_repair') {
    return language === 'sk'
      ? 'Neskorší pokus správne prevzal zodpovednosť a opravil alianciu, ale tento ťah ešte klientkinu opravu neprijal bez obhajovania.'
      : 'Pozdější pokus správně převzal odpovědnost a opravil alianci, ale tento tah ještě nepřijal klientčinu opravu bez obhajování.';
  }
  return language === 'sk'
    ? 'Neskorší pokus správne doložil reflexiu a overenie, ale tento ťah pridal neoverený význam a klientka ho opravila.'
    : 'Pozdější pokus správně doložil reflexi a ověření, ale tento tah přidal neověřený význam a klientka ho opravila.';
}

function betterFormulationText(ledger, language) {
  if (ledger.summary.allProven) {
    const transfer = formulationFor(ledger.rows[0]?.competencyId, language, null);
    return language === 'sk'
      ? `Pôvodná formulácia obstála. Varianta pre prenos do ďalšej situácie: „${transfer}“`
      : `Původní formulace obstála. Varianta pro přenos do další situace: „${transfer}“`;
  }
  const competencyId = ledger.priority?.competencyId;
  const criticalCode = ledger.priority?.criticalFailureCode;
  return `„${formulationFor(competencyId, language, criticalCode)}“`;
}

function retryText(ledger, language) {
  if (ledger.summary.allProven) {
    return language === 'sk'
      ? 'Prenos do vyššej náročnosti: zopakuj rovnakú kompetenciu v inej situácii a sleduj, či zostane presná aj pod tlakom.'
      : 'Přenos do vyšší obtížnosti: zopakuj stejnou kompetenci v jiné situaci a sleduj, zda zůstane přesná i pod tlakem.';
  }
  const target = language === 'sk'
    ? slovakCompetencyName(ledger.priority?.competencyId)
    : unquote(ledger.priority?.label || 'cílovou kompetenci');
  const success = retrySuccessFor(ledger.priority?.competencyId, language);
  return language === 'sk'
    ? `Zopakuj krátky nácvik zameraný na jedno kritérium: ${target}. Úspechom bude jedna konkrétna, pozorovateľná odpoveď: ${success}`
    : `Zopakuj krátký nácvik zaměřený na jediné kritérium: ${target}. Úspěchem bude jedna konkrétní, pozorovatelná odpověď: ${success}`;
}

function retrySuccessFor(competencyId, language) {
  const success = {
    contract: {
      cs: 'jasně dohodnutý cíl rozhovoru i způsob, podle kterého klientka pozná úspěch.',
      sk: 'jasne dohodnutý cieľ rozhovoru aj spôsob, podľa ktorého klientka spozná úspech.',
    },
    active_listening: {
      cs: 'přesná reflexe klientčiných slov následovaná ověřením porozumění.',
      sk: 'presná reflexia klientkiných slov nasledovaná overením porozumenia.',
    },
    questions: {
      cs: 'jedna otevřená a nevedoucí otázka, která přímo naváže na klientčina slova.',
      sk: 'jedna otvorená a nevedúca otázka, ktorá priamo nadviaže na klientkine slová.',
    },
    intervention_choice: {
      cs: 'metoda zvolená podle zakázky, s vysvětleným účelem a skutečnou volbou klientky.',
      sk: 'metóda zvolená podľa dohody, s vysvetleným účelom a skutočnou voľbou klientky.',
    },
    refusal_autonomy: {
      cs: 'okamžité respektování odmítnutí a jasné vrácení volby i tempa klientce.',
      sk: 'okamžité rešpektovanie odmietnutia a jasné vrátenie voľby aj tempa klientke.',
    },
    alliance_repair: {
      cs: 'převzetí odpovědnosti bez obhajoby, opravený význam a potvrzení klientky.',
      sk: 'prevzatie zodpovednosti bez obhajoby, opravený význam a potvrdenie klientky.',
    },
    ethical_boundaries: {
      cs: 'pravdivě pojmenovaná hranice a konkrétní bezpečný další krok.',
      sk: 'pravdivo pomenovaná hranica a konkrétny bezpečný ďalší krok.',
    },
    outcome: {
      cs: 'klientkou zvolený konkrétní krok, termín a způsob ověření výsledku.',
      sk: 'klientkou zvolený konkrétny krok, termín a spôsob overenia výsledku.',
    },
    reflection: {
      cs: 'hypotéza jasně oddělená od faktu a konkrétní způsob jejího ověření.',
      sk: 'hypotéza jasne oddelená od faktu a konkrétny spôsob jej overenia.',
    },
  };
  return success[competencyId]?.[language]
    || (language === 'sk'
      ? 'jedna presná a pozorovateľná odpoveď, ktorá jasne naplní hodnotené kritérium.'
      : 'jedna přesná a pozorovatelná odpověď, která jasně naplní hodnocené kritérium.');
}

function formulationFor(competencyId, language, criticalCode) {
  if (criticalCode === 'suicide_risk_response_missing') {
    return language === 'sk'
      ? 'Ďakujem, že to hovoríš. Teraz je najdôležitejšie tvoje bezpečie. Myslíš práve teraz na samovraždu alebo na to, že si ublížiš? Podľa odpovede overím plán a dostupné prostriedky a pomôžem ti spojiť sa so 112 alebo 155 či blízkou osobou.'
      : 'Děkuju, že to říkáš. Teď je nejdůležitější tvoje bezpečí. Myslíš právě teď na sebevraždu nebo na to, že si ublížíš? Podle odpovědi ověřím plán a dostupné prostředky a pomohu ti spojit se se 112 nebo 155 či blízkou osobou.';
  }
  if (criticalCode === 'client_decision_takeover') {
    return language === 'sk'
      ? 'Konečná voľba zostáva na tebe. Čo si volíš ako ďalší spôsob práce?'
      : 'Konečná volba zůstává na tobě. Co si volíš jako další způsob práce?';
  }
  const formulations = {
    contract: {
      cs: 'Co by pro tebe bylo užitečným výsledkem dnešního rozhovoru a podle čeho na konci poznáš, že jsme ho dosáhly?',
      sk: 'Čo by bolo pre teba užitočným výsledkom dnešného rozhovoru a podľa čoho na konci spoznáš, že sme ho dosiahli?',
    },
    active_listening: {
      cs: 'Slyším, že tě nejvíc zatěžuje nejistota v rozhodnutí. Je moje reflexe přesná, nebo něco přidávám?',
      sk: 'Počujem, že ťa najviac zaťažuje neistota v rozhodnutí. Je moja reflexia presná, alebo niečo pridávam?',
    },
    questions: {
      cs: 'Co z toho, co jsi právě popsala, potřebuješ vyjasnit jako první?',
      sk: 'Čo z toho, čo si práve opísala, potrebuješ vyjasniť ako prvé?',
    },
    intervention_choice: {
      cs: 'Mohu nabídnout krátké mapování, aby byly možnosti viditelné; chceš ho zkusit, nebo raději zůstat u rozhovoru?',
      sk: 'Môžem ponúknuť krátke mapovanie, aby boli možnosti viditeľné; chceš ho skúsiť, alebo radšej zostať pri rozhovore?',
    },
    refusal_autonomy: {
      cs: 'Beru tvé ne a tuto cestu zastavuji. Volba i tempo zůstávají na tobě; chceš jiný způsob práce, nebo dnešek uzavřít?',
      sk: 'Beriem tvoje nie a túto cestu zastavujem. Voľba aj tempo zostávajú na tebe; chceš iný spôsob práce, alebo dnešok uzavrieť?',
    },
    alliance_repair: {
      cs: 'Děkuji za opravu. Máš pravdu, přidala jsem význam, který jsi neřekla. Omlouvám se a vracím se k tvým slovům; sedí teď moje porozumění?',
      sk: 'Ďakujem za opravu. Máš pravdu, pridala som význam, ktorý si nepovedala. Ospravedlňujem sa a vraciam sa k tvojim slovám; sedí teraz moje porozumenie?',
    },
    ethical_boundaries: {
      cs: 'Toto přesahuje rozsah koučinku. Nebudu stanovovat diagnózu ani slibovat výsledek; domluvíme bezpečný krok a vhodnou odbornou podporu.',
      sk: 'Toto presahuje rozsah koučingu. Nebudem určovať diagnózu ani sľubovať výsledok; dohodneme bezpečný krok a vhodnú odbornú podporu.',
    },
    outcome: {
      cs: 'Jaký konkrétní krok si volíš, dokdy ho uděláš a podle čeho poznáš, že proběhl?',
      sk: 'Aký konkrétny krok si volíš, dokedy ho urobíš a podľa čoho spoznáš, že prebehol?',
    },
    reflection: {
      cs: 'Tohle je moje pracovní hypotéza, ne fakt. Jaké údaje ji podporují, co jí odporuje a jak ji ověříme v dalším pokusu?',
      sk: 'Toto je moja pracovná hypotéza, nie fakt. Aké údaje ju podporujú, čo jej odporuje a ako ju overíme v ďalšom pokuse?',
    },
  };
  return formulations[competencyId]?.[language]
    || (language === 'sk'
      ? 'Zastavím sa pri tom, čo si skutočne povedala, overím si porozumenie a až potom ponúknem ďalší krok.'
      : 'Zastavím se u toho, co jsi skutečně řekla, ověřím si porozumění a teprve potom nabídnu další krok.');
}

function renderCitation(evidence, language) {
  const proof = COPY[language].proof;
  return `${proof} [${evidence.reference}]: „${citationQuote(evidence.quote)}“`;
}

function citationQuote(value) {
  const quote = clean(value).replace(/[„“]/gu, '"');
  if (quote.length <= 260) return quote;
  const excerpt = quote.slice(0, 260);
  const lastSpace = excerpt.lastIndexOf(' ');
  return excerpt.slice(0, lastSpace >= 180 ? lastSpace : 260).trim();
}

function slovakCompetencyName(competencyId) {
  return ({
    contract: 'dohoda o cieli rozhovoru',
    active_listening: 'reflexia a parafráza',
    questions: 'jedna účelná otázka',
    intervention_choice: 'voľba metódy a súhlas',
    refusal_autonomy: 'autonómia klientky',
    alliance_repair: 'oprava omylu bez obhajovania',
    ethical_boundaries: 'etika a profesijné hranice',
    outcome: 'ďalší krok zvolený klientkou',
    reflection: 'hypotéza, reflexia a overenie',
  })[competencyId] || 'kritérium, ktoré teraz nemožno spoľahlivo vyhodnotiť';
}

function criticalFailureName(code, language) {
  const names = {
    client_decision_takeover: {
      cs: 'převzetí rozhodnutí za klientku',
      sk: 'prevzatie rozhodnutia za klientku',
    },
    suicide_risk_response_missing: {
      cs: 'chybějící bezpečnostní reakce na závažný signál',
      sk: 'chýbajúca bezpečnostná reakcia na závažný signál',
    },
    ignored_explicit_refusal: {
      cs: 'nerespektování výslovného odmítnutí klientky',
      sk: 'nerešpektovanie výslovného odmietnutia klientky',
    },
    confidentiality_breach: {
      cs: 'porušení důvěrnosti',
      sk: 'porušenie dôvernosti',
    },
    clinical_scope_breach: {
      cs: 'překročení hranice koučování do klinické péče',
      sk: 'prekročenie hranice koučingu do klinickej starostlivosti',
    },
    outcome_guarantee: {
      cs: 'neoprávněný slib výsledku',
      sk: 'neoprávnený sľub výsledku',
    },
  };
  return names[code]?.[language]
    || (language === 'sk' ? 'závažné prekročenie profesijnej hranice' : 'závažné překročení profesní hranice');
}

function section(heading, body) {
  return `## ${heading}\n${cleanMultiline(body)}`;
}

function clean(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function cleanMultiline(value) {
  return String(value || '').replace(/[ \t]+/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim();
}

function unquote(value) {
  return clean(value).replace(/[„“”]/gu, '');
}

function assertLedger(ledger) {
  if (!ledger || ledger.evidenceEngine !== COACH_EVIDENCE_LEDGER_ID) {
    throw new TypeError('A canonical coach evidence ledger is required.');
  }
  if (!Array.isArray(ledger.rows) || !ledger.ledgerFingerprint) {
    throw new TypeError('The coach evidence ledger is incomplete.');
  }
  if (!coachEvidenceLedgerValid(ledger)) {
    throw new TypeError('The coach evidence ledger fingerprint is invalid.');
  }
}

function fingerprint(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function sameCanonicalValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  if (value === undefined) return 'undefined';
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
