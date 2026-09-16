const SLOVAK_WORDS = Object.freeze(new Set([
  'som', 'nie', 'chcem', 'chcela', 'chcel', 'nechcem', 'môžem', 'môžeš', 'môže',
  'prečo', 'keď', 'teraz', 'ďalej', 'potrebujem', 'nerozumiem', 'nechápem',
  'povedz', 'urobiť', 'skúsiť', 'pokračovať', 'skončiť', 'môj', 'tvoj', 'svoj',
  'bola', 'bolo', 'budem', 'musím', 'nemám', 'viem', 'neviem', 'takto',
  'zasa', 'opakuješ', 'kvôli',
]));

const CZECH_WORDS = Object.freeze(new Set([
  'jsem', 'není', 'chci', 'chtěla', 'chtěl', 'nechci', 'můžu', 'můžeš', 'může',
  'proč', 'když', 'teď', 'dál', 'potřebuji', 'nerozumím', 'nechápu', 'řekni',
  'udělat', 'zkusit', 'pokračovat', 'skončit', 'můj', 'tvůj', 'svůj', 'byla',
  'bylo', 'budu', 'musím', 'nemám', 'vím', 'nevím', 'takhle', 'kvůli',
]));

const SLOVAK_ASCII_WORDS = Object.freeze(new Set([
  'som', 'nie', 'chcem', 'chcela', 'chcel', 'nechcem', 'preco', 'ked', 'potrebujem',
  'nerozumiem', 'nechapem', 'povedz', 'urobit', 'skusit', 'moj', 'tvoj', 'svoj',
  'neviem', 'zasa', 'opakujes',
]));

const CZECH_ASCII_WORDS = Object.freeze(new Set([
  'jsem', 'neni', 'chci', 'chtela', 'chtel', 'nechci', 'proc', 'kdyz', 'potrebuji',
  'nerozumim', 'nechapu', 'rekni', 'udelat', 'zkusit', 'muj', 'tvuj', 'svuj',
]));

// Only genuinely different Czech/Slovak forms belong here. Shared words such
// as "máš", "pravdu" or "dobre" must stay neutral; otherwise a short,
// perfectly natural answer would be rejected merely because the languages are
// close. These markers are used as a fail-closed output check, not as a
// linguistic classifier for arbitrary documents.
const SLOVAK_STRONG_WORDS = Object.freeze(new Set([
  'áno', 'nie', 'som', 'sme', 'ste', 'môžem', 'môžeš', 'môžeme', 'chcem',
  'nechcem', 'prečo', 'keď', 'ďalej', 'potrebujem', 'potrebuješ', 'nerozumiem',
  'nechápem', 'povedz', 'urobiť', 'urobila', 'skúsiť', 'pokračovať', 'skončiť',
  'riešiť', 'čo', 'tá', 'bola', 'budem', 'neviem', 'zasa', 'sa',
  'najprv', 'jedlo', 'spánok', 'tvojho', 'svojho', 'úplnú',
  // Distinctive forms that occur in short professional-training turns. They
  // previously fell through to the Czech fallback even though the sentence
  // was unambiguously Slovak (for example „Rozumiem. Denník ani domácu
  // úlohu…“ or „Ktorá hodnota je najviac ohrozená?“).
  'rozumiem', 'denník', 'domácu', 'úlohu', 'nebudem', 'navrhovať',
  'presviedčať', 'ktorá', 'najviac', 'ohrozená', 'vráťme', 'pracovnému',
  'cieľu', 'piatku', 'vlastne', 'iba', 'priznať',
]));

const CZECH_STRONG_WORDS = Object.freeze(new Set([
  'ano', 'jsem', 'jsme', 'jste', 'můžu', 'můžeš', 'můžeme', 'chci', 'nechci',
  'proč', 'když', 'dál', 'potřebuji', 'potřebuješ', 'nerozumím', 'nechápu',
  'řekni', 'udělat', 'udělala', 'zkusit', 'pokračovat', 'skončit', 'řešit',
  'co', 'ta', 'tohle', 'byla', 'budu', 'nevím', 'zase', 'se', 'nejdřív',
  'jídlo', 'spánek', 'tvého', 'svého', 'úplnou', 'beru',
  'rozumím', 'deník', 'domácí', 'úkol', 'nebudu', 'navrhovat',
  'přesvědčovat', 'která', 'nejvíc', 'ohrožená', 'vraťme',
  'pracovnímu', 'cíli', 'pátku', 'vlastně', 'jen', 'přiznat',
]));

export function detectConversationLanguage(input, fallback = 'cs') {
  const texts = Array.isArray(input)
    ? input.filter(message => message?.role === 'user').slice(-4).map(message => String(message.content || ''))
    : [String(input || '')];
  if (!texts.length) return fallback;
  const latest = texts.at(-1).toLocaleLowerCase('sk-SK');
  if (/\b(?:po\s+slovensky|slovensky|slovenčinou|slovencinou)\b/u.test(latest)) return 'sk';
  if (/\b(?:po\s+česky|po\s+cesky|česky|cesky|češtinou|cestinou)\b/u.test(latest)) return 'cs';

  const latestScore = languageScore(texts.at(-1));
  if (latestScore.skStrong >= 1 && latestScore.csStrong === 0) return 'sk';
  if (latestScore.csStrong >= 1 && latestScore.skStrong === 0) return 'cs';

  let cs = 0;
  let sk = 0;
  for (const [index, text] of texts.entries()) {
    const weight = index === texts.length - 1 ? 2 : 1;
    const score = languageScore(text);
    cs += score.cs * weight;
    sk += score.sk * weight;
  }

  if (sk >= 2 && cs === 0) return 'sk';
  if (sk >= 3 && sk > cs + 1) return 'sk';
  if (cs >= 2 && cs >= sk) return 'cs';
  return fallback === 'sk' ? 'sk' : 'cs';
}

export function languageInstruction(language = 'cs') {
  return language === 'sk'
    ? 'Členka píše slovensky. Odpovedaj prirodzenou súčasnou slovenčinou, zachovaj jej tykanie alebo vykanie a nepremiešavaj do odpovede české tvary.'
    : 'Členka píše česky. Odpovídej přirozenou současnou češtinou, zachovej její tykání nebo vykání a nepřimíchávej slovenské tvary.';
}

export function responseLanguageMismatch(text, language = 'cs') {
  const output = String(text || '').trim();
  if (!output) return false;
  const score = languageScore(output);
  if (language === 'sk') {
    if (score.csStrong >= 1) return true;
    return score.cs >= 2 && score.cs > score.sk + 0.5;
  }
  if (score.skStrong >= 1) return true;
  return score.sk >= 2 && score.sk > score.cs + 0.5;
}

export function languageScore(value) {
  const text = String(value || '').toLocaleLowerCase('sk-SK');
  const tokens = text.match(/[\p{L}]+/gu) || [];
  const asciiTokens = tokens.map(stripDiacritics);
  let cs = /[ěščřžýáíéůúďťň]/u.test(text) ? 0.5 : 0;
  let sk = /[äôľĺŕ]/u.test(text) ? 3 : 0;
  let csStrong = 0;
  let skStrong = 0;

  for (const token of tokens) {
    if (SLOVAK_WORDS.has(token)) sk += 1;
    if (CZECH_WORDS.has(token)) cs += 1;
    if (SLOVAK_STRONG_WORDS.has(token)) skStrong += 1;
    if (CZECH_STRONG_WORDS.has(token)) csStrong += 1;
  }
  for (const token of asciiTokens) {
    if (SLOVAK_ASCII_WORDS.has(token)) sk += 1;
    if (CZECH_ASCII_WORDS.has(token)) cs += 1;
  }
  return { cs, sk, csStrong, skStrong };
}

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '');
}
