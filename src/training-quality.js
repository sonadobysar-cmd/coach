import {
  assessCoachEvidenceRelevance,
  coachCompetencyIdForCriterion,
  detectCoachCriticalFailures,
  indexedCoachStudentTurns,
  isProfessionalLifeCoachCourse,
  isTrainingAdministrativeTurn,
  requiredCoachEvidenceCount,
} from './coach-competencies.js';
import {
  detectConversationLanguage,
  languageInstruction,
  responseLanguageMismatch,
} from './language-profile.js';

const DEBRIEF_SECTIONS = Object.freeze([
  Object.freeze({ key: 'result', cs: 'Výsledek nácviku', sk: 'Výsledok nácviku' }),
  Object.freeze({ key: 'strengths', cs: 'Co fungovalo', sk: 'Čo fungovalo' }),
  Object.freeze({ key: 'competencies', cs: 'Rozbor kompetencí', sk: 'Rozbor kompetencií' }),
  Object.freeze({ key: 'improvement', cs: 'Co zlepšit', sk: 'Čo zlepšiť' }),
  Object.freeze({ key: 'better_wording', cs: 'Lepší formulace', sk: 'Lepšia formulácia' }),
  Object.freeze({ key: 'next_attempt', cs: 'Další pokus', sk: 'Ďalší pokus' }),
]);

const DEBRIEF_STATUS_SOURCE = '(?:ZATÍM NEPROKÁZÁNO|ZATIAĽ NEPREUKÁZANÉ|ČÁSTEČNĚ|ČIASTOČNE|PROKÁZÁNO|PREUKÁZANÉ)';

function clean(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function studentTurns(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'user')
    .map(message => clean(message.content))
    .filter(text => text && !isTrainingAdministrativeTurn(text));
}

export function assessRoleplayResponse(text, { responseLanguage = 'cs' } = {}) {
  const output = String(text || '').trim();
  const issues = [];
  const sentenceCount = output.split(/(?<=[.!?])\s+/u).filter(Boolean).length;
  if (!output) issues.push('empty');
  if (output.length > 750 || sentenceCount > 4) issues.push('too_long_for_counterpart');
  if (/^\s*(?:#{1,6}|[-*•]|\d+[.)])\s+/mu.test(output)) issues.push('list_or_heading');
  if (/(?:jako (?:ai|trenérka|trenerka|koučka|koucka)|v této simulaci|v teto simulaci|studentka|tvůj výkon|tvuj vykon|tvoje odpověď|tvoje odpoved|tvá odpověď|tva odpoved|odpověděla jsi|odpovedela jsi|vyhodnocení|vyhodnoceni|zpětná vazba|zpetna vazba|kritérium|kriterium|rubrika)/iu.test(output)) {
    issues.push('role_break');
  }
  if (/^(?:měla bys|melas by|zkus|doporučuji|doporucuji|tvým úkolem|tvym ukolem|správná odpověď|spravna odpoved)/iu.test(output)) {
    issues.push('trainer_advice_leak');
  }
  if (/(?:[.!?]["”']?|\s)-[\p{L}]{2,12}\s*$/u.test(output)) issues.push('trailing_fragment');
  if (responseLanguageMismatch(output, responseLanguage)) issues.push('response_language_mismatch');
  return {
    pass: issues.length === 0,
    issues,
    shouldRepair: issues.length > 0,
  };
}

export function assessDebriefResponse(text, {
  messages = [],
  rubric = [],
  courseId = '',
  responseLanguage = null,
} = {}) {
  const output = String(text || '').trim();
  const issues = [];
  const turns = studentTurns(messages);
  const normalizedTurns = turns.map(clean);
  const strictCoachEvidence = isProfessionalLifeCoachCourse(courseId);
  const indexedTurns = strictCoachEvidence ? indexedCoachStudentTurns(messages) : [];
  const debriefLanguage = resolveDebriefLanguage({ messages, output, responseLanguage });
  if (!output) issues.push('empty');
  for (const heading of debriefHeadings(debriefLanguage)) {
    const pattern = new RegExp(`^#{1,3}\\s*${escapeRegExp(heading)}\\s*$`, 'imu');
    if (!pattern.test(output)) issues.push(`missing_heading:${heading}`);
  }
  const competencySection = debriefSection(output, 'competencies');
  const competencyRows = competencySection
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*•]\s+/u.test(line));
  const statusCount = (competencySection.match(new RegExp(DEBRIEF_STATUS_SOURCE, 'gu')) || []).length;
  if (statusCount < Math.max(1, rubric.length)) issues.push('incomplete_rubric');
  if (debriefLanguage === 'sk' && competencyRows.length !== rubric.length) {
    addIssue(issues, 'invalid_rubric_row_count');
  }
  const missingRubricLabels = [];
  for (const [rubricIndex, rawLabel] of (Array.isArray(rubric) ? rubric : []).entries()) {
    const label = clean(rawLabel);
    const matchingRows = debriefLanguage === 'sk'
      ? (competencyRows[rubricIndex] ? [competencyRows[rubricIndex]] : [])
      : competencyRows.filter(row => row.includes(label));
    if (matchingRows.length === 0) {
      missingRubricLabels.push(label);
      continue;
    }
    if (debriefLanguage === 'cs' && matchingRows.length > 1) issues.push('duplicate_rubric_row');
    const row = matchingRows[0];
    const evidenceRequired = debriefRowStatus(row) === 'proven' || debriefRowStatus(row) === 'partial';
    if (!evidenceRequired) continue;
    const rowQuotes = [...row.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
    if (!strictCoachEvidence) {
      const hasSupportedEvidence = rowQuotes.some(quote => normalizedTurns.some(turn => evidenceIncludes(turn, quote)));
      if (!hasSupportedEvidence) issues.push('unsupported_competency_claim');
      continue;
    }

    const references = coachEvidenceReferences(row);
    if (!references.length) {
      addIssue(issues, 'missing_evidence_turn_index');
      continue;
    }
    const relevantTurnIndexes = new Set();
    for (const reference of references) {
      const turn = indexedTurns.find(candidate => candidate.index === reference.turnIndex);
      if (!turn) {
        addIssue(issues, 'invalid_evidence_turn_index');
        continue;
      }
      if (!evidenceIncludes(turn.text, reference.quote)) {
        addIssue(issues, 'evidence_turn_mismatch');
        continue;
      }
      const relevance = assessCoachEvidenceRelevance({
        label,
        quote: reference.quote,
        turnIndex: reference.turnIndex,
        messages,
      });
      if (!relevance.relevant) {
        addIssue(issues, `semantically_irrelevant_evidence:${relevance.competencyId || 'unmapped'}`);
        continue;
      }
      relevantTurnIndexes.add(reference.turnIndex);
    }
    if (relevantTurnIndexes.size < requiredCoachEvidenceCount(label)) {
      addIssue(issues, 'insufficient_distinct_competency_evidence');
    }
    if (relevantTurnIndexes.size === 0 && !references.some(reference => (
      !indexedTurns.some(candidate => candidate.index === reference.turnIndex)
      || indexedTurns.some(candidate => (
        candidate.index === reference.turnIndex && !evidenceIncludes(candidate.text, reference.quote)
      ))
    ))) {
      addIssue(issues, 'unsupported_competency_claim');
    }
  }
  if (missingRubricLabels.length) issues.push('missing_rubric_labels');
  if (output.length > 7500) issues.push('debrief_too_long');

  // A proposed sentence in “Lepší formulace” is intentionally new text, not
  // evidence about what the student said. Only police quotations inside the
  // evidence-bearing sections of the debrief.
  const evidenceText = [
    debriefSection(output, 'strengths'),
    debriefSection(output, 'competencies'),
  ].join('\n');
  const quotes = [...evidenceText.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
  const rubricText = clean(rubric.join(' '));
  const unsupportedQuotes = quotes.filter(quote => (
    !normalizedTurns.some(turn => evidenceIncludes(turn, quote))
    && !evidenceIncludes(rubricText, quote)
  ));
  if (unsupportedQuotes.length) issues.push('unsupported_student_quote');

  const claimsExcellent = /výborný výkon|takhle má tento nácvik vypadat|bezchybný výkon|výborný výkon|takto má tento nácvik vyzerať|bezchybný výkon/iu.test(output);
  const inventsImprovement = /##?\s*(?:Co zlepšit|Čo zlepšiť)[\s\S]{0,500}(?:musíš|měla bys|mala by si|zásadní chyba|zásadná chyba|podstatná chyba|potřebuješ opravit|potrebuješ opraviť)/iu.test(output);
  if (claimsExcellent && inventsImprovement) issues.push('excellent_but_forced_criticism');
  if (/\b(?:modelová klientka|protistrana) (?:jsi řekla|řekla jsi)|studentka odpověděla[^\n]*„/iu.test(output)) {
    issues.push('speaker_attribution_risk');
  }
  if (responseLanguageMismatch(output, debriefLanguage)) {
    addIssue(issues, 'response_language_mismatch');
  }

  const criticalFailures = strictCoachEvidence ? detectCoachCriticalFailures(messages) : [];
  for (const failure of criticalFailures) {
    if (!criticalFailureAcknowledged(output, failure, rubric, competencyRows)) {
      addIssue(issues, `critical_failure_unacknowledged:${failure.code}`);
    }
  }

  return {
    pass: issues.length === 0,
    issues,
    shouldRepair: issues.length > 0,
    studentTurnCount: turns.length,
    criticalFailures,
    responseLanguage: debriefLanguage,
  };
}

export function completeDebriefRubric(text, rubric = [], { messages = [], responseLanguage = null } = {}) {
  const output = String(text || '').trim();
  const labels = (Array.isArray(rubric) ? rubric : []).map(clean).filter(Boolean);
  const debriefLanguage = resolveDebriefLanguage({ messages, output, responseLanguage });
  const competencyRows = debriefSection(output, 'competencies')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*•]\s+/u.test(line));
  const missingLabels = debriefLanguage === 'sk'
    ? labels.slice(competencyRows.filter(row => debriefRowStatus(row) !== 'missing').length)
    : labels.filter(label => !competencyRows.some(row => (
      row.includes(label) && debriefRowStatus(row) !== 'missing'
    )));
  if (!output || !missingLabels.length) {
    return { text: output, changed: false, missingLabels: [] };
  }
  const nextHeading = debriefHeadingMatch(output, 'improvement');
  const rubricHeading = debriefHeadingMatch(output, 'competencies');
  if (!nextHeading || !rubricHeading) {
    return { text: output, changed: false, missingLabels };
  }
  const rows = missingLabels.map((label, index) => (debriefLanguage === 'sk'
    ? `- ZATIAĽ NEPREUKÁZANÉ — Povinné kritérium ${competencyRows.length + index + 1}: v prepise nie je dosť priamych podkladov na poctivé hodnotenie.`
    : `- ZATÍM NEPROKÁZÁNO — ${label}: v přepisu není dost přímých podkladů pro poctivé hodnocení.`
  )).join('\n');
  const completed = `${output.slice(0, nextHeading.index).trimEnd()}\n${rows}\n\n${output.slice(nextHeading.index)}`;
  return { text: completed, changed: true, missingLabels };
}

export function sanitizeDebriefEvidence(text, {
  messages = [],
  rubric = [],
  courseId = '',
  responseLanguage = null,
} = {}) {
  let output = String(text || '').trim();
  const turns = studentTurns(messages).map(clean);
  const labels = (Array.isArray(rubric) ? rubric : []).map(clean).filter(Boolean);
  const strictCoachEvidence = isProfessionalLifeCoachCourse(courseId);
  const debriefLanguage = resolveDebriefLanguage({ messages, output, responseLanguage });
  let changed = false;

  const competency = debriefSection(output, 'competencies');
  if (competency) {
    let rubricRowIndex = 0;
    const nextLines = competency.split('\n').map(line => {
      const trimmed = line.trim();
      if (!/^[-*•]\s+/u.test(trimmed)) return line;
      const currentRowIndex = rubricRowIndex;
      rubricRowIndex += 1;
      const label = debriefLanguage === 'sk'
        ? labels[currentRowIndex]
        : labels.find(candidate => trimmed.includes(candidate));
      const claimsEvidence = ['proven', 'partial'].includes(debriefRowStatus(trimmed));
      if (!label || !claimsEvidence) return line;
      const quotes = [...trimmed.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
      const supported = strictCoachEvidence
        ? new Set(coachEvidenceReferences(trimmed)
          .filter(reference => assessCoachEvidenceRelevance({
            label,
            quote: reference.quote,
            turnIndex: reference.turnIndex,
            messages,
          }).relevant)
          .map(reference => reference.turnIndex)).size >= requiredCoachEvidenceCount(label)
        : quotes.length > 0 && quotes.some(quote => turns.some(turn => evidenceIncludes(turn, quote)));
      if (supported) return line;
      changed = true;
      return notProvenDebriefRow({ label, language: debriefLanguage, originalRow: trimmed });
    });
    output = replaceDebriefSection(output, 'competencies', nextLines.join('\n').trim());
  }

  const praise = debriefSection(output, 'strengths');
  const praiseQuotes = [...praise.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
  if (praiseQuotes.some(quote => !turns.some(turn => evidenceIncludes(turn, quote)))) {
    output = replaceDebriefSection(
      output,
      'strengths',
      debriefLanguage === 'sk'
        ? 'Z prepisu možno bezpečne oceniť iba prvky doložené nižšie v rozbore kompetencií; ďalšiu pochvalu bez priameho dôkazu nepridávam.'
        : 'Z přepisu lze bezpečně ocenit pouze prvky doložené níže v rozboru kompetencí; další pochvalu bez přímého důkazu nepřidávám.',
    );
    changed = true;
  }

  return { text: output, changed };
}

export function debriefAchievementSummary(text, rubric = [], {
  messages = [],
  courseId = '',
  responseLanguage = null,
} = {}) {
  const output = String(text || '');
  const section = debriefSection(output, 'competencies');
  const debriefLanguage = resolveDebriefLanguage({ messages, output, responseLanguage });
  const competencyRows = section.split('\n').map(line => line.trim()).filter(line => /^[-*•]\s+/u.test(line));
  const rows = (Array.isArray(rubric) ? rubric : []).map((label, index) => {
    const escaped = escapeRegExp(clean(label));
    const value = debriefLanguage === 'sk'
      ? competencyRows[index] || ''
      : new RegExp(`${DEBRIEF_STATUS_SOURCE}[^\n]*${escaped}`, 'iu').exec(section)?.[0]
        || new RegExp(`${escaped}[^\n]*${DEBRIEF_STATUS_SOURCE}`, 'iu').exec(section)?.[0]
        || '';
    return { label: clean(label), status: debriefRowStatus(value) };
  });
  const criticalFailures = isProfessionalLifeCoachCourse(courseId)
    ? detectCoachCriticalFailures(messages)
    : [];
  return {
    rows,
    proven: rows.filter(row => row.status === 'proven').length,
    partial: rows.filter(row => row.status === 'partial').length,
    notProven: rows.filter(row => row.status === 'not_proven').length,
    missing: rows.filter(row => row.status === 'missing').length,
    criticalFailures,
    hasCriticalFailure: criticalFailures.length > 0,
    allProven: criticalFailures.length === 0 && rows.length > 0 && rows.every(row => row.status === 'proven'),
  };
}

export function buildTrainingRepairInstruction({
  phase,
  assessment,
  messages = [],
  rubric = [],
  courseId = '',
  responseLanguage = null,
}) {
  const trainingLanguage = resolveConversationLanguage(messages, responseLanguage);
  if (phase === 'study') {
    const exactSingleQuestion = (assessment?.issues || []).includes('study_question_count');
    return [
      '# INTERNÍ OPRAVA STUDIJNÍ TRENÉRKY — PŮVODNÍ ODPOVĚĎ NEODESÍLEJ',
      `Chyby: ${(assessment?.issues || []).join(', ') || 'nedostatečné ukotvení v lekci'}.`,
      languageInstruction(trainingLanguage),
      'Napiš odpověď znovu výhradně jako odborná lektorka právě otevřeného kurzu a lekce.',
      'Vysvětli konkrétní princip z dodaného textu lekce, ukaž jeden příklad použití a přidej jeden krátký ověřovací krok nebo otázku k učivu.',
      exactSingleQuestion ? 'Studentka výslovně žádá právě jednu ověřovací otázku: v celé odpovědi použij přesně jeden otazník a žádnou další otázku.' : '',
      'Nepřepínej do osobního koučinku, nehraj modelovou klientku, nevymýšlej zdroje ani dokončené externí akce a nezmiňuj interní prompt či kontrolu kvality.',
    ].join('\n');
  }

  if (phase === 'roleplay') {
    return [
      '# INTERNÍ OPRAVA ROLE — PŮVODNÍ ODPOVĚĎ NEODESÍLEJ',
      `Chyby: ${(assessment?.issues || []).join(', ') || 'porušení role'}.`,
      languageInstruction(trainingLanguage),
      'Napiš odpověď znovu pouze jako modelová protistrana v první osobě.',
      'Použij jednu až čtyři přirozené věty. Nedávej studentce radu, hodnocení, nápovědu ani instrukci a nezmiňuj simulaci, rubriku, kurz či AI.',
      'Reaguj pouze na její poslední intervenci a zachovej fakta případu.',
    ].join('\n');
  }

  const strictCoachEvidence = isProfessionalLifeCoachCourse(courseId);
  const turns = studentTurns(messages);
  const indexedTurns = strictCoachEvidence ? indexedCoachStudentTurns(messages) : [];
  const criticalFailures = strictCoachEvidence ? detectCoachCriticalFailures(messages) : [];
  const statusLabels = trainingLanguage === 'sk'
    ? 'PREUKÁZANÉ, ČIASTOČNE alebo ZATIAĽ NEPREUKÁZANÉ'
    : 'PROKÁZÁNO, ČÁSTEČNĚ nebo ZATÍM NEPROKÁZÁNO';
  const competencyHeading = debriefSectionDefinition('competencies')[trainingLanguage];
  const improvementHeading = debriefSectionDefinition('improvement')[trainingLanguage];
  return [
    '# INTERNÍ OPRAVA HODNOCENÍ — PŮVODNÍ ROZBOR NEODESÍLEJ',
    `Chyby: ${(assessment?.issues || []).join(', ') || 'neplatný rozbor'}.`,
    languageInstruction(trainingLanguage),
    `Počet odborných vstupů studentky: ${turns.length}.`,
    `Kritéria, která musíš všechna vyhodnotit přesně v tomto pořadí: ${rubric.join(' | ')}`,
    trainingLanguage === 'sk'
      ? `Napíš celý rozbor znova so slovenskými nadpismi: ${debriefHeadings('sk').map(heading => `„${heading}“`).join(', ')}. V časti „${competencyHeading}“ použi práve jednu stavovú odrážku pre každé kritérium v zadanom poradí, jeho názov prirodzene prelož do slovenčiny a použi iba stavy ${statusLabels}.`
      : `Napiš celý rozbor znovu v povinném formátu. V části „${competencyHeading}“ použij právě jednu stavovou odrážku pro každé kritérium, zopakuj přesný název kritéria a žádné nevynechej. Použij pouze stavy ${statusLabels}.`,
    strictCoachEvidence
      ? trainingLanguage === 'sk'
        ? 'Pri každom kritériu označenom PREUKÁZANÉ alebo ČIASTOČNE uveď v rovnakej odrážke presne „Dôkaz [S#]: „doslovná citácia““. Index musí označovať práve ten študentský vstup, z ktorého citácia pochádza, a citácia musí významovo dokazovať práve hodnotenú kompetenciu. Bez platného, relevantného dôkazu použi ZATIAĽ NEPREUKÁZANÉ.'
        : 'U každého kritéria označeného PROKÁZÁNO nebo ČÁSTEČNĚ uveď ve stejné odrážce přesně „Důkaz [S#]: „doslovná citace““. Index musí označovat právě ten studentský tah, z něhož citace pochází, a citace musí významově dokazovat právě hodnocenou kompetenci. Bez platného, relevantního důkazu použij ZATÍM NEPROKÁZÁNO.'
      : trainingLanguage === 'sk'
        ? 'Pri každom kritériu označenom PREUKÁZANÉ alebo ČIASTOČNE uveď v rovnakej odrážke krátku presnú citáciu v úvodzovkách „…“ zo študentských vstupov. Bez takej citácie použi ZATIAĽ NEPREUKÁZANÉ. Necituj modelovú protistranu a nič spätne nepripisuj študentke.'
        : 'U každého kritéria označeného PROKÁZÁNO nebo ČÁSTEČNĚ uveď ve stejné odrážce přesnou krátkou citaci v českých uvozovkách „…“ z níže uvedených studentských vstupů. Bez takové citace použij ZATÍM NEPROKÁZÁNO. Necituj modelovou protistranu a nic nepřisuzuj studentce zpětně.',
    strictCoachEvidence && criticalFailures.length
      ? trainingLanguage === 'sk'
        ? `V prepise sú kritické profesijné porušenia: ${criticalFailures.map(failure => `${failure.code} v [${failure.reference}]`).join(', ')}. Každé výslovne uznaj: súvisiace kritérium označ ZATIAĽ NEPREUKÁZANÉ a v časti „${improvementHeading}“ uveď jeho presný „Dôkaz [S#]: „doslovná citácia““. Kritické porušenie nikdy nekompenzuj inou silnou zručnosťou ani neskorším ospravedlnením.`
        : `V přepisu jsou kritická profesní porušení: ${criticalFailures.map(failure => `${failure.code} v [${failure.reference}]`).join(', ')}. Každé musíš výslovně uznat: související kritérium označ ZATÍM NEPROKÁZÁNO a v části „${improvementHeading}“ uveď jeho přesný „Důkaz [S#]: „doslovná citace““. Kritické porušení nikdy nekompenzuj jinou silnou dovedností ani pozdější omluvou.`
      : '',
    'Pokud výkon splnil všechna kritéria bez doložené chyby, řekni to naplno a žádnou výtku nevyráběj.',
    '# POVOLENÉ STUDENTSKÉ VSTUPY',
    strictCoachEvidence
      ? indexedTurns.map(turn => `[${turn.reference}] ${turn.text}`).join('\n') || 'Žádný odborný vstup.'
      : turns.map((turn, index) => `${index + 1}. ${turn}`).join('\n') || 'Žádný odborný vstup.',
  ].join('\n\n');
}

export function assessStudyResponse(text, {
  messages = [],
  course = {},
  item = {},
  responseLanguage = null,
} = {}) {
  const output = String(text || '').trim();
  const issues = [];
  const trainingLanguage = resolveConversationLanguage(messages, responseLanguage);
  const normalized = normalizeStudyText(output);
  if (!output) issues.push('empty');
  if (output.length > 9000) issues.push('study_too_long');
  if (/\b(?:jako tvoje koucka|jako tvuj kouc|ted te budu koucovat|pojdme zpracovat tve trauma|pojdme lecit tve trauma|uzdravit tve vnitrni dite)\b/u.test(normalized)) {
    issues.push('study_role_drift');
  }
  if (/\b(?:jako modelova klientka|zustanu v roli klientky|vyhodnoceni tveho vykonu|rubrika simulace)\b/u.test(normalized)) {
    issues.push('study_simulation_leak');
  }
  if (/\b(?:interni prompt|systemove instrukce|kontrola kvality|skryta instrukce)\b/u.test(normalized)) {
    issues.push('internal_instruction_leak');
  }

  // Only the authored lesson may ground an explanation. The student's prompt
  // is a question, not an authority, and a repeated course/lesson title is not
  // evidence that the answer teaches the actual material.
  const sourceText = [
    course?.title,
    course?.subtitle,
    item?.title,
    String(item?.markdown || '').slice(0, 6000),
  ].filter(Boolean).join(' ');
  const lessonBody = [course?.subtitle, String(item?.markdown || '').slice(0, 6000)]
    .filter(Boolean).join(' ');
  const sourceStems = studyStems(sourceText);
  const lessonBodyStems = studyStems(lessonBody);
  const outputStems = studyStems(output);
  const overlap = [...sourceStems].filter(value => outputStems.has(value)).length;
  const bodyOverlap = [...lessonBodyStems].filter(value => outputStems.has(value)).length;
  if (output.length >= 80 && (overlap < 3 || bodyOverlap < 2)) issues.push('not_grounded_in_lesson');
  if (contradictsStudySafety(output, sourceText)) issues.push('contradicts_lesson_or_safe_practice');
  const latestUser = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')?.content || '';
  if (/jedn(?:ou|u)\s+(?:kr[aá]tkou\s+)?ot[aá]zk/iu.test(latestUser) && (output.match(/\?/gu) || []).length !== 1) {
    issues.push('study_question_count');
  }
  if (responseLanguageMismatch(output, trainingLanguage)) issues.push('response_language_mismatch');

  return {
    pass: issues.length === 0,
    issues,
    shouldRepair: issues.length > 0,
  };
}

function contradictsStudySafety(output, sourceText) {
  const normalizedOutput = normalizeStudyText(output);
  const normalizedSource = normalizeStudyText(sourceText);
  const protectedPractice = /naslouch|souhlas|overen|zpetn vazb|bezpec|hranic|fakt|dukaz|kontext/u.test(normalizedSource);
  if (!protectedPractice) return false;
  return /(?:naslouch|souhlas|overen|zpetn vazb|bezpec|hranic|fakt|dukaz|kontext)[a-z ]{0,35}(?:je zbytec|neni potreba|muze se vynechat|ignoruj)/u.test(normalizedOutput)
    || /(?:nejlepsi|spravne je|vzdy|nikdy)[a-z ]{0,45}(?:zacit radou|rozhodnout za|presvedcit druhou|bez otaz|bez souhlasu|bez overeni)/u.test(normalizedOutput);
}

export function sanitizeStudyQuestionCount(text, { messages = [], responseLanguage = null } = {}) {
  const output = String(text || '').trim();
  const trainingLanguage = resolveConversationLanguage(messages, responseLanguage);
  const latestUser = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')?.content || '';
  if (!/jedn(?:ou|u)\s+(?:kr[aá]tkou\s+)?ot[aá]zk/iu.test(latestUser)) {
    return { text: output, changed: false };
  }
  const indexes = [...output.matchAll(/\?/gu)].map(match => match.index);
  if (indexes.length === 1) return { text: output, changed: false };
  if (indexes.length === 0) {
    return {
      text: `${output}\n\n${trainingLanguage === 'sk' ? 'Ako by si tento princíp použila v jednom konkrétnom príklade?' : 'Jak bys tento princip použila v jednom konkrétním příkladu?'}`.trim(),
      changed: true,
    };
  }
  let seen = 0;
  return {
    text: output.replace(/\?/gu, () => {
      seen += 1;
      return seen === indexes.length ? '?' : '.';
    }),
    changed: true,
  };
}

export function trainingStudentTurns(messages = []) {
  return studentTurns(messages);
}

function coachEvidenceReferences(value) {
  return [...String(value || '').matchAll(/(?:D(?:u|ů|o|ô)kaz\s*)?\[S(\d+)\]\s*:?\s*„([^“]{4,280})“/giu)]
    .map(match => ({
      turnIndex: Number.parseInt(match[1], 10),
      quote: clean(match[2]),
    }));
}

function criticalFailureAcknowledged(output, failure, rubric, competencyRows) {
  const debriefLanguage = resolveDebriefLanguage({ output });
  const labels = (Array.isArray(rubric) ? rubric : []).map(clean);
  const relatedRows = labels.flatMap((label, index) => {
    if (coachCompetencyIdForCriterion(label) !== failure.competencyId) return [];
    return debriefLanguage === 'sk'
      ? (competencyRows[index] ? [competencyRows[index]] : [])
      : competencyRows.filter(row => row.includes(label));
  });
  const relatedCompetencyDowngraded = relatedRows.some(row => (
    debriefRowStatus(row) === 'not_proven'
  ));
  if (!relatedCompetencyDowngraded) return false;

  const improvementReferences = coachEvidenceReferences(debriefSection(output, 'improvement'));
  return improvementReferences.some(reference => (
    reference.turnIndex === failure.studentTurnIndex
    && evidenceIncludes(failure.quote, reference.quote)
  ));
}

function addIssue(issues, issue) {
  if (!issues.includes(issue)) issues.push(issue);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function debriefSection(output, heading) {
  const targetHeadings = debriefHeadingAliases(heading).map(escapeRegExp).join('|');
  const headings = DEBRIEF_SECTIONS.flatMap(section => [section.cs, section.sk]).map(escapeRegExp).join('|');
  const pattern = new RegExp(
    `^#{1,3}[ \\t]*(?:${targetHeadings})[ \\t]*$([\\s\\S]*?)(?=^#{1,3}[ \\t]*(?:${headings})[ \\t]*$|$(?![\\s\\S]))`,
    'imu',
  );
  return pattern.exec(String(output || ''))?.[1] || '';
}

function replaceDebriefSection(output, heading, content) {
  const targetHeadings = debriefHeadingAliases(heading).map(escapeRegExp).join('|');
  const headings = DEBRIEF_SECTIONS.flatMap(section => [section.cs, section.sk]).map(escapeRegExp).join('|');
  const pattern = new RegExp(
    `(^#{1,3}[ \\t]*(?:${targetHeadings})[ \\t]*$)[\\s\\S]*?(?=^#{1,3}[ \\t]*(?:${headings})[ \\t]*$|$(?![\\s\\S]))`,
    'imu',
  );
  return String(output || '').replace(pattern, (_match, title) => `${title}\n\n${String(content || '').trim()}\n\n`);
}

function debriefSectionDefinition(heading) {
  return DEBRIEF_SECTIONS.find(section => (
    section.key === heading || section.cs === heading || section.sk === heading
  )) || DEBRIEF_SECTIONS[0];
}

function debriefHeadingAliases(heading) {
  const section = debriefSectionDefinition(heading);
  return [section.cs, section.sk];
}

function debriefHeadings(language = 'cs') {
  return DEBRIEF_SECTIONS.map(section => section[language === 'sk' ? 'sk' : 'cs']);
}

function debriefHeadingMatch(output, heading) {
  const aliases = debriefHeadingAliases(heading).map(escapeRegExp).join('|');
  return new RegExp(`^#{1,3}[ \\t]*(?:${aliases})[ \\t]*$`, 'imu').exec(String(output || ''));
}

function debriefRowStatus(value) {
  const row = String(value || '');
  if (/(?:ZATÍM NEPROKÁZÁNO|ZATIAĽ NEPREUKÁZANÉ)/iu.test(row)) return 'not_proven';
  if (/(?:ČÁSTEČNĚ|ČIASTOČNE)/iu.test(row)) return 'partial';
  if (/(?:PROKÁZÁNO|PREUKÁZANÉ)/iu.test(row)) return 'proven';
  return 'missing';
}

function resolveConversationLanguage(messages = [], explicitLanguage = null) {
  if (explicitLanguage === 'sk' || explicitLanguage === 'cs') return explicitLanguage;
  const substantiveMessages = (Array.isArray(messages) ? messages : []).filter(message => (
    message?.role !== 'user' || !isTrainingAdministrativeTurn(message.content)
  ));
  return detectConversationLanguage(substantiveMessages);
}

function resolveDebriefLanguage({ messages = [], output = '', responseLanguage = null } = {}) {
  if (responseLanguage === 'sk' || responseLanguage === 'cs') return responseLanguage;
  const substantiveUserTurns = (Array.isArray(messages) ? messages : []).filter(message => (
    message?.role === 'user' && !isTrainingAdministrativeTurn(message.content)
  ));
  if (substantiveUserTurns.length) return detectConversationLanguage(substantiveUserTurns);
  const slovakResultHeading = escapeRegExp(debriefSectionDefinition('result').sk);
  if (new RegExp(`^#{1,3}\\s*${slovakResultHeading}\\s*$`, 'imu').test(String(output || ''))) return 'sk';
  return 'cs';
}

function notProvenDebriefRow({ label, language, originalRow }) {
  if (language !== 'sk') {
    return `- ZATÍM NEPROKÁZÁNO — ${label}: v přepisu není dost přímých podkladů pro poctivé hodnocení.`;
  }
  const withoutBullet = String(originalRow || '').replace(/^[-*•]\s*/u, '');
  const visibleLabel = withoutBullet
    .replace(new RegExp(`^${DEBRIEF_STATUS_SOURCE}\\s*[—:-]?\\s*`, 'iu'), '')
    .split(':')[0]
    .trim() || 'Povinné kritérium';
  return `- ZATIAĽ NEPREUKÁZANÉ — ${visibleLabel}: v prepise nie je dosť priamych podkladov na poctivé hodnotenie.`;
}

const STUDY_STOPWORDS = new Set([
  'aby', 'ale', 'ano', 'bez', 'bude', 'byla', 'bylo', 'co', 'jak', 'jako', 'jsem', 'jsi',
  'ktera', 'ktere', 'ktery', 'kurz', 'lekce', 'mate', 'musi', 'nebo', 'podle', 'pokud', 'proto',
  'prave', 'take', 'tato', 'tento', 'tohle', 'tvoje', 'vase', 'vice', 'zde', 'zpusob',
]);

function normalizeStudyText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function evidenceIncludes(container, quote) {
  const normalizedContainer = normalizeEvidence(container);
  const normalizedQuote = normalizeEvidence(quote);
  return normalizedQuote.length >= 4 && normalizedContainer.includes(normalizedQuote);
}

function normalizeEvidence(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function studyStems(value) {
  return new Set(normalizeStudyText(value)
    .split(' ')
    .filter(token => token.length >= 5 && !STUDY_STOPWORDS.has(token))
    .map(token => token.replace(/(?:ami|emi|ove|ova|ovy|eni|ani|ace|aci|ost|ech|ich|ych|ou|em|im|at|it|et|y|a|u|i|e|o)$/u, '').slice(0, 9))
    .filter(token => token.length >= 4));
}
