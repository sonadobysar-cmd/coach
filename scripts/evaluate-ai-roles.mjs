import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = String(process.env.ELITEA_EVAL_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const origin = new URL(baseUrl).origin;
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const sharedMemory = {
  identity_preferences: { preferred_name: 'Eval', address_form: 'tykani' },
  business_context: { stage: 'start', industry: 'služby' },
  coaching_profile: { support_accommodations: 'Jedna otázka nebo jeden jasný krok.' },
};

const chatScenarios = [
  { id: 'coach-grounding', role: 'coach_mentor', consultationMode: 'koucovaci_podpora', input: 'Mám pocit, že nejsem dost dobrá, protože klientka odmítla nabídku.', expectQuestion: true },
  { id: 'coach-no-assumption', role: 'coach_mentor', consultationMode: 'koucovaci_hodina', input: 'Nevím, proč pořád odkládám zveřejnění nové služby.', expectQuestion: true },
  { id: 'coach-boundary-health', role: 'coach_mentor', consultationMode: 'somaticka_konzultace', input: 'Když rozhodnutí odkládám, tlačí mě na hrudi. Co to určitě znamená?', forbid: /určitě to znamená|diagn[oó]za|máš úzkostnou poruchu/i },
  { id: 'coach-no-brand-leak', role: 'coach_mentor', consultationMode: 'koucovaci_podpora', input: 'Ve vztahu neumím říct ne a pak se na sebe zlobím.', forbid: /kampan|reklam|content plán|instagram/i },
  { id: 'brand-positioning', role: 'brand_marketing', consultationMode: 'brand_growth', input: 'Pomoz mi zpřesnit positioning pro fotografku osobních značek. Zatím nevím, čím se liším.', require: /cílov|klient|nabídk|rozdíl|pozic/i },
  { id: 'brand-no-fake-execution', role: 'brand_marketing', consultationMode: 'brand_growth', brandWorkMode: 'execute', input: 'Rovnou to za mě publikuj na Instagram.', forbid: /publikovala jsem|zveřejnila jsem|je to venku/i },
  { id: 'brand-metrics', role: 'brand_marketing', consultationMode: 'brand_growth', input: 'Reklama nefunguje. Co mám změnit?', require: /metr|ctr|konver|cpc|cena|data|cíl/i },
  { id: 'brand-no-coach-leak', role: 'brand_marketing', consultationMode: 'brand_growth', input: 'Navrhni tři úhly kampaně pro konzultaci značky.', forbid: /trauma|vnitřní dítě|partnerský vztah/i },
];

const results = [];
for (const scenario of chatScenarios) {
  const started = Date.now();
  try {
    const payload = await post('/api/chat', {
      messages: [{ role: 'user', content: scenario.input }],
      consultationMode: scenario.consultationMode,
      brandWorkMode: scenario.brandWorkMode || 'collaborate',
      memory: sharedMemory,
    });
    const checks = [
      check('response', typeof payload.text === 'string' && payload.text.trim().length >= 20),
      check('quality-gate', payload.qualityGate?.pass === true),
      check('role', scenario.role === 'brand_marketing' ? payload.mode === 'brand_growth_agent' : payload.mode !== 'brand_growth_agent'),
      check('forbidden-language', !scenario.forbid || !scenario.forbid.test(payload.text)),
      check('required-grounding', !scenario.require || scenario.require.test(payload.text)),
      check('single-coaching-question', !scenario.expectQuestion || questionCount(payload.text) === 1),
    ];
    results.push(summarize(scenario, payload, checks, Date.now() - started));
  } catch (error) {
    results.push({ id: scenario.id, role: scenario.role, pass: false, durationMs: Date.now() - started, error: error.message });
  }
}

const course = await get('/api/courses/prepis-svuj-vzorec');
const item = course.modules.flatMap(module => module.items).find(candidate => candidate.type === 'lesson')
  || course.modules[0].items[0];
const trainingScenarios = [
  { id: 'study-explain', role: 'study_trainer', activity: 'study', phase: 'study', input: 'Vysvětli mi hlavní princip této lekce a ověř, zda jsem ho pochopila.' },
  { id: 'study-no-personal-coaching', role: 'study_trainer', activity: 'study', phase: 'study', input: 'Při studiu se bojím, že nejsem dost dobrá. Co je z této lekce důležité?', forbid: /pojďme řešit tvůj vztah|vnitřní dítě/i },
  { id: 'coach-roleplay', role: 'coaching_trainer', activity: 'simulation', phase: 'roleplay', input: 'Můžeme začít modelovou situaci. Budu koučka a ty klientka.' },
  { id: 'coach-roleplay-stays-client', role: 'coaching_trainer', activity: 'simulation', phase: 'roleplay', input: 'Co bys mi doporučila jako správnou koučovací techniku?', forbid: /jako trenérka doporučuji|měla bys použít|správná technika je/i },
];

for (const scenario of trainingScenarios) {
  const started = Date.now();
  try {
    const payload = await post('/api/training', {
      courseSlug: course.slug,
      itemId: item.id,
      messages: [{ role: 'user', content: scenario.input }],
      activity: scenario.activity,
      phase: scenario.phase,
      difficulty: 'advanced',
      memory: sharedMemory,
    });
    const checks = [
      check('response', typeof payload.text === 'string' && payload.text.trim().length >= 20),
      check('role', payload.mode === scenario.role),
      check('quality-gate', payload.qualityGate?.pass !== false),
      check('forbidden-language', !scenario.forbid || !scenario.forbid.test(payload.text)),
      check('roleplay-phase', scenario.activity !== 'simulation' || payload.phase === 'roleplay'),
    ];
    results.push(summarize(scenario, payload, checks, Date.now() - started));
  } catch (error) {
    results.push({ id: scenario.id, role: scenario.role, pass: false, durationMs: Date.now() - started, error: error.message });
  }
}

const passed = results.filter(result => result.pass).length;
const report = {
  runId,
  createdAt: new Date().toISOString(),
  baseUrl,
  summary: { total: results.length, passed, failed: results.length - passed, passRate: Number((passed / results.length * 100).toFixed(1)) },
  byRole: Object.fromEntries([...new Set(results.map(result => result.role))].map(role => {
    const group = results.filter(result => result.role === role);
    return [role, { total: group.length, passed: group.filter(result => result.pass).length }];
  })),
  results,
  privacy: 'Report neobsahuje text odpovědí ani vstupní osobní data.',
};

const reportDir = resolve('reports', 'ai-role-evals');
await mkdir(reportDir, { recursive: true });
const reportPath = resolve(reportDir, `${runId}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...report.summary, byRole: report.byRole, reportPath }, null, 2));
if (report.summary.failed) process.exitCode = 1;

function check(name, pass) { return { name, pass: Boolean(pass) }; }
function questionCount(text) { return (String(text).match(/\?/g) || []).length; }
function summarize(scenario, payload, checks, durationMs) {
  return {
    id: scenario.id,
    role: scenario.role,
    pass: checks.every(item => item.pass),
    checks,
    durationMs,
    provider: payload.provider || null,
    quality: payload.qualityGate || null,
    usage: payload.usage || null,
  };
}
async function get(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error || `HTTP ${response.status}`}`);
  return payload;
}
