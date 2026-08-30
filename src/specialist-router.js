const MAX_HISTORY = 12;

export const SPECIALIST_REGISTRY = Object.freeze([
  {
    id: 'professional_coach',
    label: 'Profesionální koučka',
    shortLabel: 'Koučink',
    visibleRole: 'coach',
    purpose: 'Vede rozhodování, cíle, hodnoty, perspektivu a změnu bez podsouvání hotových odpovědí.',
  },
  {
    id: 'cbt_guide',
    label: 'KBT informovaná průvodkyně',
    shortLabel: 'KBT přístup',
    visibleRole: 'coach',
    purpose: 'Pracuje s konkrétní situací, automatickou myšlenkou, emocí, chováním a ověřitelným experimentem.',
  },
  {
    id: 'business_strategy',
    label: 'Byznys a strategická mentorka',
    shortLabel: 'Byznys strategie',
    visibleRole: 'mentor',
    purpose: 'Určuje obchodní úzké hrdlo, strategii, nabídku, ekonomiku a nejbližší ověření.',
  },
  {
    id: 'brand_marketing',
    label: 'Brand a marketingová expertka',
    shortLabel: 'Brand & marketing',
    visibleRole: 'brand',
    purpose: 'Řeší positioning, značku, nabídku, kampaně, funnel, reklamu a měření.',
  },
  {
    id: 'content_social',
    label: 'Obsahová a social media expertka',
    shortLabel: 'Obsah & sítě',
    visibleRole: 'brand',
    purpose: 'Převádí strategii do konkrétního obsahu, formátů, distribuce a vyhodnocení.',
  },
  {
    id: 'ai_automation',
    label: 'AI a automatizační expertka',
    shortLabel: 'AI & automatizace',
    visibleRole: 'mentor',
    purpose: 'Navrhuje bezpečné AI workflow, automatizace, nástroje, integrace a kontrolu kvality.',
  },
  {
    id: 'adhd_habits',
    label: 'Návyková a ADHD-friendly mentorka',
    shortLabel: 'ADHD-friendly',
    visibleRole: 'coach',
    purpose: 'Přizpůsobuje strukturu exekutivnímu fungování, pozornosti, energii a realistické kapacitě.',
  },
  {
    id: 'wellbeing_spiritual',
    label: 'Wellbeing & spirituální koučka',
    shortLabel: 'Wellbeing',
    visibleRole: 'coach',
    purpose: 'Podporuje rovnováhu, regeneraci, smysl, tělesné vnímání a dobrovolnou spirituální perspektivu.',
  },
  {
    id: 'psychoeducation',
    label: 'Psychoedukační průvodkyně',
    shortLabel: 'Psychoedukace',
    visibleRole: 'coach',
    purpose: 'Srozumitelně vysvětluje neklinické mechanismy emocí, stresu, návyků a vztahových vzorců.',
  },
  {
    id: 'productivity_coach',
    label: 'Kouč produktivity',
    shortLabel: 'Produktivita',
    visibleRole: 'mentor',
    purpose: 'Pomáhá začít, prioritizovat, dokončovat, pracovat s prokrastinací a dotahovat domluvené kroky.',
  },
]);

const SPECIALISTS = new Map(SPECIALIST_REGISTRY.map(item => [item.id, item]));

const METHOD_LABELS = Object.freeze({
  coaching: 'Koučovací rozhovor',
  cbt: 'KBT-informovaná práce',
  nlp: 'NLP a práce s jazykem',
  somatic: 'Somatická regulace',
  mentoring: 'Odborný mentoring',
  psychoeducation: 'Psychoedukace',
  planning: 'Realistické plánování',
  spiritual: 'Spirituální perspektiva',
});

const EXPLICIT_MODE_ROUTE = Object.freeze({
  koucovaci_hodina: ['professional_coach', 'coaching'],
  nlp_konzultace: ['professional_coach', 'nlp'],
  behavioralni_konzultace: ['cbt_guide', 'cbt'],
  somaticka_konzultace: ['wellbeing_spiritual', 'somatic'],
  mentoringova_konzultace: ['business_strategy', 'mentoring'],
  brand_growth_agent: ['brand_marketing', 'mentoring'],
});

const CONSULTATION_ROUTE = Object.freeze({
  coaching_session: ['professional_coach', 'coaching'],
  nlp_reframing: ['professional_coach', 'nlp'],
  behavioral_change: ['cbt_guide', 'cbt'],
  somatic_regulation: ['wellbeing_spiritual', 'somatic'],
  business_mentoring: ['business_strategy', 'mentoring'],
  brand_growth: ['brand_marketing', 'mentoring'],
});

const RULES = Object.freeze([
  ['professional_coach', /\b(rozhod[\p{L}\p{N}_]*|nev[ií]m co chci|sm[eě]r[\p{L}\p{N}_]*|hodnot[\p{L}\p{N}_]*|sebev[eě]dom[\p{L}\p{N}_]*|hranic[\p{L}\p{N}_]*|vztah[\p{L}\p{N}_]*|zm[eě]n[\p{L}\p{N}_]*|c[ií]l[\p{L}\p{N}_]*|volb[\p{L}\p{N}_]*|dilema[\p{L}\p{N}_]*|chci si ujasnit)/giu],
  ['cbt_guide', /\b(jsem neschopn[\p{L}\p{N}_]*|jsem k ni[cč]emu|automatick[\p{L}\p{N}_]* my[sš]len[\p{L}\p{N}_]*|co si [řr][ií]k[aá]m|d[uů]kaz[\p{L}\p{N}_]*|katastrof[\p{L}\p{N}_]*|vyh[yý]b[\p{L}\p{N}_]*|obav[\p{L}\p{N}_]*|strach[\p{L}\p{N}_]*|styd[\p{L}\p{N}_]*|selh[\p{L}\p{N}_]*|mus[ií]m|nikdy|v[zž]dy[\p{L}\p{N}_]*)/giu],
  ['business_strategy', /\b(byznys[\p{L}\p{N}_]*|podnik[\p{L}\p{N}_]*|nab[ií]dk[\p{L}\p{N}_]*|produkt[\p{L}\p{N}_]*|slu[zž]b[\p{L}\p{N}_]*|cenotvor[\p{L}\p{N}_]*|cen[\p{L}\p{N}_]*|tr[zž]b[\p{L}\p{N}_]*|p[rř][ií]jem[\p{L}\p{N}_]*|zisk[\p{L}\p{N}_]*|klient[\p{L}\p{N}_]*|z[aá]kazn[\p{L}\p{N}_]*|validac[\p{L}\p{N}_]*|prodej[\p{L}\p{N}_]*|strateg[\p{L}\p{N}_]*|cash\s?flow|mar[zž][\p{L}\p{N}_]*)/giu],
  ['brand_marketing', /\b(brand[\p{L}\p{N}_]*|zna[cč]k[\p{L}\p{N}_]*|positioning[\p{L}\p{N}_]*|pozicov[\p{L}\p{N}_]*|marketing[\p{L}\p{N}_]*|reklam[\p{L}\p{N}_]*|kampa[\p{L}\p{N}_]*|funnel[\p{L}\p{N}_]*|prodejn[ií] cesta|lead[\p{L}\p{N}_]*|meta ads|google ads|konverz[\p{L}\p{N}_]*)/giu],
  ['content_social', /\b(obsah[\p{L}\p{N}_]*|content[\p{L}\p{N}_]*|soci[aá]ln[ií] s[ií]t[\p{L}\p{N}_]*|instagram[\p{L}\p{N}_]*|facebook[\p{L}\p{N}_]*|tiktok[\p{L}\p{N}_]*|linkedin[\p{L}\p{N}_]*|reels?[\p{L}\p{N}_]*|post[\p{L}\p{N}_]*|p[rř][ií]sp[eě]v[\p{L}\p{N}_]*|hook[\p{L}\p{N}_]*|newsletter[\p{L}\p{N}_]*|publik[\p{L}\p{N}_]*|dosah[\p{L}\p{N}_]*)/giu],
  ['ai_automation', /\b(um[eě]l[aá] inteligence|ai|automatiz[\p{L}\p{N}_]*|prompt[\p{L}\p{N}_]*|chatgpt|claude|cursor|workflow[\p{L}\p{N}_]*|integrac[\p{L}\p{N}_]*|api|agent[\p{L}\p{N}_]*|zapier|make\.com|n8n)/giu],
  ['adhd_habits', /\b(adhd|pozornost[\p{L}\p{N}_]*|rozptyl[\p{L}\p{N}_]*|p[rř]ep[ií]n[\p{L}\p{N}_]*|time blindness|odhad [cč]asu|hyperfocus[\p{L}\p{N}_]*|exekutivn[\p{L}\p{N}_]*|zahlcen[\p{L}\p{N}_]*|moc krok[uů]|zapom[ií]n[\p{L}\p{N}_]*)/giu],
  ['wellbeing_spiritual', /\b(wellbeing|rovnov[aá]h[\p{L}\p{N}_]*|odpo[cč]in[\p{L}\p{N}_]*|regenerac[\p{L}\p{N}_]*|vyho[rř]en[\p{L}\p{N}_]*|energ[\p{L}\p{N}_]*|vy[cč]erp[\p{L}\p{N}_]*|smysl[\p{L}\p{N}_]*|spiritu[aá]ln[\p{L}\p{N}_]*|intuic[\p{L}\p{N}_]*|meditac[\p{L}\p{N}_]*|t[eě]l[\p{L}\p{N}_]*|nap[eě]t[\p{L}\p{N}_]*|dech[\p{L}\p{N}_]*|hrud[\p{L}\p{N}_]*|tlak.{0,15}(?:hrud|b[rř]i[sš]))/giu],
  ['psychoeducation', /\b(pro[cč](?: se mi|.{0,45}(?:d[eě]je|reag|zamrz))|jak funguje|co se d[eě]je|vysv[eě]tl[\p{L}\p{N}_]*|pochopit (?:sv[eé]|ten|pro[cč])|mechanism[\p{L}\p{N}_]*|emoc[\p{L}\p{N}_]*|stres[\p{L}\p{N}_]*|nervov[aá] soustav[\p{L}\p{N}_]*|vztahov[\p{L}\p{N}_]* vzorec|reakc[\p{L}\p{N}_]*|zamrz[\p{L}\p{N}_]*)/giu],
  ['productivity_coach', /\b(prokrast[\p{L}\p{N}_]*|odkl[aá]d[\p{L}\p{N}_]*|nedokon[\p{L}\p{N}_]*|dokon[cč][\p{L}\p{N}_]*|dod[eě]l[\p{L}\p{N}_]*|nem[uů][zž]u za[cč][ií]t|za[cč][ií]n[\p{L}\p{N}_]*|priorit[\p{L}\p{N}_]*|deadline[\p{L}\p{N}_]*|term[ií]n[\p{L}\p{N}_]*|pracovn[ií] mor[aá]lk[\p{L}\p{N}_]*|discipl[ií]n[\p{L}\p{N}_]*|(?:na)?pl[aá]n[\p{L}\p{N}_]*|dal[sš][ií] krok|nest[ií]h[\p{L}\p{N}_]*)/giu],
]);

const HIGH_SIGNAL_RULES = Object.freeze([
  ['cbt_guide', /\b(jsem neschopn|jsem k ni[cč]emu|v[zž]dy[\p{L}\p{N}_]* (?:v[sš]echno )?(?:pokaz|selh))/iu],
  ['content_social', /\b(newsletter|reels?|p[rř][ií]sp[eě]v|content kalend[aá][řr]|obsahov[ýy] pl[aá]n)\b/iu],
  ['brand_marketing', /\b(meta ads|google ads|positioning|funnel|reklamn[ií] kampa[nň])\b/iu],
  ['ai_automation', /\b(make\.com|n8n|zapier|api integrac|ai agent)\b/iu],
  ['psychoeducation', /\b(pro[cč].{0,45}(?:d[eě]je|reagu|zamrz)|jak funguje|vztahov[ýy] vzorec)\b/iu],
  ['wellbeing_spiritual', /\b(tlak.{0,15}(?:hrud|b[rř]i[sš])|meditac|regenerac|vy[cč]erp)\b/iu],
  ['productivity_coach', /\b(napl[aá]n|dod[eě]l|nedokon|pracovn[ií] discipl[ií]n)\b/iu],
]);

const METHOD_RULES = Object.freeze([
  ['nlp', /\b(nlp|jazyk|p[rř]er[aá]mov|submodal|kotv|meta model|vnit[rř]n[ií] obraz|p[rř]esv[eě]d[cč]en[ií])\b/iu],
  ['cbt', /\b(kbt|automatick[aá] my[sš]len|d[uů]kaz|experiment|situace.{0,35}(my[sš]len|emoce|chov[aá]n))\b/iu],
  ['somatic', /\b(somat|t[eě]lo|dech|nap[eě]t[ií]|uzemn|regulac|nervov[aá] soustav)\b/iu],
  ['psychoeducation', /\b(vysv[eě]tli|jak funguje|pro[cč] se mi|mechanism)\b/iu],
  ['planning', /\b(pl[aá]n|priorit|krok|deadline|dokon[cč]|za[cč][ií]t)\b/iu],
  ['spiritual', /\b(spiritu[aá]ln|intuic|smysl|energie|meditac)\b/iu],
]);

export function specialistById(id) {
  return SPECIALISTS.get(id) || SPECIALISTS.get('professional_coach');
}

export function routeSpecialists({
  messages = [],
  memory = {},
  responseMode = 'diagnostika',
  consultationMode = 'auto',
  previous = null,
} = {}) {
  const safePrevious = sanitizeSpecialistSession(previous);
  const latest = latestUserText(messages);
  const recent = recentUserText(messages, 4);
  const explicit = CONSULTATION_ROUTE[consultationMode] || EXPLICIT_MODE_ROUTE[responseMode] || null;
  const scores = Object.fromEntries(SPECIALIST_REGISTRY.map(item => [item.id, 0]));

  for (const [id, pattern] of RULES) {
    scores[id] += countMatches(latest, pattern) * 4;
    scores[id] += countMatches(recent, pattern);
  }
  for (const [id, pattern] of HIGH_SIGNAL_RULES) {
    if (pattern.test(latest)) scores[id] += 3;
  }
  applyMemoryTieBreakers(scores, memory);

  if (explicit) scores[explicit[0]] += 20;
  if (responseMode === 'podpora_fungovani') scores.productivity_coach += 6;
  if (responseMode === 'podporna_stabilizace') scores.wellbeing_spiritual += 8;

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
  const top = ranked[0];
  const second = ranked[1];
  const latestIsShortContinuation = latest.trim().split(/\s+/).length <= 10;
  const previousPrimary = safePrevious.primaryId;

  let primaryId = explicit?.[0] || top.id;
  if (!explicit && previousPrimary && latestIsShortContinuation && top.score < 8) primaryId = previousPrimary;
  if (!explicit && previousPrimary && top.id !== previousPrimary && top.score < 7) primaryId = previousPrimary;

  const primaryScore = scores[primaryId] || 0;
  const secondScore = second?.id === primaryId ? ranked[2]?.score || 0 : second?.score || 0;
  const ambiguousProductivity = isAmbiguousProductivity(latest, scores, consultationMode);
  const weakSignal = !explicit && primaryScore < 4 && !previousPrimary;
  const closeCandidates = !explicit && primaryScore >= 4 && secondScore >= primaryScore - 1;
  const status = ambiguousProductivity || weakSignal || closeCandidates ? 'clarifying' : 'active';
  const discriminatingQuestion = status === 'clarifying'
    ? buildDiscriminatingQuestion({ latest, scores, primaryId, ranked })
    : '';
  const activeMethod = explicit?.[1] || inferMethod(latest, primaryId, responseMode, memory);
  const secondaryIds = ranked
    .filter(item => item.id !== primaryId && item.score >= Math.max(4, primaryScore - 3))
    .slice(0, 2)
    .map(item => item.id);
  const turns = safePrevious.turns + 1;
  const changed = Boolean(previousPrimary && previousPrimary !== primaryId);
  const confidence = explicit
    ? 0.96
    : clamp(primaryScore <= 0 ? 0.42 : 0.5 + Math.min(primaryScore, 18) / 36 - (status === 'clarifying' ? 0.12 : 0), 0.35, 0.94);
  const evidence = collectEvidence(latest, primaryId);
  const reasons = routeReasons({ primaryId, explicit, evidence, status, changed });
  const historyEntry = {
    turn: turns,
    primaryId,
    activeMethod,
    confidence,
    status,
  };

  return sanitizeSpecialistSession({
    version: 1,
    primaryId,
    secondaryIds,
    activeMethod,
    confidence,
    status,
    reasons,
    evidence,
    missingInformation: discriminatingQuestion ? ['Rozhodující mechanismus ještě není rozlišený.'] : [],
    discriminatingQuestion,
    turns,
    previousPrimaryId: previousPrimary || '',
    changed,
    history: [...safePrevious.history, historyEntry].slice(-MAX_HISTORY),
  });
}

export function sanitizeSpecialistSession(input = {}) {
  const primaryId = SPECIALISTS.has(input?.primaryId) ? input.primaryId : '';
  const secondaryIds = Array.isArray(input?.secondaryIds)
    ? [...new Set(input.secondaryIds.filter(id => SPECIALISTS.has(id) && id !== primaryId))].slice(0, 2)
    : [];
  const method = Object.hasOwn(METHOD_LABELS, input?.activeMethod) ? input.activeMethod : 'coaching';
  return {
    version: 1,
    primaryId,
    secondaryIds,
    activeMethod: method,
    confidence: clamp(Number(input?.confidence) || 0, 0, 1),
    status: input?.status === 'clarifying' ? 'clarifying' : 'active',
    reasons: cleanArray(input?.reasons, 4, 180),
    evidence: cleanArray(input?.evidence, 6, 120),
    missingInformation: cleanArray(input?.missingInformation, 3, 180),
    discriminatingQuestion: cleanText(input?.discriminatingQuestion, 360),
    turns: Math.max(0, Math.min(Number.parseInt(input?.turns, 10) || 0, 10000)),
    previousPrimaryId: SPECIALISTS.has(input?.previousPrimaryId) ? input.previousPrimaryId : '',
    changed: input?.changed === true,
    history: Array.isArray(input?.history)
      ? input.history.slice(-MAX_HISTORY).map(item => ({
        turn: Math.max(0, Number.parseInt(item?.turn, 10) || 0),
        primaryId: SPECIALISTS.has(item?.primaryId) ? item.primaryId : primaryId,
        activeMethod: Object.hasOwn(METHOD_LABELS, item?.activeMethod) ? item.activeMethod : method,
        confidence: clamp(Number(item?.confidence) || 0, 0, 1),
        status: item?.status === 'clarifying' ? 'clarifying' : 'active',
      }))
      : [],
  };
}

export function specialistRouteSummary(session = {}) {
  const safe = sanitizeSpecialistSession(session);
  const primary = specialistById(safe.primaryId);
  return {
    primary: {
      id: primary.id,
      label: primary.label,
      shortLabel: primary.shortLabel,
      visibleRole: primary.visibleRole,
    },
    secondary: safe.secondaryIds.map(id => {
      const item = specialistById(id);
      return { id: item.id, label: item.label, shortLabel: item.shortLabel };
    }),
    method: { id: safe.activeMethod, label: METHOD_LABELS[safe.activeMethod] },
    confidence: safe.confidence,
    status: safe.status,
    changed: safe.changed,
    reason: safe.reasons[0] || '',
    discriminatingQuestion: safe.discriminatingQuestion,
  };
}

export function formatSpecialistContext(session = {}) {
  const safe = sanitizeSpecialistSession(session);
  const primary = specialistById(safe.primaryId);
  const secondary = safe.secondaryIds.map(id => specialistById(id));
  return [
    `Hlavní interní odbornost: ${primary.label} (${primary.purpose})`,
    `Aktivní pracovní přístup: ${METHOD_LABELS[safe.activeMethod]}`,
    secondary.length
      ? `Podpůrné odbornosti, které použij jen když jsou opravdu nutné: ${secondary.map(item => item.label).join(', ')}`
      : 'Podpůrná odbornost: žádná; drž jeden jasný směr.',
    `Jistota směrování: ${safe.confidence.toFixed(2)}; stav: ${safe.status}`,
    safe.changed
      ? `Odbornost se změnila z ${specialistById(safe.previousPrimaryId).label}. Navaž plynule, nevysvětluj technické přepnutí a neopakuj začátek sezení.`
      : 'Pokračuj v jednom souvislém sezení.',
    safe.status === 'clarifying' && safe.discriminatingQuestion
      ? `Než zvolíš intervenci, přirozeně polož tuto jednu rozlišující otázku nebo významově přesný ekvivalent: ${safe.discriminatingQuestion}`
      : 'Směr je dostatečně rozlišený; nezůstávej jen u diagnostických otázek a přines pracovní hodnotu.',
  ].join('\n');
}

function inferMethod(text, primaryId, responseMode, memory) {
  const explicit = EXPLICIT_MODE_ROUTE[responseMode]?.[1];
  if (explicit) return explicit;
  for (const [method, pattern] of METHOD_RULES) if (pattern.test(text)) return method;
  if (primaryId === 'cbt_guide') return 'cbt';
  if (primaryId === 'psychoeducation') return 'psychoeducation';
  if (primaryId === 'productivity_coach' || primaryId === 'adhd_habits') return 'planning';
  if (primaryId === 'wellbeing_spiritual') {
    return memory?.coaching_profile?.spiritual_preference === 'important' ? 'spiritual' : 'somatic';
  }
  if (['business_strategy', 'brand_marketing', 'content_social', 'ai_automation'].includes(primaryId)) return 'mentoring';
  return 'coaching';
}

function applyMemoryTieBreakers(scores, memory) {
  const profile = memory?.coaching_profile || {};
  const focusAreas = Array.isArray(profile.focus_areas) ? profile.focus_areas : [];
  const tieBreaks = {
    business: 'business_strategy',
    brand_marketing: 'brand_marketing',
    content_social: 'content_social',
    ai_automation: 'ai_automation',
    habits_productivity: 'productivity_coach',
    adhd_friendly: 'adhd_habits',
    wellbeing: 'wellbeing_spiritual',
    mindset: 'professional_coach',
  };
  for (const focus of focusAreas) if (tieBreaks[focus]) scores[tieBreaks[focus]] += 0.75;
  if (/adhd|pozornost|mal[eé] kroky|jedna priorita/i.test(profile.support_accommodations || '')) scores.adhd_habits += 1;
  if (profile.spiritual_preference === 'important') scores.wellbeing_spiritual += 0.75;
}

function buildDiscriminatingQuestion({ latest, scores, primaryId, ranked }) {
  if (isAmbiguousProductivity(latest, scores, 'auto')) {
    return 'Když se do toho nepustíš nebo úkol nedokončíš, co bývá nejsilnější: nejasnost, rozptýlení, obava z výsledku, nebo vyčerpání?';
  }
  const contender = ranked.find(item => item.id !== primaryId && item.score > 0)?.id;
  if (new Set([primaryId, contender]).has('professional_coach') && new Set([primaryId, contender]).has('business_strategy')) {
    return 'Potřebuješ teď víc vyřešit, co je odborně správný krok, nebo co ti brání ho udělat, i když ho znáš?';
  }
  if (new Set([primaryId, contender]).has('cbt_guide') && new Set([primaryId, contender]).has('psychoeducation')) {
    return 'Chceš nejdřív pochopit, proč se ta reakce děje, nebo rovnou pracovat s konkrétní myšlenkou a chováním v poslední situaci?';
  }
  return 'Co by pro tebe na konci této práce bylo nejcennější: ujasnit si směr, pochopit mechanismus, nebo odejít s konkrétním postupem?';
}

function isAmbiguousProductivity(text, scores, consultationMode) {
  if (consultationMode !== 'auto') return false;
  const productivity = /\b(prokrast|odkl[aá]d|nedokon[cč]|dokon[cč]|nem[uů][zž]u za[cč][ií]t|nest[ií]h|zahlcen)\w*\b/iu.test(text);
  const mechanismKnown = /\b(adhd|rozptyl|strach|styd|perfekcion|vy[cč]erp|energie|nev[ií]m jak|nejasn)\w*\b/iu.test(text);
  return productivity && !mechanismKnown && Math.max(scores.productivity_coach, scores.adhd_habits, scores.cbt_guide, scores.wellbeing_spiritual) > 0;
}

function collectEvidence(text, primaryId) {
  const rule = RULES.find(([id]) => id === primaryId);
  if (!rule) return [];
  const pattern = new RegExp(rule[1].source, rule[1].flags);
  return [...String(text || '').matchAll(pattern)].map(match => match[0]).slice(0, 6);
}

function routeReasons({ primaryId, explicit, evidence, status, changed }) {
  if (explicit) return ['Členka zvolila konkrétní pracovní režim.'];
  if (changed) return [`Aktuální vstup nově odpovídá odbornosti ${specialistById(primaryId).shortLabel}.`];
  if (evidence.length) return [`Aktuální vstup obsahuje signály pro ${specialistById(primaryId).shortLabel}.`];
  if (status === 'clarifying') return ['Zadání zatím nerozlišuje rozhodující mechanismus.'];
  return [`Kontinuita sezení zůstává u odbornosti ${specialistById(primaryId).shortLabel}.`];
}

function latestUserText(messages) {
  return [...(Array.isArray(messages) ? messages : [])].reverse().find(message => message?.role === 'user')?.content || '';
}

function recentUserText(messages, limit) {
  return (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'user')
    .slice(-limit)
    .map(message => message.content || '')
    .join('\n');
}

function countMatches(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...String(text || '').matchAll(new RegExp(pattern.source, flags))].length;
}

function cleanArray(value, maxItems, maxLength) {
  return Array.isArray(value) ? value.map(item => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems) : [];
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
