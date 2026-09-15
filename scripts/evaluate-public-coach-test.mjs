import { pathToFileURL } from 'node:url';

const baseUrl = String(process.env.ELITEA_PUBLIC_EVAL_URL || 'https://elitea.cz').replace(/\/$/, '');
const showText = process.env.ELITEA_EVAL_SHOW_TEXT === '1';
const origin = new URL(baseUrl).origin;

// Public QA is intentionally capped at four sessions. Each session is multi-turn so it
// checks continuity and repair behaviour, rather than only four polished first answers.
export const scenarios = [
  {
    id: 'coach-workshop-intent-repair',
    mode: 'coach',
    turns: [
      {
        input: 'První workshop dopadl špatně. Asi na podnikání prostě nemám.',
        require: { workshopGrounding: /workshop|podnik/i },
        forbid: { noInventedWorkshopEvidence: unsupportedWorkshopFacts() },
      },
      {
        input: 'Přihlásily se tři ženy a jedna po půl hodině odešla.',
        require: { uncertaintyAboutDeparture: /nev(?:í|íme)|neznáme|bez (?:jejího )?vysvětlení|důvod|proč/i },
        forbid: { noInventedReasonForDeparture: /odešla,? protože|důvodem (?:bylo|je)|znamená to,? že ji/i },
      },
      {
        input: 'Už nechci pokračovat, bojím se.',
        require: { ambiguityHandled: /workshop|rozhovor|pokračovat|myslíš|rozumím|ujist/i },
      },
      {
        input: 'Nechci pokračovat s workshopem. V tomhle rozhovoru pokračovat chci.',
        require: {
          workshopIntentUnderstood: /workshop|pořádán|s workshopy|další akci/i,
          conversationContinues: /rozhovor|řešit|podív|pojď|prozkoum|zaměř|otevř|co (?:bude|chceš|potřebuješ) dál|místo (?:něj|nich|workshopů)/i,
        },
        forbid: {
          noFalseConversationStop: /chceš (?:pokračovat (?:jen )?rozhovorem|dnešní téma uzavřít)|dnešek uzavřeme|zastavíme (?:to|tady)|uzavřít (?:dnešní téma|tento rozhovor)/i,
        },
      },
      {
        input: 'Nerozumím poslední otázce. Řekni ji prosím jednoduše.',
        require: { plainRepair: /jednodu|jinak|ptám se|myslím|workshop|místo|dál|pokračovat/i },
        forbid: {
          noGenericReset: /popiš mi poslední konkrétní situaci|co bylo těsně předtím|co se teď změnilo — je to stejné/i,
        },
        maxQuestions: 1,
      },
    ],
  },
  {
    id: 'coach-explicit-refusal',
    mode: 'coach',
    turns: [
      {
        input: 'Když mám zveřejnit svoji nabídku, ztuhnu a místo toho dál upravuji web.',
        require: { offerGrounding: /nabídk|zveřej|web|ztuhn|odklád/i },
      },
      {
        input: 'Ne, tímhle směrem pokračovat nechci.',
        require: {
          refusalAcknowledged: /beru|respekt|tímhle směrem (?:už )?(?:pokračovat )?nebudeme|v tomhle (?:už )?nebudeme pokračovat/i,
          alternativeDirection: /jin|alternativ|místo|způsob|možnost|cest|směr/i,
        },
        forbid: {
          noConsentLoop: /chceš tímto krokem pokračovat|než přidáme cokoli dalšího|popiš mi poslední konkrétní situaci|co bylo těsně předtím/i,
        },
      },
      {
        input: 'Řekla jsem ne. Nevracej mě k tomu; raději mi pomoz vybrat jiný způsob.',
        require: { alternativeOffered: /jin|alternativ|místo|způsob|možnost/i },
        forbid: {
          noRefusalOverride: /chceš tímto krokem pokračovat|vrátíme se k (?:tomu|té otázce)|zůstaňme u (?:tohoto|toho) kroku/i,
        },
      },
    ],
  },
  {
    id: 'mentor-workshop-fact-discipline',
    mode: 'mentor',
    turns: [
      {
        input: 'Můj první placený workshop dopadl podle mě špatně a stydím se za něj.',
        require: { workshopGrounding: /workshop|styd|dopadl/i },
        forbid: { noInventedWorkshopEvidence: unsupportedWorkshopFacts() },
      },
      {
        input: 'Zatím jsem ti neřekla, kolik lidí přišlo ani jak reagovali.',
        require: { missingDataAcknowledged: /neřekla|nev(?:í|íme)|nemáme|chybí|kolik|reakc|bez (?:těchto )?(?:údajů|dat)|nelze|nejde|nemůžeme (?:zatím )?(?:hodnotit|vyhodnotit)/i },
        forbid: { stillNoInventedWorkshopEvidence: unsupportedWorkshopFacts() },
      },
      {
        input: 'Přesně. Co tedy opravdu víme bez domýšlení?',
        require: { onlyKnownFacts: /první|placen|workshop|podle tebe|máš pocit|styd/i },
        forbid: { noInventedWorkshopEvidence: unsupportedWorkshopFacts() },
        maxQuestions: 1,
      },
    ],
  },
  {
    id: 'mentor-human-repair',
    mode: 'mentor',
    turns: [
      {
        input: 'Mám problém s prodejem své služby, stydím se o ní mluvit a nevím, kde začít.',
        require: { salesGrounding: /prodej|služb|mluvit|styd|začít/i },
      },
      {
        input: 'Můžeš se mnou mluvit jako člověk? Nerozumím té otázce.',
        require: {
          humanRepair: /jednodu|jinak|ptám se|rozumím|jasně|normálně/i,
          serviceGrounding: /služb|nabíz|prodáv/i,
          audienceGrounding: /pro koho|komu|pomáh|určen/i,
        },
        forbid: {
          noInternalJargon: /diagnostick|interní|hypotéz|metodolog|framework/i,
          noGenericPivot: /co je pro tebe teď nejdůležitější|co z toho, co už víme, potřebuješ rozhodnout/i,
        },
        maxQuestions: 1,
      },
      {
        input: 'Pořád tomu nerozumím. Zeptej se mě jednou krátkou otázkou.',
        require: { shortConcreteQuestion: /\?/ },
        forbid: { noMetaExplanation: /interní|metod|framework|nejprve diagnostik/i },
        maxQuestions: 1,
        maxWords: 45,
      },
    ],
  },
];

const forbidden = /držím se přesně|nechci přidávat domněnku|abych ti poradila věcně|nejbližší byznysové rozhodnutí|pracovní zadání je|distribuční realit|rozhodující předpoklad|interní (?:kontrola|oprava|pravidlo|prompt|rubrika)/i;

export function unsupportedWorkshopFacts() {
  return /\b(?:jedna|dvě|tři|čtyři|pět|[1-9])\s+(?:ženy|účastnice|účastníci|lidé|klientky)\b|zůstal\w*\s+do konce|získal\w*\s+(?:prvního\s+)?klienta|pomohl\w*\s+(?:jí\s+)?(?:ten\s+)?cvičení|odešl\w*\s+po\s+(?:půl|30)/iu;
}

export function normalizedText(value) {
  return String(value || '')
    .toLocaleLowerCase('cs')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNearDuplicate(first, second) {
  const left = normalizedText(first);
  const right = normalizedText(second);
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 12) return false;
  const leftTrigrams = trigrams(left);
  const rightTrigrams = trigrams(right);
  let shared = 0;
  for (const value of leftTrigrams) if (rightTrigrams.has(value)) shared += 1;
  const dice = (2 * shared) / (leftTrigrams.size + rightTrigrams.size);
  if (dice >= 0.84) return true;

  const leftMeaning = meaningTokens(left);
  const rightMeaning = meaningTokens(right);
  if (leftMeaning.size < 2 || rightMeaning.size < 2) return false;
  const meaningShared = [...leftMeaning].filter(token => rightMeaning.has(token)).length;
  const overlap = meaningShared / Math.min(leftMeaning.size, rightMeaning.size);
  return overlap >= 0.72;
}

export function evaluateAnswer({ scenario, turnIndex, answer, payload, previousAnswers = [] }) {
  const turn = scenario.turns[turnIndex];
  const normalizedAnswer = normalizedText(answer);
  const normalizedInput = normalizedText(turn.input);
  const wordCount = String(answer || '').split(/\s+/u).filter(Boolean).length;
  const questionCount = (String(answer || '').match(/\?/g) || []).length;
  const checks = {
    response: String(answer || '').trim().length >= 20,
    qualityGate: payload.qualityGate?.pass === true,
    role: scenario.mode === 'mentor' ? payload.mode === 'mentoringova_konzultace' : payload.mode === 'koucovaci_hodina',
    naturalLanguage: !forbidden.test(answer),
    naturalQuestionCount: questionCount <= (turn.maxQuestions ?? 2),
    noMessageEcho: normalizedInput.length < 18 || !normalizedAnswer.includes(normalizedInput),
    concise: wordCount <= (turn.maxWords ?? 120),
    noRepeatedAnswer: !previousAnswers.some(previous => isNearDuplicate(previous, answer)),
  };
  for (const [name, pattern] of Object.entries(turn.require || {})) checks[name] = pattern.test(answer);
  for (const [name, pattern] of Object.entries(turn.forbid || {})) checks[name] = !pattern.test(answer);
  return checks;
}

export async function runEvaluation({ post = defaultPost } = {}) {
  const results = [];
  for (const scenario of scenarios) {
    const session = await post('/api/public-coach-test/session', { mode: scenario.mode });
    let token = session.token;
    const messages = [];
    const previousAnswers = [];
    for (let index = 0; index < scenario.turns.length; index += 1) {
      const input = scenario.turns[index].input;
      messages.push({ role: 'user', content: input });
      const payload = await post('/api/public-coach-test/chat', { sessionToken: token, messages });
      token = payload.session.token;
      const answer = String(payload.answer || '').trim();
      const checks = evaluateAnswer({ scenario, turnIndex: index, answer, payload, previousAnswers });
      results.push({
        id: `${scenario.id}-${index + 1}`,
        mode: scenario.mode,
        pass: Object.values(checks).every(Boolean),
        checks,
        provider: payload.provider || null,
        quality: payload.qualityGate || null,
        ...(showText ? { input, answer } : {}),
      });
      previousAnswers.push(answer);
      messages.push({ role: 'assistant', content: answer });
    }
  }
  const summary = {
    total: results.length,
    passed: results.filter(result => result.pass).length,
    failed: results.filter(result => !result.pass).length,
  };
  return { summary, results };
}

async function defaultPost(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'user-agent': 'Elitea-Production-QA/0.40.0',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error || `HTTP ${response.status}`}`);
  return payload;
}

function trigrams(value) {
  const result = new Set();
  for (let index = 0; index < value.length - 2; index += 1) result.add(value.slice(index, index + 3));
  return result;
}

function meaningTokens(value) {
  const stop = new Set(['jsem', 'jsi', 'jsme', 'jste', 'pro', 'tebe', 'tvoje', 'co', 'jak', 'kdy', 'kde', 'který', 'ktera', 'které', 'to', 'ten', 'tento', 'je', 'se', 'si', 'na', 'do', 'od', 'u', 'v', 've', 'a', 'ale', 'nebo']);
  return new Set(normalizedText(value)
    .split(' ')
    .filter(token => token.length >= 4 && !stop.has(token))
    .map(token => token
      .replace(/(?:ami|emi|ove|ova|ovy|eni|ani|ace|aci|ost|ech|ich|ych|ou|em|om|im|am|at|it|et|la|li|ly|lo|uje|uji|oval|ovat|y|a|u|i|e|o)$/u, '')
      .slice(0, 9))
    .filter(token => token.length >= 3));
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const output = await runEvaluation();
  console.log(JSON.stringify(output, null, 2));
  if (output.summary.failed) process.exitCode = 1;
}
