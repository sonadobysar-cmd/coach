import { readFile } from 'node:fs/promises';
import { parseCourse } from '../src/courses.js';

const markdown = await readFile(new URL('../data/course-komunikace-v-praxi.md', import.meta.url), 'utf8');
const course = parseCourse(markdown, { id: 'komunikace-v-praxi' });
const materials = JSON.parse(await readFile(new URL('../data/course-komunikace-v-praxi-materials.json', import.meta.url), 'utf8'));
const audio = await readFile(new URL('../data/course-komunikace-v-praxi-audio-scripts.md', import.meta.url), 'utf8');

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
if (course.moduleCount !== 16) issues.push(`Očekáváno 16 modulů, nalezeno ${course.moduleCount}.`);
if (rows.length !== 96) issues.push(`Očekáváno 96 částí, nalezeno ${rows.length}.`);
if (rows.reduce((sum, row) => sum + row.minutes, 0) !== 2400) issues.push('Součet studijního času není přesně 2 400 minut.');
if (rows.reduce((sum, row) => sum + row.words, 0) < 10000) issues.push('Studijní text má méně než 10 000 slov.');
if (materials.length !== 17) issues.push(`Očekáváno 17 materiálů, nalezeno ${materials.length}.`);
if (!course.modules.every((module, moduleIndex) => materials.some(material => material.moduleIndex === moduleIndex))) issues.push('Některý modul nemá pracovní materiál.');

const materialIds = new Set();
for (const material of materials) {
  if (materialIds.has(material.id)) issues.push(`Duplicitní ID materiálu: ${material.id}`);
  materialIds.add(material.id);
  if (!validItemIds.has(material.itemId)) issues.push(`Materiál ${material.id} odkazuje na neexistující ${material.itemId}`);
  if (!Array.isArray(material.prompts) || material.prompts.length < 5) issues.push(`Materiál ${material.id} má méně než 5 polí`);
}
for (const [moduleIndex, module] of course.modules.entries()) {
  if (module.items.length !== 6) issues.push(`Modul ${moduleIndex} nemá přesně 6 částí.`);
  const labels = module.items.map(item => item.title.match(/(?:Lekce|aplikace)\s+(\d+)\.(\d+)/i)).filter(Boolean);
  for (const match of labels) if (Number(match[1]) !== moduleIndex) issues.push(`Nesoulad číslování v modulu ${moduleIndex}: ${match[0]}`);
}
const asciiQuoteLines = markdown.split('\n').flatMap((line, index) => /[\p{L}ěščřžýáíéúůóďťň][?!.,]?"/u.test(line) ? [index + 1] : []);
if (asciiQuoteLines.length) issues.push(`Podezřelé ASCII koncové uvozovky na řádcích: ${asciiQuoteLines.join(', ')}`);
if (/\b(?:Elitea|Elitea)\b/i.test(markdown)) issues.push('Kurz obsahuje starý název Elitea/Elitea.');
const audioNames = [...audio.matchAll(/^## AUDIO \d+ — (.+)$/gm)].map(match => match[1].trim());
if (audioNames.length !== 8) issues.push(`Očekáváno 8 scénářů audia, nalezeno ${audioNames.length}.`);
if ((audio.match(/### Doslovný text/g) || []).length !== 8) issues.push('Některé audio nemá doslovný text.');

console.table(course.modules.map((module, moduleIndex) => ({
  module: moduleIndex,
  items: module.items.length,
  minutes: module.items.reduce((sum, item) => sum + item.minutes, 0),
  words: rows.filter(row => row.module === moduleIndex).reduce((sum, row) => sum + row.words, 0),
  materials: materials.filter(material => material.moduleIndex === moduleIndex).length,
})));
console.log({
  modules: course.moduleCount,
  items: rows.length,
  minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
  courseWords: rows.reduce((sum, row) => sum + row.words, 0),
  materials: materials.length,
  materialPrompts: materials.reduce((sum, material) => sum + material.prompts.length, 0),
  audioScripts: audioNames.length,
});
console.log('auditIssues', issues);
if (issues.length) process.exitCode = 1;
