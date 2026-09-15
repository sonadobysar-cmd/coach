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
  const directRequest = /\b(?:zeptej\s+se\s+(?:me|mne)|spytaj\s+sa\s+ma|poloz\s+mi|dej\s+mi|daj\s+mi|napis\s+mi)\b[^.!?\n]{0,70}\b(?:(?:jen|pouze|iba)\s+)?(?:(?:jednou|jednu|jedinou)\s+)?kratk\w*\s+otazk\w*\s*(?:,?\s*prosim)?[.!?]*$/u.test(text);
  const modalRequest = /\b(?:muzes|mozes|mohla\s+bys|mohla\s+by\s+si|chci,?\s+abys|chcem,?\s+aby\s+si)\b[^.!?\n]{0,80}\b(?:zeptat\s+se\s+(?:me|mne)|opytat\s+sa\s+ma|sa\s+ma\s+opytat|polozit\s+mi|dat\s+mi|mi\s+(?:polozit|dat))\b[^.!?\n]{0,45}\b(?:(?:jen|pouze|iba)\s+)?(?:(?:jednou|jednu|jedinou)\s+)?kratk\w*\s+otazk\w*\s*(?:,?\s*prosim)?[.!?]*$/u.test(text);
  const ellipticalRequest = /^(?:prosim[,;:]?\s*)?(?:(?:jen|pouze|iba)\s+)?(?:jednu|jedinou)\s+kratk\w*\s+otazk\w*\s*(?:,?\s*prosim)?[.!?]*$/u.test(text);
  return directRequest || modalRequest || ellipticalRequest;
}

export function requestsFactsOnly(value) {
  const text = normalizeIntent(value);
  const asksForRecap = /\bco\s+(?:(?:tedy|teda|tak)\s+)?(?:opravdu\s+|skutecne\s+)?(?:vime|vieme|vim)\b[^?]{0,70}\b(?:bez\s+(?:jakehokoli\s+)?(?:domysleni|domyslania|domnenek|interpretace)|z\s+faktu|jiste)\b/u.test(text)
    || /\b(?:drz\s+se|drz\s+sa|rekni|povedz|shrn|zhrn|vypis)\w*\b[^.!?\n]{0,55}\b(?:jen|pouze|iba)\s+(?:toho,?\s+)?(?:co\s+(?:opravdu\s+)?(?:vime|vieme)|fakt(?:a|y|u)|overenych\s+skutecnosti)\b/u.test(text)
    || /\b(?:shrn|zhrn|vypis)\w*\b[^.!?\n]{0,35}\b(?:(?:jen|iba)\s+)?fakt(?:a|y)\b/u.test(text);
  if (!asksForRecap) return false;

  // „Co víme“ může být jen vstup do dalšího výstupu. V takovém případě nesmí
  // deterministická rekapitulace spolknout navazující požadavek na report,
  // reklamu nebo jiné zpracování.
  const hasDownstreamDeliverable = /\b(?:bez\s+(?:jakehokoli\s+)?(?:domysleni|domyslania|domnenek|interpretace)|fakta|skutecnosti)\b[\s\S]{0,120}\b(?:vloz|pouzij|zpracuj|spracuj|preved|zapracuj|prepis)\w*\b/u.test(text);
  return !hasDownstreamDeliverable;
}
