const REQUIRED_DEBRIEF_HEADINGS = Object.freeze([
  'Výsledek nácviku',
  'Co fungovalo',
  'Rozbor kompetencí',
  'Co zlepšit',
  'Lepší formulace',
  'Další pokus',
]);

function clean(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function studentTurns(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'user')
    .map(message => clean(message.content))
    .filter(text => text && !/ukončuji simulaci|ukoncuji simulaci|vyhodnoť (?:prosím )?(?:celý )?nácvik|vyhodnot (?:prosim )?(?:cely )?nacvik/iu.test(text));
}

export function assessRoleplayResponse(text) {
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
  return {
    pass: issues.length === 0,
    issues,
    shouldRepair: issues.length > 0,
  };
}

export function assessDebriefResponse(text, { messages = [], rubric = [] } = {}) {
  const output = String(text || '').trim();
  const issues = [];
  const turns = studentTurns(messages);
  const normalizedTurns = turns.map(clean);
  if (!output) issues.push('empty');
  for (const heading of REQUIRED_DEBRIEF_HEADINGS) {
    const pattern = new RegExp(`^#{1,3}\\s*${escapeRegExp(heading)}\\s*$`, 'imu');
    if (!pattern.test(output)) issues.push(`missing_heading:${heading}`);
  }
  const competencySection = debriefSection(output, 'Rozbor kompetencí');
  const competencyRows = competencySection
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*•]\s+/u.test(line));
  const statusCount = (competencySection.match(/(?:PROKÁZÁNO|ČÁSTEČNĚ|ZATÍM NEPROKÁZÁNO)/gu) || []).length;
  if (statusCount < Math.max(1, rubric.length)) issues.push('incomplete_rubric');
  const missingRubricLabels = [];
  for (const rawLabel of rubric) {
    const label = clean(rawLabel);
    const matchingRows = competencyRows.filter(row => row.includes(label));
    if (matchingRows.length === 0) {
      missingRubricLabels.push(label);
      continue;
    }
    if (matchingRows.length > 1) issues.push('duplicate_rubric_row');
    const row = matchingRows[0];
    const evidenceRequired = /(?:PROKÁZÁNO|ČÁSTEČNĚ)/u.test(row)
      && !/ZATÍM NEPROKÁZÁNO/u.test(row);
    if (!evidenceRequired) continue;
    const rowQuotes = [...row.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
    const hasSupportedEvidence = rowQuotes.some(quote => normalizedTurns.some(turn => evidenceIncludes(turn, quote)));
    if (!hasSupportedEvidence) issues.push('unsupported_competency_claim');
  }
  if (missingRubricLabels.length) issues.push('missing_rubric_labels');
  if (output.length > 7500) issues.push('debrief_too_long');

  // A proposed sentence in “Lepší formulace” is intentionally new text, not
  // evidence about what the student said. Only police quotations inside the
  // evidence-bearing sections of the debrief.
  const evidenceText = [
    debriefSection(output, 'Co fungovalo'),
    debriefSection(output, 'Rozbor kompetencí'),
  ].join('\n');
  const quotes = [...evidenceText.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
  const rubricText = clean(rubric.join(' '));
  const unsupportedQuotes = quotes.filter(quote => (
    !normalizedTurns.some(turn => evidenceIncludes(turn, quote))
    && !evidenceIncludes(rubricText, quote)
  ));
  if (unsupportedQuotes.length) issues.push('unsupported_student_quote');

  const claimsExcellent = /výborný výkon|takhle má tento nácvik vypadat|bezchybný výkon/iu.test(output);
  const inventsImprovement = /##?\s*Co zlepšit[\s\S]{0,500}(?:musíš|měla bys|zásadní chyba|podstatná chyba|potřebuješ opravit)/iu.test(output);
  if (claimsExcellent && inventsImprovement) issues.push('excellent_but_forced_criticism');
  if (/\b(?:modelová klientka|protistrana) (?:jsi řekla|řekla jsi)|studentka odpověděla[^\n]*„/iu.test(output)) {
    issues.push('speaker_attribution_risk');
  }

  return {
    pass: issues.length === 0,
    issues,
    shouldRepair: issues.length > 0,
    studentTurnCount: turns.length,
  };
}

export function completeDebriefRubric(text, rubric = []) {
  const output = String(text || '').trim();
  const labels = (Array.isArray(rubric) ? rubric : []).map(clean).filter(Boolean);
  const competencyRows = debriefSection(output, 'Rozbor kompetencí')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-*•]\s+/u.test(line));
  const missingLabels = labels.filter(label => !competencyRows.some(row => (
    row.includes(label) && /(?:PROKÁZÁNO|ČÁSTEČNĚ|ZATÍM NEPROKÁZÁNO)/u.test(row)
  )));
  if (!output || !missingLabels.length) {
    return { text: output, changed: false, missingLabels: [] };
  }
  const nextHeading = /^#{1,3}[ \t]*Co zlepšit[ \t]*$/imu.exec(output);
  const rubricHeading = /^#{1,3}[ \t]*Rozbor kompetencí[ \t]*$/imu.test(output);
  if (!nextHeading || !rubricHeading) {
    return { text: output, changed: false, missingLabels };
  }
  const rows = missingLabels.map(label => (
    `- ZATÍM NEPROKÁZÁNO — ${label}: v přepisu není dost přímých podkladů pro poctivé hodnocení.`
  )).join('\n');
  const completed = `${output.slice(0, nextHeading.index).trimEnd()}\n${rows}\n\n${output.slice(nextHeading.index)}`;
  return { text: completed, changed: true, missingLabels };
}

export function sanitizeDebriefEvidence(text, { messages = [], rubric = [] } = {}) {
  let output = String(text || '').trim();
  const turns = studentTurns(messages).map(clean);
  const labels = (Array.isArray(rubric) ? rubric : []).map(clean).filter(Boolean);
  let changed = false;

  const competency = debriefSection(output, 'Rozbor kompetencí');
  if (competency) {
    const nextLines = competency.split('\n').map(line => {
      const trimmed = line.trim();
      if (!/^[-*•]\s+/u.test(trimmed)) return line;
      const label = labels.find(candidate => trimmed.includes(candidate));
      const claimsEvidence = /(?:PROKÁZÁNO|ČÁSTEČNĚ)/u.test(trimmed) && !/ZATÍM NEPROKÁZÁNO/u.test(trimmed);
      if (!label || !claimsEvidence) return line;
      const quotes = [...trimmed.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
      const supported = quotes.length > 0 && quotes.some(quote => turns.some(turn => evidenceIncludes(turn, quote)));
      if (supported) return line;
      changed = true;
      return `- ZATÍM NEPROKÁZÁNO — ${label}: v přepisu není dost přímých podkladů pro poctivé hodnocení.`;
    });
    output = replaceDebriefSection(output, 'Rozbor kompetencí', nextLines.join('\n').trim());
  }

  const praise = debriefSection(output, 'Co fungovalo');
  const praiseQuotes = [...praise.matchAll(/„([^“]{4,280})“/gu)].map(match => clean(match[1]));
  if (praiseQuotes.some(quote => !turns.some(turn => evidenceIncludes(turn, quote)))) {
    output = replaceDebriefSection(
      output,
      'Co fungovalo',
      'Z přepisu lze bezpečně ocenit pouze prvky doložené níže v rozboru kompetencí; další pochvalu bez přímého důkazu nepřidávám.',
    );
    changed = true;
  }

  return { text: output, changed };
}

export function debriefAchievementSummary(text, rubric = []) {
  const section = debriefSection(String(text || ''), 'Rozbor kompetencí');
  const rows = (Array.isArray(rubric) ? rubric : []).map(label => {
    const escaped = escapeRegExp(clean(label));
    const match = new RegExp(`(?:PROKÁZÁNO|ČÁSTEČNĚ|ZATÍM NEPROKÁZÁNO)[^\n]*${escaped}`, 'iu').exec(section)
      || new RegExp(`${escaped}[^\n]*(?:PROKÁZÁNO|ČÁSTEČNĚ|ZATÍM NEPROKÁZÁNO)`, 'iu').exec(section);
    const value = match?.[0] || '';
    const status = /ZATÍM NEPROKÁZÁNO/iu.test(value)
      ? 'not_proven'
      : /ČÁSTEČNĚ/iu.test(value)
        ? 'partial'
        : /PROKÁZÁNO/iu.test(value)
          ? 'proven'
          : 'missing';
    return { label: clean(label), status };
  });
  return {
    rows,
    proven: rows.filter(row => row.status === 'proven').length,
    partial: rows.filter(row => row.status === 'partial').length,
    notProven: rows.filter(row => row.status === 'not_proven').length,
    missing: rows.filter(row => row.status === 'missing').length,
    allProven: rows.length > 0 && rows.every(row => row.status === 'proven'),
  };
}

export function buildTrainingRepairInstruction({ phase, assessment, messages = [], rubric = [] }) {
  if (phase === 'study') {
    const exactSingleQuestion = (assessment?.issues || []).includes('study_question_count');
    return [
      '# INTERNÍ OPRAVA STUDIJNÍ TRENÉRKY — PŮVODNÍ ODPOVĚĎ NEODESÍLEJ',
      `Chyby: ${(assessment?.issues || []).join(', ') || 'nedostatečné ukotvení v lekci'}.`,
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
      'Napiš odpověď znovu pouze jako modelová protistrana v první osobě.',
      'Použij jednu až čtyři přirozené věty. Nedávej studentce radu, hodnocení, nápovědu ani instrukci a nezmiňuj simulaci, rubriku, kurz či AI.',
      'Reaguj pouze na její poslední intervenci a zachovej fakta případu.',
    ].join('\n');
  }

  const turns = studentTurns(messages);
  return [
    '# INTERNÍ OPRAVA HODNOCENÍ — PŮVODNÍ ROZBOR NEODESÍLEJ',
    `Chyby: ${(assessment?.issues || []).join(', ') || 'neplatný rozbor'}.`,
    `Počet odborných vstupů studentky: ${turns.length}.`,
    `Kritéria, která musíš všechna vyhodnotit přesně v tomto pořadí: ${rubric.join(' | ')}`,
    'Napiš celý rozbor znovu v povinném formátu. V části „Rozbor kompetencí“ použij právě jednu stavovou odrážku pro každé kritérium, zopakuj přesný název kritéria a žádné nevynechej.',
    'U každého kritéria označeného PROKÁZÁNO nebo ČÁSTEČNĚ uveď ve stejné odrážce přesnou krátkou citaci v českých uvozovkách „…“ z níže uvedených studentských vstupů. Bez takové citace použij ZATÍM NEPROKÁZÁNO. Necituj modelovou protistranu a nic nepřisuzuj studentce zpětně.',
    'Pokud výkon splnil všechna kritéria bez doložené chyby, řekni to naplno a žádnou výtku nevyráběj.',
    '# POVOLENÉ STUDENTSKÉ VSTUPY',
    turns.map((turn, index) => `${index + 1}. ${turn}`).join('\n') || 'Žádný odborný vstup.',
  ].join('\n\n');
}

export function assessStudyResponse(text, { messages = [], course = {}, item = {} } = {}) {
  const output = String(text || '').trim();
  const issues = [];
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

  const sourceText = [
    course?.title,
    course?.subtitle,
    item?.title,
    String(item?.markdown || '').slice(0, 6000),
    ...(Array.isArray(messages) ? messages : [])
      .filter(message => message?.role === 'user')
      .slice(-3)
      .map(message => message.content),
  ].filter(Boolean).join(' ');
  const exactAnchors = [course?.title, item?.title]
    .map(normalizeStudyText)
    .filter(anchor => anchor.length >= 5);
  const sourceStems = studyStems(sourceText);
  const outputStems = studyStems(output);
  const overlap = [...sourceStems].filter(value => outputStems.has(value)).length;
  const hasExactAnchor = exactAnchors.some(anchor => normalized.includes(anchor));
  if (output.length >= 80 && !hasExactAnchor && overlap < 2) issues.push('not_grounded_in_lesson');
  const latestUser = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')?.content || '';
  if (/jedn(?:ou|u)\s+(?:kr[aá]tkou\s+)?ot[aá]zk/iu.test(latestUser) && (output.match(/\?/gu) || []).length !== 1) {
    issues.push('study_question_count');
  }

  return {
    pass: issues.length === 0,
    issues,
    shouldRepair: issues.length > 0,
  };
}

export function sanitizeStudyQuestionCount(text, { messages = [] } = {}) {
  const output = String(text || '').trim();
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
      text: `${output}\n\nJak bys tento princip použila v jednom konkrétním příkladu?`.trim(),
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function debriefSection(output, heading) {
  const headings = REQUIRED_DEBRIEF_HEADINGS.map(escapeRegExp).join('|');
  const pattern = new RegExp(
    `^#{1,3}[ \\t]*${escapeRegExp(heading)}[ \\t]*$([\\s\\S]*?)(?=^#{1,3}[ \\t]*(?:${headings})[ \\t]*$|$(?![\\s\\S]))`,
    'imu',
  );
  return pattern.exec(String(output || ''))?.[1] || '';
}

function replaceDebriefSection(output, heading, content) {
  const headings = REQUIRED_DEBRIEF_HEADINGS.map(escapeRegExp).join('|');
  const pattern = new RegExp(
    `(^#{1,3}[ \\t]*${escapeRegExp(heading)}[ \\t]*$)[\\s\\S]*?(?=^#{1,3}[ \\t]*(?:${headings})[ \\t]*$|$(?![\\s\\S]))`,
    'imu',
  );
  return String(output || '').replace(pattern, (_match, title) => `${title}\n\n${String(content || '').trim()}\n\n`);
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
    .replace(/[„“”"'’]/gu, '')
    .replace(/[‐‑‒–—]/gu, '-')
    .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '')
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
