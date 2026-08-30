const DEFAULT_PASS_PERCENT = 75;

const GENERIC_DISTRACTORS = Object.freeze({
  why: [
    'Protože tím odpadá potřeba ověřovat skutečný výsledek.',
    'Protože stejný postup funguje bez ohledu na situaci a cíl.',
    'Protože rychlost provedení je důležitější než kvalita a dopad.',
    'Protože první dojem je spolehlivější než pozorovatelná evidence.',
  ],
  when: [
    'Vždy okamžitě, ještě před vymezením cíle a rizika.',
    'Až po dokončení, bez výchozího stavu a průběžné kontroly.',
    'Pouze tehdy, když výsledek nelze nijak pozorovat ani ověřit.',
    'Ve všech situacích stejně, bez ohledu na kapacitu a kontext.',
  ],
  how: [
    'Jedním univerzálním krokem bez zpětné vazby a možnosti úpravy.',
    'Podle prvního dojmu, bez rozlišení faktů a interpretace.',
    'Co největším zásahem bez pilotu, měřítka a stop podmínky.',
    'Převzetím rozhodnutí za druhou osobu bez ověření jejího cíle.',
  ],
  what: [
    'Univerzální pravidlo použitelné bez znalosti konkrétní situace.',
    'Subjektivní dojem bez předem určeného měřítka.',
    'Nejrychlejší dostupná možnost bez kontroly vedlejšího dopadu.',
    'Formální dokončení kroku bez pozorovatelného výsledku.',
  ],
});

export function parseQuizAnswerKeys(markdown = '') {
  const keys = new Map();
  for (const match of String(markdown).matchAll(/^-\s*Modul\s+(\d+):\s*(.+)$/gmi)) {
    const answers = new Map();
    for (const pair of match[2].matchAll(/(\d+)\s*([A-D])/gi)) answers.set(Number(pair[1]), pair[2].toUpperCase());
    if (answers.size) keys.set(Number(match[1]), answers);
  }
  return keys;
}

export function buildCourseQuiz(markdown = '', context = {}) {
  const source = String(markdown || '').replace(/\r\n/g, '\n').trim();
  const moduleNumber = Number(String(context.title || '').match(/modulu\s+(\d+)/i)?.[1] ?? context.moduleIndex);
  const explicit = parseExplicitQuestions(source, context.answerKeys?.get(moduleNumber));
  const parsed = explicit.length ? explicit : parseInlineAnswerQuestions(source, context);
  if (!parsed.length) return null;

  const questions = parsed.map((question, index) => {
    const shuffled = deterministicShuffle(question.options, `${context.courseId}:${context.itemId}:${index}`);
    const publicOptions = shuffled.map((text, optionIndex) => ({ id: `o${optionIndex + 1}`, text }));
    const correctOptionId = publicOptions.find(option => option.text === question.correctAnswer)?.id;
    return {
      public: {
        id: `q${index + 1}`,
        number: index + 1,
        prompt: question.prompt,
        options: publicOptions,
      },
      answer: {
        correctOptionId,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation || question.correctAnswer,
      },
    };
  });

  const practicePrompt = extractPracticePrompt(source);
  return {
    public: {
      version: 1,
      passPercent: DEFAULT_PASS_PERCENT,
      questionCount: questions.length,
      instructions: `Vyber vždy nejpřesnější odpověď. Pro splnění potřebuješ alespoň ${DEFAULT_PASS_PERCENT} %. Test můžeš bez sankce opakovat.`,
      questions: questions.map(question => question.public),
      practicePrompt,
    },
    answerKey: Object.fromEntries(questions.map(question => [question.public.id, question.answer])),
  };
}

export function gradeCourseQuiz(item, submittedAnswers = {}) {
  const quiz = item?.quiz;
  const answerKey = item?._quizAnswerKey;
  if (!quiz?.questions?.length || !answerKey) throw quizError('Tento test nemá platný bodovací klíč.', 500, 'QUIZ_KEY_MISSING');
  const safeAnswers = submittedAnswers && typeof submittedAnswers === 'object' && !Array.isArray(submittedAnswers)
    ? submittedAnswers : {};
  const results = quiz.questions.map(question => {
    const selectedOptionId = String(safeAnswers[question.id] || '').slice(0, 20);
    const selectedExists = question.options.some(option => option.id === selectedOptionId);
    const selected = selectedExists ? selectedOptionId : '';
    const expected = answerKey[question.id];
    const correct = Boolean(selected && selected === expected.correctOptionId);
    return {
      questionId: question.id,
      selectedOptionId: selected,
      correctOptionId: expected.correctOptionId,
      correct,
      explanation: expected.explanation,
    };
  });
  const correctCount = results.filter(result => result.correct).length;
  const questionCount = results.length;
  const scorePercent = Math.round(correctCount / questionCount * 100);
  return {
    scorePercent,
    correctCount,
    questionCount,
    passPercent: quiz.passPercent || DEFAULT_PASS_PERCENT,
    passed: scorePercent >= (quiz.passPercent || DEFAULT_PASS_PERCENT),
    results,
  };
}

export function publicQuizMarkdown(quiz = {}) {
  const lines = [
    'Odpovědi se zobrazí až po odevzdání. Výsledek vyhodnocuje server, ne text této stránky.',
  ];
  if (quiz.practicePrompt) lines.push(`**Praktický výstup po testu:** ${quiz.practicePrompt}`);
  return lines.join('\n\n');
}

function parseInlineAnswerQuestions(source, context) {
  const questions = [];
  const pattern = /(?:^|\s)(\d+)\.\s+(.+?)\s*\*\*(.+?)\*\*(?=\s+\d+\.|$)/gs;
  for (const match of source.matchAll(pattern)) {
    const number = Number(match[1]);
    if (!number || number > 20) continue;
    const prompt = clean(match[2]);
    const correctAnswer = clean(match[3]);
    if (!prompt || !correctAnswer) continue;
    questions.push({
      prompt,
      correctAnswer,
      explanation: correctAnswer,
      options: buildOptions(prompt, correctAnswer, `${context.courseId}:${context.moduleIndex}:${number}`),
    });
  }
  return questions;
}

function parseExplicitQuestions(source, answerKey) {
  if (!(answerKey instanceof Map) || !answerKey.size) return [];
  const questions = [];
  const pattern = /(?:^|\n)(\d+)\.\s+([^\n]+)\n((?:\s+-\s+[A-D]:\s*[^\n]+\n?)+)/g;
  for (const match of source.matchAll(pattern)) {
    const number = Number(match[1]);
    const keyedLetter = answerKey.get(number);
    if (!keyedLetter) continue;
    const labeled = [...match[3].matchAll(/-\s+([A-D]):\s*([^\n]+)/g)]
      .map(option => ({ letter: option[1], text: clean(option[2]) }));
    const correct = labeled.find(option => option.letter === keyedLetter);
    if (!correct || labeled.length < 2) continue;
    questions.push({
      prompt: clean(match[2]),
      correctAnswer: correct.text,
      explanation: correct.text,
      options: labeled.map(option => option.text),
    });
  }
  return questions;
}

function buildOptions(prompt, correctAnswer, seed) {
  const normalized = correctAnswer.toLocaleLowerCase('cs-CZ').replace(/[.!?]+$/g, '').trim();
  if (normalized === 'ano' || normalized === 'ne') {
    return unique([correctAnswer, normalized === 'ano' ? 'Ne.' : 'Ano.', 'Pouze bez kontroly výsledku.', 'Nelze rozhodnout bez cíle a kontextu.']);
  }
  const family = /^proč\b/i.test(prompt) ? 'why'
    : /^kdy\b/i.test(prompt) ? 'when'
      : /^(jak|čím|k čemu)\b/i.test(prompt) ? 'how' : 'what';
  const rotation = hash(seed) % GENERIC_DISTRACTORS[family].length;
  const distractors = rotate(GENERIC_DISTRACTORS[family], rotation);
  return unique([correctAnswer, ...distractors]).slice(0, 4);
}

function extractPracticePrompt(source) {
  const match = source.match(/(?:^|\s)5\.\s+(.+?)(?=\s+6\.|$)/s);
  if (!match) return '';
  return clean(match[1].replace(/\*\*(.+?)\*\*/g, '$1'));
}

function deterministicShuffle(values, seed) {
  const copy = unique(values);
  let state = hash(seed) || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.codePointAt(0), 16777619);
  return result >>> 0;
}

function rotate(values, offset) {
  return values.map((_, index) => values[(index + offset) % values.length]);
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function quizError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}
