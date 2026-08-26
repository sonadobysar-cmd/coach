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
  const statusCount = (output.match(/\b(?:PROKÁZÁNO|ČÁSTEČNĚ|ZATÍM NEPROKÁZÁNO)\b/gu) || []).length;
  if (statusCount < Math.max(1, rubric.length)) issues.push('incomplete_rubric');
  const missingRubricLabels = rubric.filter(label => !output.includes(String(label)));
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
    !normalizedTurns.some(turn => turn.includes(quote))
    && !rubricText.includes(quote)
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
  const missingLabels = labels.filter(label => !output.includes(label));
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
    'Jako důkaz smíš použít jen přesnou krátkou citaci z níže uvedených studentských vstupů. Necituj modelovou protistranu a nic nepřisuzuj studentce zpětně.',
    'Pokud výkon splnil všechna kritéria bez doložené chyby, řekni to naplno a žádnou výtku nevyráběj.',
    '# POVOLENÉ STUDENTSKÉ VSTUPY',
    turns.map((turn, index) => `${index + 1}. ${turn}`).join('\n') || 'Žádný odborný vstup.',
  ].join('\n\n');
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
