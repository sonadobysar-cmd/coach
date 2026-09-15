function normalizeFactText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const QUANTITY_SOURCE = '(?:\\d+(?:[,.]\\d+)?|nula|jeden|jedna|jedno|dva|dve|tri|ctyri|pet|sest|sedm|osm|devet|deset|jedenact|dvanact|trinact|ctrnact|patnact|dvacet|tricet|ctyricet|padesat|sto|polovina|ctvrtina)';

export function factSemanticKeys(value) {
  const stop = new Set([
    'aby', 'ale', 'ani', 'byl', 'byla', 'bylo', 'byli', 'byly', 'bol', 'bola', 'bolo', 'boli',
    'co', 'toto', 'to', 'se', 'sa', 'kolik', 'kolko', 'jaky', 'jaka', 'ake', 'aky', 'jak', 'ako',
    'jestli', 'zda', 'ci', 'vime', 'vieme', 'zatim', 'zatial', 'jen', 'pouze', 'dolozena',
    'fakta', 'udaje', 'skutecnosti', 'jedna', 'jeden', 'jedno', 'dve', 'dva', 'tri', 'ktere',
    'ktore', 'kterych', 'ktorych', 'nich', 'tam', 'ten', 'tento', 'tahle',
  ]);
  return new Set(normalizeFactText(value)
    .split(/[^a-z0-9]+/u)
    .filter(token => token.length >= 3 && !stop.has(token) && !/^\d+$/u.test(token))
    .map(token => {
      if (/^(?:prihlas|registrov)/u.test(token)) return 'registered';
      if (/^(?:zustal|zostal)/u.test(token)) return 'stayed';
      if (/^navstev/u.test(token)) return 'visitors';
      if (/^(?:klik|proklik)/u.test(token)) return 'clicks';
      if (/^(?:nakup|objednav)/u.test(token)) return 'purchases';
      if (/^(?:trzb|obrat|prijem|vynos)/u.test(token)) return 'revenue';
      if (/^(?:vysled|dopad|ziskal|pomohl|prodej)/u.test(token)) return 'outcome';
      if (/^(?:reakc|reag)/u.test(token)) return 'reactions';
      if (/^(?:odes|odis|odchod|opust)/u.test(token)) return 'departure';
      if (/^(?:proc|preco|duvod|dovod|pricin)/u.test(token)) return 'reason';
      if (/^(?:zen|zena|ucastnic|lide|lidi|osob)/u.test(token)) return 'participants';
      if (/^klient/u.test(token)) return 'clients';
      return token.slice(0, 8);
    }));
}

export function factProperEntities(value) {
  const ignored = new Set([
    'První', 'Prvy', 'Druhý', 'Druhy', 'Třetí', 'Treti', 'Přihlásily', 'Prihlasili',
    'Dvě', 'Dve', 'Jedna', 'Jeden', 'Nevím', 'Neviem', 'Výsledkem', 'Vysledkom',
    'Oprava', 'Správně', 'Spravne', 'Doložená', 'Dolozena', 'Fakta',
    'Byl', 'Byla', 'Bylo', 'Byli', 'Byly', 'Bol', 'Bola', 'Bolo', 'Boli',
  ]);
  return [...new Set((String(value || '').match(/\b\p{Lu}\p{Ll}{2,}\b/gu) || [])
    .filter(token => !ignored.has(token))
    .map(token => normalizeFactText(token)))];
}

export function factEvents(value) {
  return [...new Set(normalizeFactText(value)
    .match(/\b(?:prvn|druh|tret|ctvrt|pat)\w*\s+(?:workshop|seminar|kampan|beh|setkani|akce)\w*\b/gu) || [])];
}

export function extractFactQuantity(value) {
  return normalizeFactText(value).match(new RegExp(`\\b${QUANTITY_SOURCE}\\b`, 'u'))?.[0] || '';
}

export function extractFactMoney(value) {
  return normalizeFactText(value).match(/\b\d+(?:[ ,.\u00a0]\d+)*(?:[,.]\d+)?\s*(?:kc|eur|euro|€|czk)\b/u)?.[0] || '';
}

function extractReplacedFactQuantities(value) {
  const normalized = normalizeFactText(value);
  const matches = normalized.matchAll(new RegExp(`\\b(?:ne|nikoli|nie|namiesto|misto|nebyl|nebyla|nebylo|nebol|nebola|nebolo)\\s+(${QUANTITY_SOURCE})\\b`, 'gu'));
  return [...new Set([...matches].map(match => match[1]))];
}

export function isFactCorrection(value) {
  return new RegExp(`^(?:oprava|upresneni|spravne|ve skutecnosti)\\b|^ne\\s*[,;:]|\\b(?:ne|nikoli|nie|misto|namiesto)\\s+${QUANTITY_SOURCE}\\b`, 'u')
    .test(normalizeFactText(value));
}

export function containsUnsafeFactInstruction(value) {
  const normalized = normalizeFactText(value);
  return /\b(?:odted|odteraz)\b[^.!?]{0,100}\b(?:ignoruj|zapomen|obchazej|nedodrzuj|uvadej|odpovez|napis|rekni)\w*\b/u.test(normalized)
    || /(?:^|[.!;]\s*)(?:ignoruj|zapomen|obchazej|nedodrzuj|predstirej|hraj\s+roli|zmen\s+roli|uvadej|odpovez|napis\s*[,;:]?\s+ze|rekni\s*[,;:]?\s+ze)\w*\b/u.test(normalized)
    || /\b(?:systemov|vyvojarsk|developersk)\w*\s+(?:zprava|sprava|instrukc|prompt)|\b(?:system|developer|assistant)\s*:/u.test(normalized)
    || /\b(?:ignoruj|obchazej|nedodrzuj)\w*\b[^.!?]{0,70}\b(?:pravidl|instrukc|prompt|system)\w*\b/u.test(normalized);
}

function splitSafeFactClauses(value) {
  const sentences = String(value || '')
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map(part => part.trim())
    .filter(part => part && !/[?？]/u.test(part));
  const clauses = [];
  for (const rawSentence of sentences) {
    const sentence = rawSentence
      .replace(/^(?:bohužel|bohuzel|naštěstí|nastesti|podle mě|podla mna)\s*[,—-]?\s*/iu, '')
      .split(/,?\s+(?:což|coz|takže|takze|a\s+to\s+(?:znamená|znamena|dokazuje|potvrzuje))\b/iu)[0]
      .trim();
    if (!sentence) continue;
    const cause = sentence.match(/^(.*?)(?:,?\s+)(protože|pretože|jelikož|jelikoz|keďže|kedze|lebo|kvůli|kvuli|kvoli|z\s+důvodu|z\s+duvodu|z\s+dôvodu|z\s+dovodu)\s+(.+)$/iu);
    const unknownContrast = !cause
      ? sentence.match(/^(.*?)(?:,?\s+(?:ale|avšak|avsak|však|vsak))\s+(.+)$/iu)
      : null;
    const hasUnknownContrast = Boolean(unknownContrast
      && /\b(?:nevim|nevime|neviem|nevieme|neznam|nezname|nepoznam|nepozname)\b/u.test(normalizeFactText(unknownContrast[2])));
    const factualPart = cause ? cause[1] : hasUnknownContrast ? unknownContrast[1] : sentence;
    const reasonPart = cause ? cause[3] : '';
    factualPart
      .split(/,?\s+(?:ale|avšak|avsak|však|vsak|zatímco|zatialco)\s+|\s+a\s+(?=(?:\p{Lu}\p{Ll}{2,}|jeden|jedna|jedno|dva|dvě|dve|tři|tri|\d+|získal|ziskal|odešel|odesel|odešla|odesla|odišiel|odisiel|odišla|odisla|zůstal|zustal|zostal|klikl|nakoupil|tržba|trzba|výsledek|vysledek)\b)/iu)
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(text => clauses.push({ kind: 'fact', text }));
    if (reasonPart) clauses.push({ kind: 'reason', text: reasonPart.trim(), reasonLead: factualPart.trim() });
    if (hasUnknownContrast) clauses.push({ kind: 'unknown_reason', text: unknownContrast[2].trim(), reasonLead: unknownContrast[1].trim() });
  }
  return clauses;
}

function setsOverlap(left, right) {
  return [...left].some(value => right.has(value));
}

function compatibleIdentity(left, right) {
  if (left.entities.length && right.entities.length && !left.entities.some(entity => right.entities.includes(entity))) return false;
  if (left.events.length && right.events.length && !left.events.some(event => right.events.includes(event))) return false;
  return true;
}

function applyFactCorrectionSupersession(records) {
  records.forEach((record, index) => {
    if (!record.correction) return;
    const candidates = records.slice(0, index).filter(candidate => !candidate.superseded
      && compatibleIdentity(record, candidate)
      && (!record.quantity || Boolean(candidate.quantity))
      && (!record.money || Boolean(candidate.money)));
    const scoped = candidates.filter(candidate => setsOverlap(record.keys, candidate.keys));
    const explicitlyReplaced = candidates.filter(candidate => candidate.quantity
      && record.replacedQuantities.includes(candidate.quantity));
    if (scoped.length) {
      [...new Set([...scoped, ...explicitlyReplaced])].forEach(candidate => { candidate.superseded = true; });
    } else if (explicitlyReplaced.length) {
      explicitlyReplaced.sort((left, right) => right.sourceIndex - left.sourceIndex || right.clauseIndex - left.clauseIndex)[0].superseded = true;
    }
  });
}

export function buildFactRecapEvidenceRecords(sources = [], { acceptStatement = () => true } = {}) {
  const records = [];
  sources.forEach((source, sourceIndex) => {
    const original = String(source?.text ?? source ?? '').replace(/\s+/gu, ' ').trim();
    if (!original || !acceptStatement(original)) return;
    const correction = Boolean(source?.correction) || isFactCorrection(original);
    const cleaned = original
      .replace(/^(?:oprava|upřesnění|upresneni|správně|spravne|ve skutečnosti|ve skutecnosti)\s*[:—-]?\s*/iu, '')
      .replace(/^ne\s*[,;:]\s*/iu, '')
      .trim();
    const statementKeys = factSemanticKeys(cleaned);
    const statementEntities = factProperEntities(cleaned);
    const statementEvents = factEvents(cleaned);
    const replacedQuantities = extractReplacedFactQuantities(cleaned);
    splitSafeFactClauses(cleaned).forEach((clause, clauseIndex) => {
      const text = clause.text.replace(/\s+/gu, ' ').trim();
      if (!text || containsUnsafeFactInstruction(text)) return;
      const normalized = normalizeFactText(text);
      const unknown = /\b(?:nevim|nevime|neviem|nevieme|neznam|nezname|nepoznam|nepozname|nerekla|nerekl|nepovedala|nepovedal|neuvedla|neuvedl|neuviedla|neuviedol|nemame\s+dolozen)\w*\b/u.test(normalized);
      const keys = factSemanticKeys(text);
      if (clause.kind === 'reason' || unknown) {
        keys.add('reason');
        if (statementKeys.has('departure')) keys.add('departure');
      }
      const leadEntities = factProperEntities(clause.reasonLead || '');
      const leadEvents = factEvents(clause.reasonLead || '');
      const ownEntities = factProperEntities(text);
      const ownEvents = factEvents(text);
      records.push({
        text,
        kind: clause.kind,
        reasonLead: clause.reasonLead || '',
        sourceIndex,
        clauseIndex,
        correction,
        replacedQuantities,
        superseded: false,
        entities: ownEntities.length ? ownEntities : leadEntities.length ? leadEntities : statementEntities.length === 1 ? statementEntities : [],
        events: ownEvents.length ? ownEvents : leadEvents.length ? leadEvents : statementEvents.length === 1 ? statementEvents : [],
        keys,
        unknown,
        quantity: extractFactQuantity(text),
        money: extractFactMoney(text),
      });
    });
  });
  applyFactCorrectionSupersession(records);
  return records;
}

export function factRecordMatches(left, right) {
  if (!left || !right || left.superseded || right.superseded) return false;
  if (!compatibleIdentity(left, right)) return false;
  if (left.keys.size && right.keys.size && !setsOverlap(left.keys, right.keys)) return false;
  return true;
}

export { normalizeFactText };
