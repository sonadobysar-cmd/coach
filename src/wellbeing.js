import { readFile } from 'node:fs/promises';

export async function loadWellbeingProtocols(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Registr wellbeing protokolů je prázdný.');
  }
  const protocols = parsed.map(validateProtocol);
  if (new Set(protocols.map(protocol => protocol.id)).size !== protocols.length) {
    throw new Error('Registr wellbeing protokolů obsahuje duplicitní ID.');
  }
  return protocols;
}

export function selectWellbeingProtocol(protocols, text = '', mode = '') {
  if (!['podporna_stabilizace', 'vedena_meditace'].includes(mode)) return null;
  const normalized = normalize(text);
  const candidates = protocols.filter(protocol => protocol.mode === mode);
  const ranked = candidates.map(protocol => ({
    ...protocol,
    score: protocol.signals.reduce((sum, signal) => {
      const key = normalize(signal);
      return sum + (normalized.includes(key) ? Math.max(2, key.split(' ').length * 2) : 0);
    }, 0),
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked[0] || null;
}

export function formatWellbeingProtocol(protocol) {
  if (!protocol) return 'Pro tento vstup nebyl vybrán žádný wellbeing protokol.';
  return [
    `Protokol: ${protocol.name} (${protocol.id}, přibližně ${protocol.duration_minutes} min)`,
    `Účel: ${protocol.purpose}`,
    `Bezpečný sled: ${protocol.steps.join(' → ')}`,
    `Volby členky: ${protocol.choices.join('; ')}`,
    `Okamžitě zastavit při: ${protocol.stop_conditions.join('; ')}`,
    `Nikdy netvrdit: ${protocol.never_claim.join('; ')}`,
    `Zdrojová ID: ${protocol.source_ids.join(', ')}`,
  ].join('\n');
}

export function validateProtocolSources(protocols, sources) {
  const sourceIds = new Set(sources.map(source => source.id));
  for (const protocol of protocols) {
    for (const sourceId of protocol.source_ids) {
      if (!sourceIds.has(sourceId)) throw new Error(`Protokol ${protocol.id} odkazuje na neznámý zdroj ${sourceId}.`);
    }
  }
  return true;
}

function validateProtocol(protocol, index) {
  for (const key of ['id', 'name', 'mode', 'purpose']) {
    if (typeof protocol?.[key] !== 'string' || !protocol[key].trim()) {
      throw new Error(`Neplatný wellbeing protokol na pozici ${index}: ${key}`);
    }
  }
  for (const key of ['signals', 'steps', 'choices', 'stop_conditions', 'never_claim', 'source_ids']) {
    if (!Array.isArray(protocol[key]) || protocol[key].length === 0 || protocol[key].some(value => typeof value !== 'string')) {
      throw new Error(`Neplatný wellbeing protokol ${protocol.id}: ${key}`);
    }
  }
  if (!Number.isInteger(protocol.duration_minutes) || protocol.duration_minutes < 1 || protocol.duration_minutes > 20) {
    throw new Error(`Neplatný wellbeing protokol ${protocol.id}: duration_minutes`);
  }
  return protocol;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
