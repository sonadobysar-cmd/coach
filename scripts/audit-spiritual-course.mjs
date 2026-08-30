import { readFile } from 'node:fs/promises';
import { parseCourse } from '../src/courses.js';

const LEGACY_BRAND_PATTERN = new RegExp(`\\b(?:${[['self', 'aya'], ['eli', 'tela'], ['ni', 'aia']].map(parts => parts.join('')).join('|')})\\b`, 'i');

const markdown = await readFile(new URL('../data/course-spiritualni-koucink.md', import.meta.url), 'utf8');
const course = parseCourse(markdown, { id: 'spiritualni-koucink-practice' });
const materials = JSON.parse(await readFile(new URL('../data/course-spiritualni-koucink-materials.json', import.meta.url), 'utf8'));
const audio = await readFile(new URL('../data/course-spiritualni-koucink-audio-scripts.md', import.meta.url), 'utf8');

const rows = course.modules.flatMap((module, moduleIndex) => module.items.map(item => ({
  module: moduleIndex,
  id: item.id,
  kind: item.kind,
  minutes: item.minutes,
  words: item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length,
  title: item.title,
  materials: materials.filter(material => material.itemId === item.id).length,
})));

const issues = [];
const validItemIds = new Set(rows.map(row => row.id));
const materialIds = new Set();
for (const material of materials) {
  if (materialIds.has(material.id)) issues.push(`Duplicitní ID materiálu: ${material.id}`);
  materialIds.add(material.id);
  if (!validItemIds.has(material.itemId)) issues.push(`Materiál ${material.id} odkazuje na neexistující ${material.itemId}`);
  if (!Array.isArray(material.prompts) || material.prompts.length < 5) issues.push(`Materiál ${material.id} má méně než 5 polí`);
}

for (const [moduleIndex, module] of course.modules.entries()) {
  const labels = module.items.map(item => item.title.match(/(?:Lekce|aplikace)\s+(\d+)\.(\d+)/i)).filter(Boolean);
  for (const match of labels) {
    if (Number(match[1]) !== moduleIndex) issues.push(`Nesoulad číslování v modulu ${moduleIndex}: ${match[0]}`);
  }
  const numbered = labels.map(match => Number(match[2])).sort((a, b) => a - b);
  const duplicates = numbered.filter((number, index) => number === numbered[index - 1]);
  if (duplicates.length) issues.push(`Duplicitní číslo v modulu ${moduleIndex}: ${[...new Set(duplicates)].join(', ')}`);
}

const asciiQuoteLines = markdown.split('\n').flatMap((line, index) => {
  if (/^\s*<!--\s*elitea-visual:/i.test(line)) return [];
  return /[\p{L}ěščřžýáíéúůóďťň][?!.,]?"/u.test(line) ? [index + 1] : [];
});
if (asciiQuoteLines.length) issues.push(`Podezřelé ASCII koncové uvozovky na řádcích: ${asciiQuoteLines.join(', ')}`);
if (LEGACY_BRAND_PATTERN.test(markdown)) issues.push('Kurz obsahuje historický název značky.');
if (/až bude v Academy otevřen/i.test(markdown)) issues.push('Kurz obsahuje zastaralou podmínku otevření modulu.');

const audioNames = [...audio.matchAll(/^## AUDIO \d+ — (.+)$/gm)].map(match => match[1].trim());
if (audioNames.length !== 10) issues.push(`Očekáváno 10 scénářů audia, nalezeno ${audioNames.length}.`);

console.table(rows.filter(row => row.words < 90 || (row.minutes >= 25 && row.words < 160)));
console.log({
  modules: course.moduleCount,
  items: rows.length,
  minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
  courseWords: rows.reduce((sum, row) => sum + row.words, 0),
  materials: materials.length,
  materialPrompts: materials.reduce((sum, material) => sum + material.prompts.length, 0),
  audioScripts: audioNames.length,
});
console.log('materialsByModule', Object.entries(Object.groupBy(materials, material => material.moduleIndex)).map(([module, items]) => [module, items.length]));
console.log('itemsByKind', Object.entries(Object.groupBy(rows, row => row.kind)).map(([kind, items]) => [kind, items.length]));
console.log('wordsByModule', course.modules.map((module, moduleIndex) => ({
  module: moduleIndex,
  words: rows.filter(row => row.module === moduleIndex).reduce((sum, row) => sum + row.words, 0),
  minutes: rows.filter(row => row.module === moduleIndex).reduce((sum, row) => sum + row.minutes, 0),
  materials: materials.filter(material => material.moduleIndex === moduleIndex).length,
})));
console.log('auditIssues', issues);
if (issues.length) process.exitCode = 1;
