function normalizeIntent(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

export function requestsOneShortQuestion(value) {
  const text = normalizeIntent(value);
  const directRequest = /\b(?:zeptej\s+se\s+(?:me|mne)|poloz\s+mi|dej\s+mi|napis\s+mi)\b[^.!?\n]{0,70}\b(?:(?:jen|pouze)\s+)?(?:(?:jednou|jednu|jedinou)\s+)?kratk\w*\s+otazk\w*\s*(?:,?\s*prosim)?[.!?]*$/u.test(text);
  const modalRequest = /\b(?:muzes|mohla\s+bys|chci,?\s+abys)\b[^.!?\n]{0,80}\b(?:zeptat\s+se\s+(?:me|mne)|polozit\s+mi|dat\s+mi|mi\s+(?:polozit|dat))\b[^.!?\n]{0,45}\b(?:(?:jen|pouze)\s+)?(?:(?:jednou|jednu|jedinou)\s+)?kratk\w*\s+otazk\w*\s*(?:,?\s*prosim)?[.!?]*$/u.test(text);
  const ellipticalRequest = /^(?:prosim[,;:]?\s*)?(?:(?:jen|pouze)\s+)?(?:jednu|jedinou)\s+kratk\w*\s+otazk\w*\s*(?:,?\s*prosim)?[.!?]*$/u.test(text);
  return directRequest || modalRequest || ellipticalRequest;
}

export function requestsFactsOnly(value) {
  const text = normalizeIntent(value);
  const asksForRecap = /\bco\s+(?:tedy\s+|tak\s+)?(?:opravdu\s+|skutecne\s+)?(?:vime|vim)\b[^?]{0,70}\b(?:bez\s+(?:jakehokoli\s+)?(?:domysleni|domnenek|interpretace)|z\s+faktu|jiste)\b/u.test(text)
    || /\b(?:drz\s+se|rekni|shrn|vypis)\w*\b[^.!?\n]{0,55}\b(?:jen|pouze)\s+(?:toho,?\s+)?(?:co\s+(?:opravdu\s+)?vime|faktu|overenych\s+skutecnosti)\b/u.test(text)
    || /\b(?:shrn|vypis)\w*\b[^.!?\n]{0,35}\b(?:jen\s+)?fakta\b/u.test(text);
  if (!asksForRecap) return false;

  // „Co víme“ může být jen vstup do dalšího výstupu. V takovém případě nesmí
  // deterministická rekapitulace spolknout navazující požadavek na report,
  // reklamu nebo jiné zpracování.
  const hasDownstreamDeliverable = /\b(?:bez\s+(?:jakehokoli\s+)?(?:domysleni|domnenek|interpretace)|fakta|skutecnosti)\b[\s\S]{0,120}\b(?:vloz|pouzij|zpracuj|preved|zapracuj|prepis)\w*\b/u.test(text);
  return !hasDownstreamDeliverable;
}
