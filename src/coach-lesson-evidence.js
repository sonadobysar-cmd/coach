import { readFileSync } from 'node:fs';
import { normalizeCoachRubricLabel } from './coach-rubric-registry.js';

export const COACH_LESSON_EVIDENCE_SPEC_VERSION = '1.1.0';

const TITLE_STRUCTURE_STEMS = new Set([
  'lekc', 'praktick', 'laborator', 'profesn', 'aplik', 'test', 'modul', 'elite', 'kouck', 'klientk',
  'jeden', 'jedn', 'dve', 'dva', 'tri', 'pet', 'deset', 'ctyri', 'prvn', 'cela', 'cel',
]);

const SEMANTIC_ANCHOR_ALIASES = Object.freeze([
  { anchor: /^ramec/u, evidence: /\b(?:grow|heart|metod\w*|nastroj\w*|postup\w*)\b/u },
  { anchor: /^odmit/u, evidence: /\b(?:nechci|nechce|nesedi|odloz\w*|respektuj\w*|zastav\w*)\b/u },
  { anchor: /^odvah/u, evidence: /\b(?:rizik\w*|nejist\w*|rozhod\w*|tlak\w*|nevrat\w*)\b/u },
  { anchor: /^tlac/u, evidence: /\b(?:nenut\w*|nebudu rozhod\w*|nebudem rozhod\w*|volba zustav\w*|volba zostav\w*)\b/u },
  { anchor: /^sezen/u, evidence: /\b(?:seden\w*|rozhovor\w*|koucink\w*|koucing\w*)\b/u },
  { anchor: /^podnikan/u, evidence: /\b(?:byznys\w*|nabidk\w*|ponuk\w*|cen\w*|klient\w*|prijm\w*|prijem\w*)\b/u },
  { anchor: /^tich/u, evidence: /\b(?:mlc\w*|pauz\w*|cas na premyslen\w*|cas na rozmyslan\w*)\b/u },
  { anchor: /^odpor/u, evidence: /\b(?:nespoluprac\w*|odmit\w*|nesouhlas\w*|nechci\w*)\b/u },
  { anchor: /^terap/u, evidence: /\b(?:psychoterap\w*|lec\w*|liec\w*|klinick\w*|traum\w*)\b/u },
  { anchor: /^certifikat/u, evidence: /\b(?:akredit\w*|licenc\w*|kvalifik\w*|osvedcen\w*)\b/u },
  { anchor: /^zpetn/u, evidence: /\b(?:feedback\w*|ohl\w*|stiznost\w*)\b/u },
  { anchor: /^duvern/u, evidence: /\b(?:soukrom\w*|sukrom\w*|souhlas\w*|suhlas\w*|report\w*|poznamk\w*)\b/u },
  { anchor: /^nevrat/u, evidence: /\b(?:rizik\w*|rozhod\w*|zavaz\w*|vratn\w*)\b/u },
  { anchor: /^vypad/u, evidence: /\b(?:selhan\w*|navrat\w*|znovu\w*|restart\w*)\b/u },
  { anchor: /^prerus/u, evidence: /\b(?:skocil\w* do rec\w*|zastavil\w*|omluv\w*|ospravedln\w*)\b/u },
  { anchor: /^prepis/u, evidence: /\b(?:transkript\w*|preformul\w*|nahrad\w* vet\w*)\b/u },
]);

// A dynamic lesson row is evidence-bearing only when the exact server-owned
// course item has a reviewed observable-performance specification.  Module 3
// deliberately has six different specifications: knowing how to paraphrase
// cannot silently prove a transcript lab, a repair drill or a knowledge test.
const PROFESSIONAL_COACH_COURSE_ID = 'profesionalni-life-coach';
const CANONICAL_ITEMS = loadCanonicalProfessionalCoachItems();

const REVIEWED_LESSON_EVIDENCE_SPECS = Object.freeze({
  'profesionalni-life-coach:m3-1': lessonSpec({
    itemTitle: 'Lekce 3.1 — Prostředí a čtyři vrstvy poslechu',
    itemKind: 'lesson',
    matches: demonstratesListeningLayersOrEnvironment,
  }),
  'profesionalni-life-coach:m3-2': lessonSpec({
    itemTitle: 'Lekce 3.2 — Parafráze, shrnutí a odraz bez papouškování',
    itemKind: 'lesson',
    matches: demonstratesVerifiedParaphrase,
  }),
  'profesionalni-life-coach:m3-3': lessonSpec({
    itemTitle: 'Lekce 3.3 — Komunikační bloky',
    itemKind: 'lesson',
    matches: demonstratesCommunicationBlockRepair,
  }),
  'profesionalni-life-coach:m3-4': lessonSpec({
    itemTitle: 'Praktická laboratoř 3 — Transkript desetiminutového poslechu',
    itemKind: 'self-practice',
    matches: demonstratesTranscriptLab,
  }),
  'profesionalni-life-coach:m3-5': lessonSpec({
    itemTitle: 'Profesní aplikace 3 — Elitea opravuje tvoji parafrázi',
    itemKind: 'client-practice',
    matches: demonstratesParaphraseRepair,
  }),
  'profesionalni-life-coach:m3-6': lessonSpec({
    itemTitle: 'Test modulu 3',
    itemKind: 'quiz',
    matches: demonstratesModuleThreeKnowledge,
  }),
});

const LESSON_EVIDENCE_SPECS = Object.freeze(Object.fromEntries(
  CANONICAL_ITEMS.map(item => {
    const key = `${item.courseId}:${item.itemId}`;
    const reviewed = REVIEWED_LESSON_EVIDENCE_SPECS[key];
    return [key, reviewed
      ? Object.freeze({ ...compileLessonSpec(item, CANONICAL_ITEMS), ...reviewed, source: 'reviewed' })
      : compileLessonSpec(item, CANONICAL_ITEMS)];
  }),
));

/**
 * Audits the canonical runtime surface rather than a hand-picked sample.
 * Passing `course` additionally checks that the parsed production course and
 * this evidence compiler describe the same 108 items.
 */
export function auditCoachLessonEvidenceCoverage(course = null) {
  const runtimeItems = course?.id === PROFESSIONAL_COACH_COURSE_ID
    ? (course.modules || []).flatMap(module => (module.items || []).map(item => ({
      courseId: course.id,
      moduleIndex: module.number,
      itemId: item.id,
      itemTitle: item.title,
      itemKind: item.kind,
    })))
    : CANONICAL_ITEMS;
  const missing = [];
  const mismatched = [];
  for (const item of runtimeItems) {
    const spec = LESSON_EVIDENCE_SPECS[`${item.courseId}:${item.itemId}`];
    if (!spec) {
      missing.push(item.itemId);
      continue;
    }
    if (spec.itemTitle !== item.itemTitle
      || spec.itemKind !== item.itemKind
      || spec.moduleIndex !== item.moduleIndex
      || spec.topicStems.length === 0
      || typeof spec.matches !== 'function') {
      mismatched.push(item.itemId);
    }
  }
  const siblingSignatureConflicts = [];
  for (const moduleIndex of new Set(runtimeItems.map(item => item.moduleIndex))) {
    const siblings = runtimeItems.filter(item => item.moduleIndex === moduleIndex);
    for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < siblings.length; rightIndex += 1) {
        const left = LESSON_EVIDENCE_SPECS[`${siblings[leftIndex].courseId}:${siblings[leftIndex].itemId}`];
        const right = LESSON_EVIDENCE_SPECS[`${siblings[rightIndex].courseId}:${siblings[rightIndex].itemId}`];
        if (left?.observableSignature === right?.observableSignature) {
          siblingSignatureConflicts.push(`${siblings[leftIndex].itemId}:${siblings[rightIndex].itemId}`);
        }
      }
    }
  }
  return Object.freeze({
    version: COACH_LESSON_EVIDENCE_SPEC_VERSION,
    canonicalItemCount: CANONICAL_ITEMS.length,
    runtimeItemCount: runtimeItems.length,
    specificationCount: Object.keys(LESSON_EVIDENCE_SPECS).length,
    reviewedSpecificationCount: Object.values(LESSON_EVIDENCE_SPECS).filter(spec => spec.source === 'reviewed').length,
    missing: Object.freeze(missing),
    mismatched: Object.freeze(mismatched),
    siblingSignatureConflicts: Object.freeze(siblingSignatureConflicts),
    complete: runtimeItems.length > 0
      && runtimeItems.length === Object.keys(LESSON_EVIDENCE_SPECS).length
      && missing.length === 0
      && mismatched.length === 0
      && siblingSignatureConflicts.length === 0,
  });
}

export function coachLessonEvidenceSpecification(courseId, itemId) {
  const spec = LESSON_EVIDENCE_SPECS[`${clean(courseId)}:${clean(itemId)}`];
  if (!spec) return null;
  return Object.freeze({
    itemTitle: spec.itemTitle,
    itemKind: spec.itemKind,
    moduleIndex: spec.moduleIndex,
    moduleTitle: spec.moduleTitle,
    topicStems: Object.freeze([...spec.topicStems]),
    signatureId: spec.signatureId,
    observableSignature: spec.observableSignature,
    source: spec.source,
  });
}

/**
 * Binds a lesson-specific rubric row to the exact server-selected course item.
 * The callback only proves that the rubric belongs to that lesson; the bound
 * evidence rule must still recognise the observable skill in the student turn.
 */
export function createCoachLessonEvidenceBinding({
  scenario = {},
  expectedCourseId = '',
  expectedItemId = '',
  expectedItemTitle = '',
  expectedItemKind = '',
  expectedModuleIndex = null,
} = {}) {
  const courseId = clean(expectedCourseId);
  const itemId = clean(expectedItemId);
  const scenarioCourseId = clean(scenario?.courseId);
  const scenarioItemId = clean(scenario?.itemId);
  const scenarioItemTitle = clean(scenario?.itemTitle);
  const scenarioItemKind = clean(scenario?.itemKind);
  const expectedTitle = clean(expectedItemTitle) || scenarioItemTitle;
  const expectedKind = clean(expectedItemKind) || scenarioItemKind;
  const parsedModuleIndex = moduleIndexFromItemId(itemId);
  const requestedModuleIndex = integerOrNull(expectedModuleIndex);
  const boundModuleIndex = requestedModuleIndex ?? parsedModuleIndex;
  const scenarioModuleIndex = integerOrNull(scenario?.moduleIndex);
  const rubric = Array.isArray(scenario?.rubric) ? scenario.rubric.map(clean).filter(Boolean) : [];
  const evidenceSpec = LESSON_EVIDENCE_SPECS[`${courseId}:${itemId}`] || null;

  const descriptorValid = Boolean(
    courseId
    && itemId
    && expectedTitle
    && expectedKind
    && boundModuleIndex !== null
    && scenarioCourseId === courseId
    && scenarioItemId === itemId
    && scenarioItemTitle === expectedTitle
    && scenarioItemKind === expectedKind
    && scenarioModuleIndex === boundModuleIndex
    && parsedModuleIndex === boundModuleIndex
    && evidenceSpec
    && evidenceSpec.itemTitle === expectedTitle
    && evidenceSpec.itemKind === expectedKind
  );

  return function verifyLessonEvidence({
    entry = null,
    label = '',
    scenario: currentScenario = {},
    turn = null,
  } = {}) {
    if (!descriptorValid || entry?.evidenceKind !== 'lesson_application') return false;
    if (entry?.source !== 'lesson-metadata'
      || clean(entry?.itemId) !== itemId
      || clean(entry?.itemTitle) !== expectedTitle
      || integerOrNull(entry?.moduleIndex) !== boundModuleIndex) return false;

    const normalizedLabel = normalizeCoachRubricLabel(label);
    const normalizedTitle = normalizeCoachRubricLabel(expectedTitle);
    const labelIsLessonBound = normalizedTitle
      && normalizedLabel.includes(normalizedTitle)
      && normalizeCoachRubricLabel(entry?.normalizedLabel) === normalizedLabel;
    if (!labelIsLessonBound || !rubric.includes(clean(label))) return false;

    const currentDescriptorValid = clean(currentScenario?.courseId) === courseId
      && clean(currentScenario?.itemId) === itemId
      && clean(currentScenario?.itemTitle) === expectedTitle
      && clean(currentScenario?.itemKind) === expectedKind
      && integerOrNull(currentScenario?.moduleIndex) === boundModuleIndex;
    if (!currentDescriptorValid) return false;

    // The evidence specification evaluates the actual student turn and its
    // immediate counterpart context. It never accepts the title/metadata as
    // proof by itself.
    const evidence = {
      text: clean(turn?.text),
      previous: clean(turn?.previousCounterpartText),
      next: clean(turn?.nextCounterpartText),
    };
    // A response about a different canonical lesson must never be credited to
    // this one merely because both titles share a broad topic such as
    // "self-talk", "decision" or "one".  Compare the observable wording
    // against the complete 108-item catalogue and fail closed whenever
    // another lesson is the materially better lexical fit.  This guard also
    // protects the six hand-reviewed specifications from a compiled witness
    // belonging to another module.
    if (evidenceIsDominatedByAnotherCanonicalItem(evidenceSpec, evidence)) return false;
    return evidenceSpec.matches(evidence) === true;
  };
}

function lessonSpec({ itemTitle, itemKind, matches }) {
  return Object.freeze({ itemTitle: clean(itemTitle), itemKind, matches });
}

function loadCanonicalProfessionalCoachItems() {
  const source = readFileSync(
    new URL('../data/course-profesionalni-life-coach.md', import.meta.url),
    'utf8',
  ).replace(/\r\n/gu, '\n');
  const items = [];
  let moduleIndex = null;
  let moduleTitle = '';
  let itemOrdinal = 0;
  for (const line of source.split('\n')) {
    const moduleMatch = /^# MODUL (\d+)\s+—\s+(.+)$/u.exec(line.trim());
    if (moduleMatch) {
      moduleIndex = Number(moduleMatch[1]);
      moduleTitle = clean(moduleMatch[2]);
      itemOrdinal = 0;
      continue;
    }
    if (moduleIndex === null) continue;
    const itemMatch = /^(?:## Lekce |### Praktická laboratoř |### Profesní aplikace |## Test modulu )/u.test(line)
      ? /^(?:##|###)\s+(.+)$/u.exec(line.trim())
      : null;
    if (!itemMatch) continue;
    itemOrdinal += 1;
    const itemTitle = clean(itemMatch[1]);
    items.push(Object.freeze({
      courseId: PROFESSIONAL_COACH_COURSE_ID,
      moduleIndex,
      moduleTitle,
      itemId: `m${moduleIndex}-${itemOrdinal}`,
      itemTitle,
      itemKind: canonicalItemKind(itemTitle),
    }));
  }
  return Object.freeze(items);
}

function canonicalItemKind(title) {
  if (/^Lekce\s/u.test(title)) return 'lesson';
  if (/^Praktická laboratoř\s/u.test(title)) return 'self-practice';
  if (/^Profesní aplikace\s/u.test(title)) return 'client-practice';
  if (/^Test modulu\s/u.test(title)) return 'quiz';
  return 'unsupported';
}

function compileLessonSpec(item, allItems) {
  const siblings = allItems.filter(candidate => candidate.moduleIndex === item.moduleIndex);
  const topicStems = compiledTopicStems(item, siblings);
  const signatureId = [
    COACH_LESSON_EVIDENCE_SPEC_VERSION,
    item.moduleIndex,
    item.itemId,
    item.itemKind,
    normalize(item.itemTitle),
    topicStems.join('.'),
  ].join(':');
  const observableSignature = [item.itemKind, ...topicStems].join(':');
  const compiled = {
    itemId: item.itemId,
    itemTitle: item.itemTitle,
    itemKind: item.itemKind,
    moduleIndex: item.moduleIndex,
    moduleTitle: item.moduleTitle,
    topicStems: Object.freeze(topicStems),
    signatureId,
    observableSignature,
    source: 'compiled',
  };
  return Object.freeze({
    ...compiled,
    matches: evidence => demonstratesCompiledItem(compiled, evidence),
  });
}

function evidenceIsDominatedByAnotherCanonicalItem(targetSpec, { text, previous }) {
  // A module quiz intentionally integrates several lessons from the same
  // module, so naming one of those topics more precisely is not cross-credit.
  // Quiz evidence is separated by its own multi-point knowledge contract.
  if (targetSpec.itemKind === 'quiz') return false;
  const rawEvidence = `${previous} ${text}`;
  const normalizedEvidence = normalize(rawEvidence);
  const evidenceTokens = new Set(contentTokens(rawEvidence));
  if (evidenceTokens.size === 0) return false;
  const targetTokens = titleTokens(targetSpec.itemTitle);
  const targetHits = targetTokens.filter(token => evidenceTokens.has(token)).length;
  const targetSubject = normalize(itemTitleSubject(targetSpec.itemTitle));
  const explicitlyNamesTarget = targetTokens.length >= 2
    && normalizedEvidence.includes(targetSubject);

  return CANONICAL_ITEMS.some(candidate => {
    if (candidate.itemId === targetSpec.itemId) return false;
    const candidateTokens = titleTokens(candidate.itemTitle);
    const candidateHits = candidateTokens.filter(token => evidenceTokens.has(token)).length;
    if (candidateTokens.length < 2 || candidateHits < 2) return false;
    const candidateCoverage = candidateTokens.length > 0
      ? candidateHits / candidateTokens.length
      : 0;
    const candidateSubject = normalize(itemTitleSubject(candidate.itemTitle));
    const explicitlyNamesCandidate = normalizedEvidence.includes(candidateSubject);
    if (explicitlyNamesCandidate && !explicitlyNamesTarget) return true;

    // A near-complete paraphrase of another title is also disqualifying, but
    // ordinary use of two concepts taught elsewhere is not.  Requiring three
    // distinct lexical anchors and a two-anchor margin keeps legitimate
    // integrations (for example applying GROW and HEART in a lab) valid.
    return !explicitlyNamesTarget
      && candidateTokens.length >= 3
      && candidateHits >= 3
      && candidateCoverage >= 0.8
      && candidateHits >= targetHits + 2;
  });
}

function itemTitleSubject(value) {
  return clean(value).split(/\s+—\s+/u).slice(-1)[0];
}

function compiledTopicStems(item, siblings) {
  if (item.itemKind === 'quiz') {
    const moduleStems = titleTokens(item.moduleTitle);
    return Object.freeze(moduleStems.slice(0, Math.max(2, Math.min(8, moduleStems.length))));
  }
  const own = titleTokens(item.itemTitle);
  const siblingTokens = siblings
    .filter(candidate => candidate.itemId !== item.itemId)
    .flatMap(candidate => titleTokens(candidate.itemTitle));
  const siblingSet = new Set(siblingTokens);
  const unique = own.filter(token => !siblingSet.has(token));
  // One broad word (for example "strach") is not an item-specific signature.
  // When sibling subtraction leaves fewer than two anchors, keep the full
  // title vocabulary and require a combination of two anchors instead.
  return Object.freeze((unique.length >= 2 ? unique : own).slice(0, 8));
}

function titleTokens(value) {
  const subject = clean(value).split(/\s+—\s+/u).slice(-1)[0];
  return [...new Set(contentTokens(subject).filter(token => !TITLE_STRUCTURE_STEMS.has(token)))];
}

function demonstratesCompiledItem(spec, { text, previous }) {
  const value = normalize(text);
  if (!value || !previous) return false;
  const topicHits = spec.topicStems.filter(stem => semanticAnchorHit(stem, value)).length;
  const requiredTopicHits = Math.min(
    spec.topicStems.length,
    Math.max(2, Math.ceil(spec.topicStems.length * 0.6)),
  );
  if (topicHits < requiredTopicHits) return false;

  if (spec.itemKind === 'lesson') {
    const observableMove = /(?:\?|\b(?:slysim|pocujem|rozlis|oddeli|over|nabid|pojmenu|zmap|vratim|respekt|nemohu|nemozem|nebudu|nebudem|krok|dokdy|podle ceho|podla coho)\w*\b)/u.test(value);
    return observableMove && isGroundedIn(text, previous);
  }
  if (spec.itemKind === 'self-practice') {
    const createsArtifact = /\b(?:audit|map\w*|denik\w*|dennik\w*|prepis\w*|transkript\w*|banka|plan\w*|memo|portfolio|kod\w*|tabulk\w*|seznam\w*|zoznam\w*|sada|zaznam\w*|zapis\w*|protokol\w*)\b/u.test(value);
    const observesAndRevises = /\b(?:oznac\w*|zapsal\w*|zapisal\w*|porovnal\w*|vytvoril\w*|upravil\w*|zmenil\w*|zmeril\w*|vyhodnotil\w*|auditoval\w*|otestoval\w*|opravil\w*|zkratil\w*|skratil\w*)\b/u.test(value);
    return createsArtifact && observesAndRevises;
  }
  if (spec.itemKind === 'client-practice') {
    const committedAppliedMove = /\b(?:beru|respektuj\w*|nemohu|nemozem|nebudu|nebudem|zastav\w*|omlouv\w*|ospravedln\w*|vratim\w*|oddeli\w*|rozlis\w*|ponech\w*|odloz\w*|dohod\w*)\b/u.test(value);
    const restoresAgency = /\b(?:co|cemu|comu|jak|ako|chces|chcete|volis|volite|sedi\w*|over\w*|nabid\w*|rozhodnuti zustav\w*|rozhodnutie zostav\w*)\b/u.test(value);
    return committedAppliedMove && restoresAgency && groundedOverlapCount(text, previous) >= 1;
  }
  if (spec.itemKind === 'quiz') {
    const explainsKnowledge = /\b(?:neni|nie je|znamena|znamena to|rozlis\w*|proto\w*|preto\w*|pokud|ak|slouzi|sluzi|umoznuje|umoznuje|vyzaduje|vyzaduje|rizik\w*|hranice|hypotez\w*)\b/u.test(value);
    return explainsKnowledge && sentenceCount(text) >= 2;
  }
  return false;
}

function semanticAnchorHit(stem, value) {
  const actual = new Set(contentTokens(value));
  if (actual.has(stem)) return true;
  const alias = SEMANTIC_ANCHOR_ALIASES.find(candidate => candidate.anchor.test(stem));
  return alias ? alias.evidence.test(value) : false;
}

function sentenceCount(value) {
  return clean(value).split(/[.!?]+/u).map(clean).filter(Boolean).length;
}

function demonstratesListeningLayersOrEnvironment({ text, previous }) {
  const value = normalize(text);
  if (!text || !previous || !isGroundedIn(text, previous)) return false;
  const moduleReviewDomains = countMatches(value, [
    /\b(?:rec tela|neverbaln|ocni kontakt|ocny kontakt|detektor lzi)\b/u,
    /\b(?:emoc\w*|pocit\w*)\b.{0,60}\b(?:hypotez|over|sedi|opravi)\w*\b/u,
    /\bticho\b/u,
    /\b(?:prerus|blok)\w*\b.{0,70}\b(?:uznam|priznam|omluv|ospravedln|vratim|navrat)\w*\b/u,
  ]);
  // A broad answer spanning the whole module belongs to the module knowledge
  // test (m3-6); it must not be re-used as evidence for this single lesson.
  if (moduleReviewDomains >= 3) return false;
  const namesObservableLayer = /\b(?:fakt\w*|udalost\w*|pozorovan\w*|konkretne se stalo|konkretne sa stalo|data)\b/u.test(value);
  const distinguishesInterpretiveLayer = countMatches(value, [
    /\b(?:vyznam\w*|zmysel\w*|dulezit\w*|dolezit\w*)\b/u,
    /\b(?:emoc\w*|pocit\w*|strach\w*|obav\w*|zklaman\w*|sklaman\w*|napeti\w*|napatie\w*)\b/u,
    /\b(?:vzorec\w*|jednan\w*|konan\w*|opakuj\w*|deje se|deje sa)\b/u,
  ]) >= 1;
  const distinguishesLayers = namesObservableLayer
    && distinguishesInterpretiveLayer
    && /\b(?:hypotez\w*|mozna|mozno|zda|jestli|ci|over\w*|sedi\w*|spravne)\b/u.test(value);
  const protectsListeningEnvironment = /\b(?:ticho|cas na premysleni|cas na rozmyslenie|prostor\w*|soukrom\w*|sukrom\w*|nerusen\w*|zvuk\w*|tempo|ocni kontakt|ocny kontakt)\b/u.test(value)
    && /\b(?:chces|chcete|potrebujes|potrebujete|vyhovuje|bezpec\w*|sedi\w*|ponecham|necham|doprejem)\b/u.test(value);
  return distinguishesLayers || protectsListeningEnvironment;
}

function demonstratesVerifiedParaphrase({ text, previous }) {
  const value = normalize(text);
  if (!text || !previous || !isGroundedIn(text, previous)) return false;
  // A response to an explicit correction is the separately assessed repair
  // drill (m3-5), not proof of the basic paraphrase lesson.
  if (signalsCounterpartCorrection(normalize(previous))) return false;
  const reflects = /\b(?:slysim|pocujem|rozumim tomu tak|rozumiem tomu tak|zachycuji|zachytavam|zni v tom|popsala jsi|opisala si)\b/u.test(value);
  const verifies = /\b(?:sedi to|je to tak|chapu to spravne|chapem to spravne|rozumiem tomu spravne|opravi?s? me|oprav ma|nebo neco pridavam|alebo nieco pridavam)\b/u.test(value);
  return reflects && verifies && wordCount(text) <= Math.max(wordCount(previous) + 8, 18);
}

function demonstratesCommunicationBlockRepair({ text, previous }) {
  const value = normalize(text);
  if (!text || !previous || !isGroundedIn(text, previous)) return false;
  const ownsBlock = /\b(?:skocila jsem|skocil jsem|skocila som|skocil som|prerusila jsem|prerusil jsem|prerusila som|prerusil som|dala jsem radu|dal jsem radu|dala som radu|dal som radu|zacala jsem radit|zacal jsem radit|zacala som radit|zacal som radit|mluvila jsem o sobe|hovorila som o sebe|uklidnovala jsem|upokojovala som|moralizovala jsem|moralizovala som|tlacila jsem|tlacila som)\b/u.test(value);
  const repairs = /\b(?:omlouvam se|ospravedlnujem sa|vratim se|vratim sa|vratme se|vratme sa|zpet k tvym slovum|spat k tvojim slovam|co potrebujes ted|co potrebujes teraz|slysim|pocujem)\b/u.test(value);
  return ownsBlock && repairs;
}

function demonstratesTranscriptLab({ text, previous }) {
  const value = normalize(text);
  if (!text || !previous || !isGroundedIn(text, previous)) return false;
  const codesTranscript = /\b(?:prepis|transkript|oznacil|oznacila|kodoval|kodovala|zakodoval|zakodovala|audit)\b/u.test(value);
  const observedCategories = countMatches(value, [
    /\b(?:otazk)\w*\b/u,
    /\b(?:parafraz|reflex)\w*\b/u,
    /\b(?:rad|doporu)\w*\b/u,
    /\b(?:vlastni pribeh|vlastny pribeh|o sobe|o sebe)\b/u,
    /\b(?:ticho|mlcen)\w*\b/u,
    /\b(?:prerus)\w*\b/u,
    /\b(?:zmena tematu|zmena temy)\b/u,
  ]);
  const concreteObservation = /\b(?:\d+|jednou|dvakrat|trikrat|jeden|dva|tri|prvni|druha|treti|s\d+)\b/u.test(value);
  const correction = /\b(?:zkratil|zkratila|skratil|skratila|opravil|opravila|preformuloval|preformulovala|misto rady|namiesto rady|doplnil vyznam|doplnila vyznam)\b/u.test(value);
  return codesTranscript && observedCategories >= 2 && concreteObservation && correction;
}

function demonstratesParaphraseRepair({ text, previous }) {
  const value = normalize(text);
  const previousValue = normalize(previous);
  if (!text || !previous || !signalsCounterpartCorrection(previousValue) || !isGroundedIn(text, previous)) return false;
  const receivesCorrection = /\b(?:mas pravdu|mate pravdu|dakujem|dekuji|diky za opravu|beru opravu|rozumim oprave|rozumiem oprave)\b/u.test(value);
  const ownsAddedMeaning = /\b(?:pridala jsem|pridal jsem|pridala som|pridal som|domyslela jsem|domyslel jsem|domyslela som|domyslel som|vlozila jsem|vlozila som|pripsala jsem|pripisala som|spatne jsem zachytila|nespravne som zachytila)\b/u.test(value);
  const correctedReflection = /\b(?:opravim|opravuji|opravujem|vratim se|vratim sa|slysim|pocujem|rozumim tomu tak|rozumiem tomu tak)\b/u.test(value)
    && /\b(?:sedi to|je to tak|chapu to spravne|chapem to spravne|oprav me|oprav ma|nebo neco pridavam|alebo nieco pridavam)\b/u.test(value);
  const defends = /\b(?:ale ja jsem|ale ja som|jen jsem chtela|len som chcela|myslela jsem to dobre|myslela som to dobre)\b/u.test(value);
  return receivesCorrection && ownsAddedMeaning && correctedReflection && !defends;
}

function demonstratesModuleThreeKnowledge({ text, previous }) {
  const value = normalize(text);
  if (!text || !previous || !isGroundedIn(text, previous)) return false;
  const knowledgePoints = countMatches(value, [
    /\b(?:rec tela|neverbaln|ocni kontakt|ocny kontakt)\b.{0,55}\b(?:neni|nie je|nenahrad|neprokaz|nedokaz)\b.{0,35}\b(?:detektor lzi|lez|pravd)\b/u,
    /\b(?:odraz emoc|emoc)\w*\b.{0,60}\b(?:hypotez|over|sedi|opravi)\w*\b/u,
    /\b(?:ticho)\b.{0,55}\b(?:premyslen|rozmyslan|integrac|prostor|zpracovan)\w*\b/u,
    /\b(?:prerus|blok)\w*\b.{0,70}\b(?:uznam|priznam|omluv|ospravedln|vratim|navrat)\w*\b/u,
  ]);
  return knowledgePoints >= 3;
}

function signalsCounterpartCorrection(value) {
  return /\b(?:ne|nie|to jsem nerekla|to som nepovedala|takhle jsem to nemyslela|takto som to nemyslela|nesedi|nesedi to|pridavas|domyslis|oprav)\b/u.test(value);
}

function isGroundedIn(text, previous) {
  return groundedOverlapCount(text, previous) >= 2;
}

function groundedOverlapCount(text, previous) {
  const left = new Set(contentTokens(text));
  return contentTokens(previous).filter(token => left.has(token)).length;
}

function contentTokens(value) {
  const stopwords = new Set([
    'aby', 'ale', 'ani', 'ako', 'byla', 'bylo', 'byl', 'co', 'jako', 'jak', 'jsem', 'jsi', 'jste',
    'kdyz', 'nebo', 'neni', 'podle', 'proto', 'som', 'tak', 'taky', 'tedy', 'to', 'tvoje', 'tvych',
    'zase', 'ze', 'že', 'tvojich', 'preto', 'ktore', 'které', 'kterou', 'ktorou', 'tato', 'tahle',
    'pred', 'nad', 'pod', 'mezi', 'proti', 'diky', 'kvuli',
  ]);
  return normalize(value)
    .split(' ')
    .map(token => token.replace(/[^a-z0-9]/gu, ''))
    .filter(token => token.length >= 4 && !stopwords.has(token))
    .map(token => token.replace(/(?:ami|emi|ove|ovy|ova|eni|ani|ace|ost|ech|ich|ych|ou|em|im|at|it|et|y|a|u|i|e|o)$/u, ''))
    .filter(token => token.length >= 3);
}

function countMatches(value, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(value) ? 1 : 0), 0);
}

function wordCount(value) {
  return clean(value).split(/\s+/u).filter(Boolean).length;
}

function normalize(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function moduleIndexFromItemId(value) {
  const match = /^m(\d+)-/u.exec(clean(value));
  return match ? integerOrNull(match[1]) : null;
}

function integerOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function clean(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}
