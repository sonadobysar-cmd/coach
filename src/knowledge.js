import { readFile } from 'node:fs/promises';

const DIACRITICS = /[\u0300-\u036f]/g;
const TOKEN_SPLIT = /[^a-z0-9]+/g;
const STOP_WORDS = new Set([
  'aby', 'ale', 'ani', 'asi', 'bez', 'bude', 'budu', 'byla', 'bylo', 'byt',
  'chci', 'co', 'do', 'ho', 'jak', 'jako', 'je', 'jej', 'jsem', 'jsi', 'jsou',
  'kdy', 'kdyz', 'ktera', 'ktere', 'kterou', 'ma', 'mam', 'me', 'mi', 'mit',
  'moc', 'mu', 'muj', 'na', 'ne', 'nebo', 'neni', 'nez', 'nic', 'o', 'od',
  'po', 'pod', 'pro', 'proc', 'pri', 'se', 'si', 's', 'tak', 'take', 'tam', 'ten',
  'to', 'tvoje', 'ty', 'u', 'uz', 'v', 've', 'z', 'za', 'ze', 'ze', 'kde',
  'jestli', 'znamena', 'vim', 'vime', 'jiste', 'necemu', 'vzdycky', 'prvni', 'dalsi',
  'prakticky', 'prakticka', 'prakticke', 'praktickou', 'praktikovat',
]);

export function normalize(value = '') {
  return value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();
}

export function tokenize(value = '') {
  return normalize(value)
    .split(TOKEN_SPLIT)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token))
    .map(canonicalizeToken);
}

const TOKEN_PREFIXES = [
  ['nacen', 'cena'], ['cen', 'cena'], ['cashflow', 'cashflow'], ['naklad', 'naklady'],
  ['zisk', 'zisk'], ['obrat', 'obrat'], ['invest', 'investice'], ['marketing', 'marketing'],
  ['reklam', 'reklama'], ['social', 'socialni_site'], ['instagram', 'socialni_site'],
  ['reels', 'obsah'], ['obsah', 'obsah'], ['brand', 'branding'], ['znack', 'branding'],
  ['position', 'positioning'], ['vizual', 'branding'], ['logo', 'branding'],
  ['nabid', 'nabidka'], ['produkt', 'nabidka'], ['cilov', 'cilovka'], ['klient', 'klient'],
  ['prod', 'prodej'], ['namit', 'namitka'], ['follow', 'followup'], ['strach', 'strach'],
  ['bojim', 'strach'], ['sebeved', 'sebevedomi'], ['prokrast', 'prokrastinace'],
  ['perfek', 'perfekcionismus'], ['deleg', 'delegovani'], ['pretiz', 'pretizeni'],
  ['vyhor', 'vyhoreni'], ['web', 'web'], ['napad', 'napad'], ['kouc', 'koucink'],
  ['myslen', 'myslenka'], ['presvedc', 'presvedceni'], ['prezent', 'prezentace'],
  ['komunik', 'komunikace'], ['spirit', 'spiritualita'], ['intuic', 'intuice'],
  ['sebelask', 'sebelaska'], ['sebep', 'sebepoznani'], ['hranic', 'hranice'],
  ['navyk', 'navyk'], ['automat', 'automaticky'], ['behavior', 'behavioralni'],
  ['experiment', 'experiment'],
];

function canonicalizeToken(token) {
  return TOKEN_PREFIXES.find(([prefix]) => token.startsWith(prefix))?.[1] || token;
}

export async function loadKnowledge(path) {
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const record = JSON.parse(line);
      const searchText = [
        record.domain,
        record.section,
        record.topic,
        record.content,
        record.boundary,
        ...(Array.isArray(record.use_when) ? record.use_when : []),
      ].filter(Boolean).join(' ');
      return {
        ...record,
        approved_for_ai: isKnowledgeApproved(record),
        _tokens: new Set(tokenize(searchText)),
        _topicTokens: new Set(tokenize([record.section, record.topic].filter(Boolean).join(' '))),
      };
    });
}

export function retrieveKnowledge(records, query, limit = 5) {
  const queryTokens = tokenize(query);
  const approvedRecords = records.filter(isKnowledgeApproved);
  // An empty query carries no evidence of relevance. Returning the first
  // approved records here used to inject unrelated methodology whenever a
  // member had no saved business context or no active technique yet.
  if (queryTokens.length === 0) return [];

  return approvedRecords
    .map(record => {
      let score = 0;
      for (const token of queryTokens) {
        if (record._topicTokens.has(token)) score += 5;
        if (record._tokens.has(token)) score += 1;
        if (normalize(record.domain).includes(token)) score += 3;
      }
      if (record.source_type === 'elitea_academy_course') {
        score += courseIntentScore(record, normalize(query));
        if (score > 0 && /cvic|postup|tren|zkus|proved|aplik/.test(normalize(query))) {
          if (record.practice_mode === 'guided_practice') score += 2;
          if (record.practice_mode === 'apply_principles') score += 1;
        }
      }
      if (record.source_type === 'everand_practical_tool' && score > 0) {
        if (/cvic|postup|tren|zkus|proved|aplik|jak|co mam|co mám|pomoz/.test(normalize(query))) score += 4;
        if (record.practice_mode === 'guided_practice') score += 2;
      }
      return { record, score };
    })
    // Academy records are numerous and deliberately detailed. One generic
    // topic word is not enough to treat a course item as relevant; without a
    // floor, phrases such as "první krok" could pull in an unrelated Bach
    // emergency scenario solely through the word "první".
    .filter(result => result.score > 0 && (
      result.record.source_type !== 'elitea_academy_course' || result.score >= 8
    ))
    .sort((a, b) => b.score - a.score || a.record.sequence - b.record.sequence)
    .slice(0, limit)
    .map(result => publicKnowledgeMatch(result.record, result.score));
}

export function isKnowledgeApproved(record = {}) {
  if (isPoliticalKnowledge(record)) return false;
  if (record.approved_for_ai === true) return true;
  if (record.approved_for_ai === false) return false;
  if (record.knowledge_role === 'pending_owner_adjudication') return false;
  if (record.source_type === 'owner_decision_register') return false;
  if (record.knowledge_role === 'faithful_course_source_capture') return false;

  const reviewStatus = String(record.review_status || '').toLowerCase();
  if (!reviewStatus) return false;
  if (reviewStatus.includes('pending') || reviewStatus.includes('awaiting')) return false;
  return reviewStatus.startsWith('reviewed')
    || reviewStatus.startsWith('confirmed')
    || reviewStatus.startsWith('approved');
}

export function isPoliticalKnowledge(record = {}) {
  const politicalMetadata = [
    record.domain,
    record.section,
    record.topic,
    ...(Array.isArray(record.safety_tags) ? record.safety_tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

  return /\b(politics|political|politicky|politicke|politicka|politickych|geopolitical|government|vlada|vladni|election|president|leftwing|rightwing|levice|pravice|democrat|republican)\b/u
    .test(politicalMetadata);
}

export function formatKnowledgeContext(matches) {
  if (matches.length === 0) {
    return 'Pro tento dotaz nebyl nalezen konkrétní záznam metodiky Nii. Přiznej omezení a pracuj pouze s bezpečnými obecnými principy.';
  }

  return matches
    .map((match, index) => [
      `ZDROJ ${index + 1}: ${match.source_id}`,
      `Doména: ${match.domain}`,
      `Téma: ${match.topic}`,
      match.course_title ? `Kurz: ${match.course_title}${match.module_title ? ` / ${match.module_title}` : ''}` : '',
      match.practice_mode ? `Způsob použití: ${match.practice_mode}` : '',
      match.boundary ? `Hranice použití: ${match.boundary}` : '',
      match.knowledge_role === 'faithful_course_source_capture'
        ? 'Režim zdroje: Nia tento kurzový názor výslovně schválila jako součást pracovní metodiky Elitea. Použij jeho relevantní princip v praxi, ale nevydávej jej za univerzální vědecký fakt, diagnózu ani garanci výsledku.'
        : '',
      match.source_type === 'everand_practical_tool'
        ? 'Režim knihovny: Kriticky revidovaný praktický nástroj. Použij jej jen tehdy, když sedí na skutečný kontext členky. Nejdřív ověř potřebné vstupy; potom veď pouze jeden aktuální krok, respektuj pojistku, souhlas a možnost zastavit a následně ověř účinek. Nástroj ani knihu člence automaticky nejmenuj.'
        : '',
      match.source_type === 'everand_critical_synthesis'
        ? 'Režim knihovny: Bezpečný odborně korigovaný přínos celé knihy. Je to pracovní syntéza, nikoli univerzální fakt, diagnóza, léčba ani garance.'
        : '',
      match.do_not_use_as?.length ? `Nepoužívat jako: ${match.do_not_use_as.join(', ')}` : '',
      match.safety_tags?.length ? `Bezpečnostní značky: ${match.safety_tags.join(', ')}` : '',
      match.content,
    ].filter(Boolean).join('\n'))
    .join('\n\n---\n\n');
}

function publicKnowledgeMatch(record, score = 0) {
  return {
    source_id: record.source_id,
    domain: record.domain,
    topic: record.topic,
    content: record.content,
    score,
    source_type: record.source_type,
    knowledge_role: record.knowledge_role,
    review_status: record.review_status,
    approved_for_ai: true,
    practice_mode: record.practice_mode || null,
    boundary: record.boundary || '',
    do_not_use_as: Array.isArray(record.do_not_use_as) ? record.do_not_use_as : [],
    safety_tags: Array.isArray(record.safety_tags) ? record.safety_tags : [],
    course_id: record.course_id || null,
    course_title: record.course_title || null,
    module_title: record.module_title || null,
    course_item_id: record.course_item_id || null,
    material_id: record.material_id || null,
  };
}

function courseIntentScore(record, query) {
  const rules = {
    'kbt-koucink-v-praxi': /kbt|kognitiv|automatick.*myslen|myslen.*dukaz|behavioral.*experiment|abc\+?|predpoved.*test|udrzovac.*cykl/,
    'komunikace-v-praxi': /komunik|prezent|asertiv|rozhovor|naslouch|vyjednav|publik|projev|hlas|kamera/,
    'pevna-v-sobe-intensive': /sebeved|sebelask|sebepozn|sebep|vnitrn.*krit|hranic|hodnota.*sebe/,
    'spiritualni-koucink-practice': /spirit|intuic|signature|ritual|budouci.*ja|hodnot.*slad|meditac/,
    'neuroplasticita-practitioner': /neuroplast|navyk|pozornost|soustred|pamet|ucen|mozek|autopilot|self.?talk/,
    'adhd-focus-motivace': /adhd|neurodiver|exekutivn.*funk|hyperakt|poruch.*pozornost|time.?blind|dopamin.*motivac/,
    'bachovy-kvetove-esence': /bach|kvetov.*esenc|esenc.*smes|rescue.?remedy|bachov.*kapk/,
  };
  return rules[record.course_id]?.test(query) ? 16 : 0;
}
