const VISUAL_TYPES = new Set(['process', 'cycle', 'comparison', 'funnel', 'journey', 'metrics']);
const VISUAL_ORIGINS = new Set(['authored', 'content-derived']);

const KIND_TITLES = Object.freeze({
  overview: 'Mapa modulu',
  lesson: 'Mapa principu',
  'self-practice': 'Mapa praktického nácviku',
  'client-practice': 'Mapa profesní situace',
  practice: 'Mapa praktického nácviku',
  quiz: 'Mapa ověřovaných témat',
});

export function extractCourseVisual(markdown = '') {
  const source = String(markdown || '');
  const match = source.match(/<!--\s*elitea-visual:\s*([\s\S]*?)\s*-->/i);
  if (!match) return { markdown: source, visual: null };
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new Error('Animovaný výklad lekce nemá platný JSON.');
  }
  const visual = sanitizeCourseVisual({ ...parsed, origin: 'authored' });
  return { markdown: source.replace(match[0], '').trim(), visual };
}

export function buildCourseVisual(item = {}, context = {}) {
  const kind = normalizedKind(item.kind);
  const title = kind === 'quiz'
    ? cleanModuleTitle(context.moduleTitle) || 'Ověření modulu'
    : cleanItemTitle(item.title) || 'Praktická část';
  return sanitizeCourseVisual({
    type: selectVisualType(item, context),
    title: `${KIND_TITLES[kind] || KIND_TITLES.lesson} · ${title}`,
    caption: visualCaption(kind, title, context),
    items: kind === 'quiz'
      ? quizVisualItems(item, context)
      : contentVisualItems(item, context, kind),
    origin: 'content-derived',
  });
}

export function ensureCourseVisual(item = {}, context = {}) {
  if (item.visual) return sanitizeCourseVisual({ ...item.visual, origin: item.visual.origin || 'authored' });
  return buildCourseVisual(item, context);
}

export function courseVisualCoverage(modules = []) {
  const items = modules.flatMap(module => module.items || []);
  const visuals = items.map(item => item.visual).filter(Boolean);
  const types = Object.fromEntries(courseVisualTypes().map(type => [type, visuals.filter(visual => visual.type === type).length]));
  return {
    standardVersion: 2,
    itemCount: items.length,
    visualCount: visuals.length,
    coveragePercent: items.length ? Number((visuals.length / items.length * 100).toFixed(2)) : 0,
    authoredCount: visuals.filter(visual => visual.origin === 'authored').length,
    contentDerivedCount: visuals.filter(visual => visual.origin === 'content-derived').length,
    types,
    complete: items.length > 0 && visuals.length === items.length,
  };
}

export function sanitizeCourseVisual(input = {}) {
  const type = VISUAL_TYPES.has(input?.type) ? input.type : '';
  const title = clean(input?.title, 120);
  const caption = clean(input?.caption, 280);
  const items = Array.isArray(input?.items)
    ? input.items.slice(0, 7).map(item => ({
      label: clean(item?.label, 90),
      detail: clean(item?.detail, 180),
    })).filter(item => item.label && item.detail)
    : [];
  const origin = VISUAL_ORIGINS.has(input?.origin) ? input.origin : 'authored';
  if (!type || !title || !caption || items.length < 3) {
    throw new Error('Animovaný výklad potřebuje podporovaný typ, název, popis a nejméně tři smysluplné body.');
  }
  return { type, title, caption, items, origin };
}

export function courseVisualTypes() {
  return [...VISUAL_TYPES];
}

function contentVisualItems(item, context, kind) {
  const signals = extractContentSignals(item.markdown);
  const moduleTitle = cleanModuleTitle(context.moduleTitle);
  const topic = cleanItemTitle(item.title) || moduleTitle || 'tuto část';
  const frames = {
    overview: [
      ['Směr modulu', /cíl|směr|výsledek|proč|odnes/iu, `Ujasni si, kam modul „${moduleTitle || topic}“ vede a jaký výsledek má přinést.`],
      ['Klíčové rozlišení', /rozliš|rozdíl|odděl|hran/iu, 'Odděl hlavní princip od zkratek a předpokladů, které by mohly změnit rozhodnutí.'],
      ['Praktický výstup', /výstup|portfolio|důkaz|vytvoř|napiš/iu, 'Převeď rámec do konkrétního výstupu, který lze zkontrolovat a později znovu použít.'],
      ['Ověření', /ověř|kontrol|měř|poznáš|hotov/iu, 'Na konci dolož, podle čeho poznáš, že výsledek opravdu odpovídá zadání.'],
    ],
    lesson: [
      ['Jádro principu', /princip|znamená|základ|smysl|fung/iu, `Pojmenuj vlastními slovy, co téma „${topic}“ skutečně znamená.`],
      ['Rozhodovací detail', /rozliš|rozdíl|rizik|podmín|zálež|kontext/iu, 'Všimni si podmínky nebo rozdílu, který rozhoduje o správném použití.'],
      ['Příklad v praxi', /příklad|například|situac|praxi|klient|tým/iu, 'Přenes princip do jedné konkrétní situace místo obecného souhlasu.'],
      ['Přenos do jednání', /výstup|mikroúkol|úkol|vyzkouš|napiš|vytvoř|přenos/iu, 'Vytvoř malý pozorovatelný krok a stanov důkaz, podle kterého jej vyhodnotíš.'],
    ],
    'self-practice': [
      ['Zadání', /zadání|nahraj|napiš|vytvoř|zvol|vyber|proveď/iu, 'Vyber konkrétní situaci a jasně pojmenuj výsledek tohoto nácviku.'],
      ['Postup', /postup|nejprve|potom|krok|minut/iu, 'Postupuj po jednom kroku, aby bylo zřejmé, která změna měla vliv.'],
      ['Důkaz', /důkaz|portfolio|záznam|ulož|výstup/iu, 'Ulož pozorovatelný výstup, ne pouze dojem, že je cvičení hotové.'],
      ['Kontrola', /kontrol|ověř|hotov|kritéri|vyhodno/iu, 'Porovnej výsledek se zadáním a urči jedinou smysluplnou opravu.'],
    ],
    'client-practice': [
      ['Kontext situace', /situac|kontext|scénář|zvol|modelov/iu, 'Ukotvi rozhovor v konkrétní roli, vztahu a cíli otevřené části.'],
      ['Tvoje role', /role|veď|reaguj|odpověz|student|kouč|lekt/iu, 'Zůstaň v roli, kterou kurz právě trénuje, a nevyměň výkon za vysvětlování.'],
      ['Pozorovatelný výkon', /výkon|pokus|rozhovor|zásah|větu|otázk/iu, 'Proveď celý pokus a zachyť vlastní skutečné věty nebo rozhodnutí.'],
      ['Debrief a nový pokus', /debrief|zpětn|opravu|opakuj|druh|vyhodno/iu, 'Vyber jednu opravu s největším dopadem a ověř ji ve srovnatelném druhém kole.'],
    ],
    practice: [
      ['Výchozí situace', /situac|kontext|problém|výchoz/iu, `Pojmenuj konkrétní výchozí stav pro část „${topic}“.`],
      ['Pracovní krok', /krok|postup|proveď|vytvoř|napiš/iu, 'Proveď nejmenší krok, který vytvoří skutečný a zkontrolovatelný výstup.'],
      ['Důkaz', /důkaz|výstup|záznam|portfolio/iu, 'Zachyť, co přesně vzniklo a co zůstává pouze hypotézou.'],
      ['Další rozhodnutí', /kontrol|vyhodno|pokrač|uprav|zastav/iu, 'Podle výsledku vědomě zvol pokračovat, upravit, nebo zastavit.'],
    ],
  }[kind] || [];

  const used = new Set();
  return frames.map(([label, pattern, fallback]) => ({
    label,
    detail: chooseSignal(signals, pattern, used) || fallback,
  }));
}

function quizVisualItems(item, context) {
  const prompts = Array.isArray(item?.quiz?.questions)
    ? item.quiz.questions.map(question => cleanQuestionPrompt(question.prompt)).filter(Boolean)
    : [];
  const moduleTitle = cleanModuleTitle(context.moduleTitle) || 'otevřeného modulu';
  const items = prompts.slice(0, 4).map((prompt, index) => ({
    label: `Téma ${String(index + 1).padStart(2, '0')}`,
    detail: prompt.length >= 20 ? prompt : `${prompt} Vysvětli vlastními slovy.`,
  }));
  const fallbacks = [
    ['Vybavení', `Vybav si principy modulu „${moduleTitle}“ bez nahlížení do lekce.`],
    ['Rozlišení', 'U každé otázky rozliš doložený princip od přesvědčivě znějící zkratky.'],
    ['Volba', 'Zvol odpověď podle významu učiva, ne podle podobnosti jednotlivých slov.'],
    ['Ověření', 'Po serverovém vyhodnocení se vrať jen k tématům, která potřebují nový pokus.'],
  ];
  for (const fallback of fallbacks) {
    if (items.length >= 4) break;
    items.push({ label: fallback[0], detail: fallback[1] });
  }
  return items;
}

function extractContentSignals(markdown = '') {
  const source = String(markdown || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ');
  const labeled = [...source.matchAll(/\*\*([^*\n]{2,64})\*\*\s*:?[ \t]*([^\n]{24,})/gu)]
    .map(match => ({
      label: clean(match[1].replace(/:\s*$/, ''), 64),
      detail: cleanPlainText(match[2]),
    }))
    .filter(signal => signal.detail.length >= 24);
  const numbered = source.split('\n')
    .map(line => line.match(/^\s*(?:\d+[.)]|[-•])\s+(.{24,})$/u)?.[1])
    .filter(Boolean)
    .map(detail => ({ label: '', detail: cleanPlainText(detail) }))
    .filter(signal => signal.detail.length >= 24);
  const plain = cleanPlainText(source, 12000);
  const sentences = (plain.match(/[^.!?\n]{24,}[.!?]?/gu) || [])
    .map(detail => ({ label: '', detail: clean(detail, 180) }))
    .filter(signal => signal.detail.length >= 24);
  return dedupeSignals([...labeled, ...numbered, ...sentences]);
}

function chooseSignal(signals, pattern, used) {
  const matching = signals.find(signal => !used.has(signal.detail) && pattern.test(`${signal.label} ${signal.detail}`));
  const fallback = matching || signals.find(signal => !used.has(signal.detail));
  if (!fallback) return '';
  used.add(fallback.detail);
  return fallback.detail;
}

function dedupeSignals(signals) {
  const seen = new Set();
  return signals.filter(signal => {
    const key = signal.detail.toLocaleLowerCase('cs-CZ').replace(/[^\p{L}\p{N}]+/gu, ' ').slice(0, 100);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectVisualType(item, context) {
  const kind = normalizedKind(item.kind);
  if (kind === 'quiz') return 'metrics';
  if (kind === 'overview') return 'journey';
  const seed = stableHash(`${context.courseId || ''}:${context.moduleIndex || 0}:${item.id || item.title || ''}`);
  if (kind === 'self-practice' || kind === 'practice') return ['process', 'journey', 'metrics'][seed % 3];
  if (kind === 'client-practice') return ['cycle', 'journey', 'comparison'][seed % 3];
  const cue = clean(`${item.title || ''} ${String(item.markdown || '').slice(0, 420)}`, 620).toLocaleLowerCase('cs-CZ');
  if (/srovn|rozdíl|versus|oproti|dvě cesty|dve cesty/u.test(cue)) return 'comparison';
  if (/cykl|smyčk|opak|iterac|návrat|navrat/u.test(cue)) return 'cycle';
  if (/priorit|hierarch|zúž|zuz|funnel|konverz/u.test(cue)) return 'funnel';
  if (/měř|mer|metrik|skóre|skore|baseline|výsled|vysled/u.test(cue)) return 'metrics';
  if (/cesta|fáz|faz|postup|od .{2,50} k /u.test(cue)) return 'journey';
  return ['process', 'comparison', 'cycle', 'funnel', 'journey', 'metrics'][seed % 6];
}

function visualCaption(kind, title, context) {
  const moduleTitle = cleanModuleTitle(context.moduleTitle);
  const courseTitle = clean(context.courseTitle, 90);
  const courseLead = courseTitle ? `V programu „${courseTitle}“ ` : '';
  if (kind === 'quiz') return `${courseLead}bezpečný přehled témat z modulu „${title}“. Mapa nikdy neukazuje správné odpovědi; pomáhá pouze vybavit, co máš samostatně ověřit.`;
  if (kind === 'client-practice') return `${courseLead}převod části „${title}“ do skutečné profesní situace: od kontextu přes výkon až k důkaznému debriefu a novému pokusu.`;
  if (kind === 'self-practice' || kind === 'practice') return `${courseLead}pracovní mapa části „${title}“ drží zadání, provedení, důkaz a kontrolu v jednom přehledném toku.`;
  if (kind === 'overview') return `${courseLead}orientace v modulu „${moduleTitle || title}“: co je podstatné, co má vzniknout a podle čeho poznáš dokončenou práci.`;
  return `${courseLead}vizuální mapa části „${title}“ ukazuje jádro principu, rozhodovací detail, praktický příklad a přenos do jednání.`;
}

function cleanQuestionPrompt(value = '') {
  return cleanPlainText(String(value).replace(/\*\*[^*]+\*\*/g, ' '), 180)
    .replace(/^\d+[.)]\s*/u, '')
    .trim();
}

function cleanPlainText(value = '', max = 180) {
  return clean(String(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_`~|]/g, ' ')
    .replace(/\s+/g, ' '), max);
}

function cleanItemTitle(value = '') {
  return clean(String(value)
    .replace(/^(?:Lekce|Praktická laboratoř|Profesní aplikace|Test modulu)\s+[\d.]+\s*[—–-]?\s*/iu, ''), 82);
}

function cleanModuleTitle(value = '') {
  return clean(String(value)
    .replace(/^(?:MODUL\s+\d+|ÚVODNÍ PROFESNÍ MODUL|ZÁVĚREČNÉ PRAKTIKUM|CERTIFIKAČNÍ ZKOUŠKA)\s*[—–-]?\s*/iu, '')
    .toLocaleLowerCase('cs-CZ'), 90);
}

function normalizedKind(value = '') {
  return ['overview', 'lesson', 'self-practice', 'client-practice', 'practice', 'quiz'].includes(value) ? value : 'lesson';
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clean(value, max) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  const clipped = normalized.slice(0, max + 1);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary >= Math.floor(max * .72) ? boundary : max).replace(/[,:;–—-]+$/u, '')}…`;
}
