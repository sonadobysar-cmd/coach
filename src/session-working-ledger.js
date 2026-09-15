const CORRECTION_OR_BOUNDARY = /\b(?:nechci|nechcem|nebudu|nebudem|odm[ií]t|p[řr]esta[ňn]|stop|nerozum[ií]m|nerozumiem|nech[aá]pu|nech[aá]pem|to jsem ne[řr]ekla|to som nepovedala|u[žz] jsem psala|u[žz] som p[ií]sala|[řr][ií]k[aá]m|hovor[ií]m|ne s tebou|nie s tebou|ne rozhovor|nie rozhovor|ne tuhle techniku|nie t[uú]to techniku)\b/iu;
const UNKNOWN = /\b(?:nev[ií]m|neviem|netu[šs][ií]m)\b/iu;
const EFFECT = /\b(?:pomohlo|nepomohlo|fungovalo|nefungovalo|zlep[šs]ilo|zhor[šs]ilo|lep[šs][ií]|hor[šs][ií]|stejn[eě]|rovnako|ulevilo|u[ľl]avilo|zvl[aá]dla|nezvl[aá]dla|dokon[čc]ila|nedokon[čc]ila|z[ií]skala|nez[ií]skala|odeslala|neodeslala)\b/iu;
const ACTION = /\b(?:ud[eě]lala|urobila|zkusila|sk[uú]sila|provedla|spravila|odeslala|poslala|napsala|nap[ií]sala|zavolala|oslovila|spustila|dokon[čc]ila|zavedla|pou[žz]ila|vyzkou[šs]ela|vysk[uú][šs]ala)\b/iu;

/**
 * A compact, session-only evidence ledger. It deliberately contains exact
 * member statements instead of an AI-authored psychological summary.
 */
export function buildSessionWorkingLedger(messages = [], { techniqueSession = null } = {}) {
  const safe = normalizeMessages(messages);
  const userEntries = safe
    .map((message, index) => ({ ...message, index }))
    .filter(message => message.role === 'user');
  const first = userEntries.find(entry => isSubstantive(entry.content)) || userEntries[0];
  const latest = userEntries.at(-1);

  const correctionsAndBoundaries = userEntries
    .filter(entry => CORRECTION_OR_BOUNDARY.test(entry.content))
    .slice(-5)
    .map(entry => quote(entry.content, 300));

  const unresolvedUnknowns = userEntries
    .filter(entry => UNKNOWN.test(entry.content))
    .filter(entry => /\b(?:proc|preco|duvod|co|jak|kde|zda|ci|odesl|odisl|stalo|deje)\b/u.test(forDetection(entry.content)))
    .slice(-4)
    .map(entry => quote(entry.content, 260));

  const performedStepsAndEffects = userEntries
    .filter(entry => ACTION.test(entry.content) || EFFECT.test(entry.content))
    .slice(-5)
    .map(entry => quote(entry.content, 300));

  const answeredQuestions = userEntries
    .map(entry => {
      const previous = safe[entry.index - 1];
      if (!previous || previous.role !== 'assistant' || !/[?？]/u.test(previous.content)) return null;
      return {
        asked: quote(lastQuestion(previous.content), 190),
        memberAnswered: quote(entry.content, 260),
      };
    })
    .filter(Boolean)
    .filter(pair => isSubstantive(pair.memberAnswered) || CORRECTION_OR_BOUNDARY.test(pair.memberAnswered))
    .map((pair, index) => ({
      ...pair,
      index,
      score: evidenceScore({ role: 'user', content: pair.memberAnswered }, index, userEntries.length),
    }))
    .sort((left, right) => right.score - left.score || right.index - left.index)
    .slice(0, 5)
    .sort((left, right) => left.index - right.index)
    .map(({ asked, memberAnswered }) => ({ asked, memberAnswered }));

  const knownFacts = pickKnownFacts(userEntries, {
    exclude: new Set([
      ...correctionsAndBoundaries,
      ...unresolvedUnknowns,
    ]),
  });

  return {
    kind: 'session_only_member_evidence',
    contract: first ? quote(first.content, 320) : '',
    knownFacts,
    answeredQuestions,
    correctionsAndBoundaries,
    unresolvedUnknowns,
    performedStepsAndEffects,
    openDirection: latest ? quote(latest.content, 320) : '',
    techniqueState: techniqueSession
      ? {
        phase: quote(techniqueSession.phase, 80),
        status: quote(techniqueSession.status, 80),
        cardId: quote(techniqueSession.cardId || techniqueSession.techniqueId, 120),
      }
      : null,
  };
}

export function formatSessionWorkingLedger(ledger = {}) {
  return [
    '# PRACOVNÍ PAMĚŤ TOHOTO SEZENÍ',
    'Toto jsou pouze doslovné nebo zkrácené výroky členky z aktuálního sezení, ne psychologická interpretace. Ber je jako závazná pracovní data: neopakuj již zodpovězenou otázku, respektuj opravu a odmítnutí, neobnovuj odmítnutou techniku bez nové výslovné dohody a z neznámého údaje nevyráběj příčinu. Citlivé údaje zůstávají pouze v tomto požadavku a neukládají se do dlouhodobé paměti.',
    JSON.stringify(ledger),
  ].join('\n');
}

/**
 * Preserve the opening contract and recent turn while spending remaining
 * context slots on high-signal evidence/corrections from the middle.
 */
export function selectEvidenceAwareConversationWindow(messages = [], maxMessages = 18) {
  const safe = normalizeMessages(messages);
  const limit = Math.max(1, Number(maxMessages) || 18);
  if (safe.length <= limit) return safe;

  const selected = new Set();
  const openingCount = Math.min(limit, 3, Math.max(1, Math.floor(limit / 5)));
  const remainingAfterOpening = Math.max(0, limit - openingCount);
  const recentCount = Math.min(10, remainingAfterOpening);
  for (let index = 0; index < openingCount; index += 1) selected.add(index);
  for (let index = Math.max(openingCount, safe.length - recentCount); index < safe.length; index += 1) selected.add(index);

  const ranked = safe
    .map((message, index) => ({ index, message, score: evidenceScore(message, index, safe.length) }))
    .filter(entry => !selected.has(entry.index) && entry.score > 0)
    .sort((left, right) => right.score - left.score || right.index - left.index);

  for (const entry of ranked) {
    if (selected.size >= limit) break;
    if (entry.message.role === 'user') {
      const previousIndex = entry.index - 1;
      const previous = safe[previousIndex];
      if (previous?.role === 'assistant' && /[?？]/u.test(previous.content) && selected.size <= limit - 2) {
        selected.add(previousIndex);
      }
    }
    if (selected.size < limit) selected.add(entry.index);
  }

  // Fill any remaining capacity chronologically from the newest omitted turns.
  for (let index = safe.length - 1; index >= 0 && selected.size < limit; index -= 1) selected.add(index);
  return [...selected]
    .sort((left, right) => left - right)
    .slice(-limit)
    .map(index => safe[index]);
}

function pickKnownFacts(userEntries, { exclude = new Set() } = {}) {
  const candidates = userEntries
    .filter(entry => !exclude.has(quote(entry.content, 300)))
    .map(entry => ({
      ...entry,
      score: (containsConcreteEvidence(entry.content) ? 7 : 0)
        + (entry.content.length >= 45 ? 2 : 0)
        + (UNKNOWN.test(entry.content) ? 1 : 0),
    }))
    .filter(entry => entry.score >= 2)
    .sort((left, right) => right.score - left.score || right.index - left.index)
    .slice(0, 7)
    .sort((left, right) => left.index - right.index)
    .map(entry => quote(entry.content, 300));
  return [...new Set(candidates)].slice(-6);
}

function evidenceScore(message, index, total) {
  if (message.role !== 'user') return 0;
  const text = message.content;
  return (CORRECTION_OR_BOUNDARY.test(text) ? 12 : 0)
    + (ACTION.test(text) || EFFECT.test(text) ? 9 : 0)
    + (containsConcreteEvidence(text) ? 7 : 0)
    + (UNKNOWN.test(text) ? 4 : 0)
    + (text.length >= 45 ? 2 : 0)
    + (index > total / 2 ? 1 : 0);
}

function lastQuestion(value) {
  const text = quote(value, 800);
  const matches = text.match(/[^?？]*[?？]/gu);
  return matches?.at(-1)?.trim() || text;
}

function isSubstantive(value) {
  const text = quote(value, 500);
  return text.length >= 12 && !/^(?:ahoj|dobr[yý]\s+den|ano|jo|ok(?:ej)?|dob[řr]e|ne|nie|nev[ií]m|neviem)[.! ]*$/iu.test(text);
}

function containsConcreteEvidence(value) {
  const text = String(value || '');
  if (ACTION.test(text) || EFFECT.test(text)) return true;
  if (/\b(?:jeden|jedna|jedno|dva|dve|tri|ctyri|pet|prvni|druha)\b/u.test(forDetection(text))) return true;
  return text.length >= 30
    && /\b\d+(?:[.,]\d+)?\b/u.test(text)
    && !/\b(?:cislo|varianta)\s*\d+\b/u.test(forDetection(text));
}

function forDetection(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter(message => message && ['user', 'assistant'].includes(message.role))
    .map(message => ({
      role: message.role,
      content: redactDirectIdentifiers(String(message.content || '').replace(/\s+/gu, ' ').trim()).slice(0, 12000),
    }))
    .filter(message => message.content);
}

function quote(value, maxLength) {
  return redactDirectIdentifiers(String(value || '').replace(/\s+/gu, ' ').trim()).slice(0, maxLength);
}

function redactDirectIdentifiers(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[e-mail odstraněn]')
    .replace(/\b(?:\+?420[ .-]?)?(?:\d[ .-]?){9}\b/g, '[telefon odstraněn]')
    .replace(/\b\d{6}\/?\d{3,4}\b/g, '[rodné číslo odstraněno]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[platební údaj odstraněn]')
    .replace(/\b(?:sk|pk|rk|vercel|ghp|github_pat)[-_][A-Za-z0-9_-]{12,}\b/gi, '[tajný klíč odstraněn]')
    .replace(/((?:heslo|password|api[_ -]?key|token)\s*[:=]\s*)\S+/gi, '$1[odstraněno]');
}
