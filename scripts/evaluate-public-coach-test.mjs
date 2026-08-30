const baseUrl = String(process.env.ELITEA_PUBLIC_EVAL_URL || 'https://elitea.cz').replace(/\/$/, '');
const showText = process.env.ELITEA_EVAL_SHOW_TEXT === '1';
const origin = new URL(baseUrl).origin;
const scenarios = [
  {
    id: 'mentor-sales-human-repair',
    mode: 'mentor',
    inputs: ['mám problém s prodejem, stydím se', 'Můžeš se mnou mluvit jako člověk? Nerozumím ti.'],
  },
  {
    id: 'mentor-social-typo-followup',
    mode: 'mentor',
    inputs: ['Mám projekt a nevím jak ho rozjet, stydím se vystupovat na sochách a bojím se co řeknou ostatní', 'Je to online služba pro ženy, které začínají podnikat.'],
  },
  {
    id: 'coach-procrastination-context',
    mode: 'coach',
    inputs: ['Pořád odkládám web a nemůžu začít.', 'Včera jsem otevřela ceník, nevěděla jsem jakou cenu napsat a zavřela ho.'],
    requireByTurn: [/web|začát|tření|odklád/i, /cen|věta|hlavou/i],
    forbidByTurn: [/jsem Elitea|co má být po dnešním rozhovoru/i, /určitě|skutečná příčina/i],
  },
  {
    id: 'coach-boundary-human-repair',
    mode: 'coach',
    inputs: ['Ve vztahu neumím říct ne a pak se na sebe zlobím.', 'Nerozumím ti, řekni to normálně.'],
    requireByTurn: [/těsně před|poslední (?:takové|konkrétní) situaci|co po tobě/i, /poslední (?:takové|konkrétní) situaci|co se dělo|co po tobě/i],
    forbidByTurn: [/partner|riskovala|bojíš se jeho reakce/i, /partner|interní|mechanismus/i],
  },
];

const forbidden = /držím se přesně|nechci přidávat domněnku|abych ti poradila věcně|nejbližší byznysové rozhodnutí|pracovní zadání je|distribuční realit|rozhodující předpoklad|interní (?:kontrola|oprava|pravidlo|prompt|rubrika)/i;
const results = [];

for (const scenario of scenarios) {
  const session = await post('/api/public-coach-test/session', { mode: scenario.mode });
  let token = session.token;
  const messages = [];
  for (let index = 0; index < scenario.inputs.length; index += 1) {
    const input = scenario.inputs[index];
    messages.push({ role: 'user', content: input });
    const payload = await post('/api/public-coach-test/chat', { sessionToken: token, messages });
    token = payload.session.token;
    const answer = String(payload.answer || '').trim();
    const normalizedAnswer = answer.toLocaleLowerCase('cs').replace(/\s+/g, ' ');
    const normalizedInput = input.toLocaleLowerCase('cs').replace(/\s+/g, ' ').trim();
    const checks = {
      response: answer.length >= 20,
      qualityGate: payload.qualityGate?.pass === true,
      role: scenario.mode === 'mentor' ? payload.mode === 'mentoringova_konzultace' : payload.mode === 'koucovaci_hodina',
      naturalLanguage: !forbidden.test(answer),
      naturalQuestionCount: (answer.match(/\?/g) || []).length <= 2,
      noMessageEcho: normalizedInput.length < 18 || !normalizedAnswer.includes(normalizedInput),
      concise: answer.split(/\s+/u).filter(Boolean).length <= 120,
      scenarioGrounding: !scenario.requireByTurn?.[index] || scenario.requireByTurn[index].test(answer),
      noScenarioAssumption: !scenario.forbidByTurn?.[index] || !scenario.forbidByTurn[index].test(answer),
    };
    results.push({
      id: `${scenario.id}-${index + 1}`,
      mode: scenario.mode,
      pass: Object.values(checks).every(Boolean),
      checks,
      provider: payload.provider || null,
      quality: payload.qualityGate || null,
      ...(showText ? { input, answer } : {}),
    });
    messages.push({ role: 'assistant', content: answer });
  }
}

const summary = {
  total: results.length,
  passed: results.filter(result => result.pass).length,
  failed: results.filter(result => !result.pass).length,
};
console.log(JSON.stringify({ summary, results }, null, 2));
if (summary.failed) process.exitCode = 1;

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'user-agent': 'Elitea-Production-QA/0.30.0',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error || `HTTP ${response.status}`}`);
  return payload;
}
