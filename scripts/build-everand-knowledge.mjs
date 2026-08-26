import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const corpusDir = resolve(
  args.get('--corpus-dir')
    || process.env.ELITEA_EVERAND_CORPUS_DIR
    || '/Users/soni/Documents/Codex/2026-08-23/ah',
);
const outputPath = resolve(args.get('--output') || join(ROOT, 'data', 'everand-knowledge.jsonl'));
const manifestPath = resolve(args.get('--manifest') || join(ROOT, 'data', 'everand-knowledge-manifest.json'));
const maxSource = Number(args.get('--max-source') || 135);
const maxTool = Number(args.get('--max-tool') || 993);

const knowledgePath = join(corpusDir, 'work', 'elitea_everand_knowledge.md');
const matrixPath = join(corpusDir, 'outputs', 'elitea-matice-pokryti-a-nastroju.md');
const [knowledgeMarkdown, matrixMarkdown] = await Promise.all([
  readFile(knowledgePath, 'utf8'),
  readFile(matrixPath, 'utf8'),
]);

const completedSources = parseCompletedSources(knowledgeMarkdown, maxSource);
const sourceRows = parseSourceRegistry(matrixMarkdown, maxSource);
const tools = parsePracticalTools(matrixMarkdown, maxTool);

assertSequential(completedSources.map(item => item.id), maxSource, 'zdroje ve znalostní bázi');
assertSequential(sourceRows.map(item => item.id), maxSource, 'zdroje v matici');
assertSequential(tools.map(item => item.id), maxTool, 'praktické nástroje');

const completedById = new Map(completedSources.map(item => [item.id, item]));
const sourceRecords = sourceRows.map((source, index) => {
  const completed = completedById.get(source.id);
  if (!completed) throw new Error(`Chybí dokončený zdroj ${source.id}.`);
  return {
    source_id: `everand-source-${String(source.id).padStart(3, '0')}`,
    domain: inferDomain(`${source.title} ${source.safeUse}`),
    section: 'Kriticky zpracovaná knižní knihovna Elitea',
    topic: stripMarkdown(source.title),
    content: [
      `Důkazní váha pro použití v Elitea: ${source.weight}.`,
      `Bezpečně použitelný přínos po odborném přepracování: ${clean(source.safeUse)}.`,
      `Kniha byla ve výzkumném korpusu zpracována jako dokončený zdroj č. ${source.id}.`,
    ].join(' '),
    source_type: 'everand_critical_synthesis',
    source_origin: `Everand výzkumný korpus Elitea, dokončený zdroj ${source.id}`,
    knowledge_role: 'evidence_corrected_book_synthesis',
    evidence_level: source.weight,
    review_status: 'reviewed_safe_translation',
    approved_for_ai: true,
    practice_mode: 'apply_principles',
    boundary: `Nepřebírat bez dalšího ověření: ${clean(source.risks)}.`,
    do_not_use_as: ['universal_scientific_fact', 'diagnosis', 'treatment', 'guarantee'],
    safety_tags: ['book_synthesis', 'evidence_corrected', 'opinion_filtered_runtime_layer'],
    language: 'cs',
    version: '1.0',
    sequence: 10_000 + index,
  };
});

const toolRecords = tools.map((tool, index) => ({
  source_id: `everand-tool-${String(tool.id).padStart(3, '0')}`,
  domain: inferDomain(`${tool.title} ${tool.body}`),
  section: 'Praktický nástroj z kriticky zpracované knižní knihovny',
  topic: clean(tool.title),
  content: clean(tool.body),
  source_type: 'everand_practical_tool',
  source_origin: `Matice praktických nástrojů Elitea, nástroj ${tool.id}; odvozeno pouze z dokončených zdrojů 1–${maxSource}`,
  knowledge_role: 'evidence_corrected_practical_method',
  evidence_level: 'mixed_source_critical_synthesis',
  review_status: 'reviewed_safe_translation',
  approved_for_ai: true,
  practice_mode: 'guided_practice',
  boundary: extractBullet(tool.body, 'Pojistka') || 'Použít pouze s kontextem, souhlasem, možností zastavit a kontrolou účinku.',
  do_not_use_as: ['diagnosis', 'treatment', 'covert_manipulation', 'guarantee'],
  safety_tags: ['book_derived_tool', 'guardrail_required', 'opinion_filtered_runtime_layer'],
  language: 'cs',
  version: '1.0',
  sequence: 20_000 + index,
}));

const records = [...toolRecords, ...sourceRecords];
await writeFile(outputPath, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');
await writeFile(manifestPath, `${JSON.stringify({
  schema_version: 1,
  generated_on: '2026-08-24',
  source_checkpoint: maxSource,
  practical_tool_checkpoint: maxTool,
  completed_sources: sourceRecords.length,
  practical_tools: toolRecords.length,
  total_records: records.length,
  excludes_in_progress_sources: true,
  governance_policy: 'Only evidence-corrected safe translations and explicit tool guardrails enter runtime. Pending claims and political source opinions are not imported.',
  source_files: [
    'work/elitea_everand_knowledge.md',
    'outputs/elitea-matice-pokryti-a-nastroju.md',
  ],
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  output: outputPath,
  manifest: manifestPath,
  completedSources: sourceRecords.length,
  practicalTools: toolRecords.length,
  totalRecords: records.length,
}));

function parseCompletedSources(markdown, ceiling) {
  const matches = [...markdown.matchAll(/^## Zdroj (\d+):\s+(.+)$/gm)];
  return matches
    .map((match, index) => {
      const id = Number(match[1]);
      const body = markdown.slice(match.index, matches[index + 1]?.index ?? markdown.length);
      return { id, title: clean(match[2]), body };
    })
    .filter(item => item.id <= ceiling);
}

function parseSourceRegistry(markdown, ceiling) {
  return markdown
    .split('\n')
    .map(line => line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/))
    .filter(Boolean)
    .map(match => ({
      id: Number(match[1]),
      title: match[2],
      weight: clean(match[3]),
      safeUse: match[4],
      risks: match[5],
    }))
    .filter(item => item.id <= ceiling);
}

function parsePracticalTools(markdown, ceiling) {
  const matches = [...markdown.matchAll(/^### (\d+)\.\s+(.+)$/gm)];
  return matches
    .map((match, index) => ({
      id: Number(match[1]),
      title: match[2],
      body: markdown.slice(match.index + match[0].length, matches[index + 1]?.index ?? markdown.length).trim(),
    }))
    .filter(item => item.id <= ceiling);
}

function extractBullet(body, label) {
  const match = body.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'mi'));
  return match ? clean(match[1]) : '';
}

function inferDomain(value) {
  const normalized = clean(value).toLowerCase();
  const rules = [
    ['business_marketing_sales', /business|podnik|prodej|marketing|zákazn|nabídk|cena|brand|landing|reklam|customer|sales|finance|money|cashflow/],
    ['communication_relationships', /komunik|rozhovor|naslouch|small talk|vztah|konflikt|vyjednáv|story|speaking|presentation|hranice|boundary/],
    ['leadership_work', /leader|veden|tým|team|management|workplace|career|kariér|zaměstn|deleg|hiring/],
    ['emotions_self_relationship', /emoc|úzkost|strach|sebe|confidence|compassion|mindset|belief|stress|burnout|vyhoř|identity|kritik/],
    ['habits_decisions_performance', /návyk|habit|cíl|goal|pozornost|decision|rozhod|produktiv|čas|time|focus|výkon/],
    ['meaning_spirituality', /purpose|smysl|spirit|medit|mindful|faith|vír|intuic/],
  ];
  return rules.find(([, pattern]) => pattern.test(normalized))?.[0] || 'integrated_coaching_mentoring';
}

function stripMarkdown(value) {
  return clean(value).replace(/[*_`]/g, '');
}

function clean(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function assertSequential(ids, expectedMax, label) {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  const missing = [];
  for (let id = 1; id <= expectedMax; id += 1) {
    if (!unique.includes(id)) missing.push(id);
  }
  if (unique.length !== expectedMax || missing.length || unique.at(-1) !== expectedMax) {
    throw new Error(`Neúplné ${label}: nalezeno ${unique.length}, maximum ${unique.at(-1)}, chybí ${missing.slice(0, 20).join(', ')}.`);
  }
}
