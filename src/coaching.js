import { readFile } from 'node:fs/promises';

const CRISIS_WORDS = ['ublížit si', 'si ublížit', 'ublížím si', 'sebevraž', 'nechci žít', 'ohrožení'];

export async function loadCoachingMethods(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Registr koučovacích metod je prázdný.');
  }
  return parsed.map(validateMethod);
}

export async function loadExpertSources(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Registr odborných zdrojů je prázdný.');
  }
  const sources = parsed.map(validateSource);
  if (new Set(sources.map(source => source.id)).size !== sources.length) {
    throw new Error('Registr odborných zdrojů obsahuje duplicitní ID.');
  }
  return sources;
}

export function validateMethodSources(methods, sources) {
  const sourceIds = new Set(sources.map(source => source.id));
  for (const method of methods) {
    for (const sourceId of method.evidence.source_ids) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`Metoda ${method.id} odkazuje na neznámý zdroj ${sourceId}.`);
      }
    }
  }
  return true;
}

export function selectExpertSources(sources, method, responseMode) {
  const requested = new Set(method?.evidence?.source_ids || []);
  requested.add('ICF-CORE-2025');
  requested.add('ICF-ETHICS-2025');
  requested.add('ICF-REFERRAL');
  if (responseMode === 'mentoring' || responseMode === 'mentoringova_konzultace' || responseMode === 'rychle_reseni') {
    for (const source of sources.filter(item => item.usage === 'business_core')) requested.add(source.id);
  }
  if (responseMode === 'nlp_konzultace' || method?.id?.startsWith('nlp_')) requested.add('NLP-SR-2012');
  return [...requested]
    .map(id => sources.find(source => source.id === id))
    .filter(Boolean)
    .slice(0, 8);
}

export function formatSourceContext(sources) {
  if (!sources.length) return 'Pro tento vstup nebyly vybrány odborné zdroje. Neuváděj odborné tvrzení bez podkladu.';
  return sources.map(source => [
    `[${source.id}] ${source.title} (${source.year}; ${source.source_type}; autorita ${source.authority})`,
    `URL: ${source.url}`,
    `Podporuje: ${source.supports.join(', ')}`,
    `Omezení: ${source.limitations}`,
  ].join('\n')).join('\n\n');
}

export function selectCoachingMethod(methods, text = '', memory = {}, responseMode = '') {
  const normalized = normalize(text);
  if (!normalized || CRISIS_WORDS.some(word => normalized.includes(normalize(word)))) return null;

  if (responseMode === 'podpora_fungovani') {
    const preferredId = /depres/.test(normalized)
      ? 'depression_functioning_support'
      : /vyhor/.test(normalized)
        ? 'burnout_functioning_support'
        : /uzkost/.test(normalized)
          ? 'anxiety_functioning_support'
          : /trauma|posttraumat/.test(normalized)
            ? 'trauma_informed_support'
            : /nemoc|diagnoz|lecb/.test(normalized)
              ? 'illness_support_coaching'
              : null;
    const preferred = methods.find(method => method.id === preferredId);
    if (preferred) return preferred;
  }

  const lockedModeDefaults = {
    nlp_konzultace: 'nlp_outcome_frame',
    somaticka_konzultace: 'grounding',
  };
  if (lockedModeDefaults[responseMode]) {
    const locked = methods.find(method => method.id === lockedModeDefaults[responseMode]);
    if (locked) return locked;
  }

  const profileText = [
    memory?.coaching_profile?.main_obstacle,
    memory?.coaching_profile?.support_style,
    memory?.current_goal,
  ].filter(Boolean).join(' ');
  const profileCorpus = normalize(profileText);

  const ranked = methods.map(method => {
    const primaryScore = method.signals.reduce((sum, signal) => {
      const key = normalize(signal);
      return sum + (normalized.includes(key) ? Math.max(2, key.split(' ').length * 2) : 0);
    }, 0);
    const contextBoost = method.signals.some(signal => profileCorpus.includes(normalize(signal))) ? 0.25 : 0;
    return { ...method, primaryScore, score: primaryScore + contextBoost };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  if (ranked[0]?.primaryScore > 0) return ranked[0];
  const modeDefaults = {
    koucovaci_hodina: 'grow',
    mentoringova_konzultace: 'grow',
    nlp_konzultace: 'nlp_outcome_frame',
    behavioralni_konzultace: 'woop',
    somaticka_konzultace: 'grounding',
  };
  const preferred = methods.find(method => method.id === modeDefaults[responseMode]);
  return preferred || methods.find(method => method.id === 'grow') || methods[0];
}

export function formatMethodContext(method) {
  if (!method) return 'Nebyla vybrána žádná metoda. Nejdřív zhodnoť bezpečnost a potřebný kontext.';
  return [
    `Metoda: ${method.name} (${method.id}, úroveň ${method.tier})`,
    `Účel: ${method.purpose}`,
    `Postup: ${method.steps.join(' → ')}`,
    `Nepoužívat nebo zastavit při: ${method.avoid.join('; ')}`,
    `Kontrola kvality: ${method.quality_check}`,
    `Důkazní profil: ${method.evidence.grade} — ${method.evidence.summary}`,
    `Omezení důkazů: ${method.evidence.limits}`,
    `Zdrojová ID pro interní audit: ${method.evidence.source_ids.join(', ')}`,
    'Použij ji pouze tehdy, pokud odpovídá skutečné potřebě členky. Pokud chybí kontext, nejdřív se doptávej. Název metody nemusíš člence sdělovat.',
    'Sílu důkazů nikdy nenadsazuj. Zdroj podporující princip není automaticky důkazem účinnosti této přesné AI adaptace.',
  ].join('\n');
}

function validateMethod(method, index) {
  const requiredStrings = ['id', 'name', 'tier', 'purpose', 'quality_check'];
  for (const key of requiredStrings) {
    if (typeof method?.[key] !== 'string' || !method[key].trim()) {
      throw new Error(`Neplatná metoda na pozici ${index}: ${key}`);
    }
  }
  for (const key of ['signals', 'avoid', 'steps']) {
    if (!Array.isArray(method[key]) || method[key].some(value => typeof value !== 'string')) {
      throw new Error(`Neplatná metoda ${method.id}: ${key}`);
    }
  }
  if (!method.evidence || !['strong', 'moderate', 'limited'].includes(method.evidence.grade)) {
    throw new Error(`Neplatná metoda ${method.id}: evidence.grade`);
  }
  if (!Array.isArray(method.evidence.source_ids) || method.evidence.source_ids.length === 0) {
    throw new Error(`Neplatná metoda ${method.id}: evidence.source_ids`);
  }
  for (const key of ['summary', 'limits']) {
    if (typeof method.evidence[key] !== 'string' || !method.evidence[key].trim()) {
      throw new Error(`Neplatná metoda ${method.id}: evidence.${key}`);
    }
  }
  return method;
}

function validateSource(source, index) {
  for (const key of ['id', 'domain', 'title', 'authors_or_org', 'url', 'source_type', 'authority', 'limitations', 'usage']) {
    if (typeof source?.[key] !== 'string' || !source[key].trim()) {
      throw new Error(`Neplatný odborný zdroj na pozici ${index}: ${key}`);
    }
  }
  if (!Number.isInteger(source.year) || !Array.isArray(source.supports) || source.supports.length === 0) {
    throw new Error(`Neplatný odborný zdroj ${source.id}: rok nebo supports`);
  }
  return source;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
