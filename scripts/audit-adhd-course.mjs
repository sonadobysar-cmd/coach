import { readFile } from 'node:fs/promises';
import { parseCourse } from '../src/courses.js';
import { expandAdhdMaterials } from '../src/adhd-materials.js';

const markdown = await readFile(new URL('../data/course-adhd-focus-motivace.md', import.meta.url), 'utf8');
const course = parseCourse(markdown, { id: 'adhd-focus-motivace' });
const materialDefinitions = JSON.parse(await readFile(new URL('../data/course-adhd-focus-motivace-materials.json', import.meta.url), 'utf8'));
const materials = expandAdhdMaterials(materialDefinitions);
const audio = await readFile(new URL('../data/course-adhd-focus-motivace-audio-scripts.md', import.meta.url), 'utf8');
const rows = course.modules.flatMap((module, moduleIndex) => module.items.map(item => ({
  module: moduleIndex,
  id: item.id,
  kind: item.kind,
  minutes: item.minutes,
  words: item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length,
})));
const issues = [];
const validItemIds = new Set(rows.map(row => row.id));
const totalWords = rows.reduce((sum, row) => sum + row.words, 0);
const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
if (course.moduleCount !== 16) issues.push(`Očekáváno 16 modulů, nalezeno ${course.moduleCount}.`);
if (rows.length !== 96) issues.push(`Očekáváno 96 částí, nalezeno ${rows.length}.`);
if (totalMinutes !== 1920) issues.push(`Součet studijního času není 1 920 minut, ale ${totalMinutes}.`);
if (totalWords < 8500) issues.push(`Studijní text má pouze ${totalWords} slov.`);
if (materials.length !== 17) issues.push(`Očekáváno 17 materiálů, nalezeno ${materials.length}.`);
if (!course.modules.every((module, moduleIndex) => materials.some(material => material.moduleIndex === moduleIndex))) issues.push('Některý modul nemá pracovní materiál.');
const materialIds = new Set();
for (const material of materials) {
  if (materialIds.has(material.id)) issues.push(`Duplicitní ID materiálu: ${material.id}`);
  materialIds.add(material.id);
  if (!validItemIds.has(material.itemId)) issues.push(`Materiál ${material.id} odkazuje na neexistující ${material.itemId}.`);
  if (!Array.isArray(material.prompts) || material.prompts.length < 5) issues.push(`Materiál ${material.id} má méně než pět polí.`);
  if (!Array.isArray(material.howToUse) || material.howToUse.length < 4) issues.push(`Materiál ${material.id} nemá úplný postup.`);
  if (!material.purpose || material.purpose.length <= 50) issues.push(`Materiál ${material.id} nemá dostatečný účel.`);
  if (!material.boundary || material.boundary.length <= 50) issues.push(`Materiál ${material.id} nemá dostatečnou hranici.`);
}
for (const [moduleIndex, module] of course.modules.entries()) {
  if (module.items.length !== 6) issues.push(`Modul ${moduleIndex} nemá přesně šest částí.`);
  if (module.items.reduce((sum, item) => sum + item.minutes, 0) !== 120) issues.push(`Modul ${moduleIndex} nemá přesně 120 minut.`);
  const lessons = module.items.filter(item => item.kind === 'lesson');
  if (lessons.length !== 3) issues.push(`Modul ${moduleIndex} nemá tři výkladové lekce.`);
  if (!module.items.some(item => item.kind === 'self-practice')) issues.push(`Modul ${moduleIndex} nemá laboratoř.`);
  if (!module.items.some(item => item.kind === 'client-practice')) issues.push(`Modul ${moduleIndex} nemá profesní simulaci.`);
  if (!module.items.some(item => item.kind === 'quiz')) issues.push(`Modul ${moduleIndex} nemá test.`);
}
if (/\b(?:Elitea|Elitea)\b/i.test(markdown)) issues.push('Kurz obsahuje starý název Elitea/Elitea.');
if (/\b(?:vyléčí ADHD|vyléčení ADHD|nahrazuje léčbu|dopamin na povel)\b/i.test(markdown)) issues.push('Kurz obsahuje nepřijatelný klinický nebo neurochemický slib.');
for (const requiredBoundary of ['nenahrazuje', 'diagnó', 'medik', 'souhlas', 'stop']) {
  if (!new RegExp(requiredBoundary, 'i').test(markdown)) issues.push(`Chybí bezpečnostní motiv: ${requiredBoundary}.`);
}
const audioNames = [...audio.matchAll(/^## AUDIO \d+ — (.+)$/gm)].map(match => match[1].trim());
if (audioNames.length !== 8) issues.push(`Očekáváno osm audio scénářů, nalezeno ${audioNames.length}.`);
if ((audio.match(/### Doslovný text/g) || []).length !== 8) issues.push('Některé audio nemá doslovný text.');
if (!/kdykoli (?:skončit|přestat)/i.test(audio)) issues.push('Audio balíček nemá jasnou možnost ukončení.');

console.table(course.modules.map((module, moduleIndex) => ({
  module: moduleIndex,
  items: module.items.length,
  minutes: module.items.reduce((sum, item) => sum + item.minutes, 0),
  words: rows.filter(row => row.module === moduleIndex).reduce((sum, row) => sum + row.words, 0),
  materials: materials.filter(material => material.moduleIndex === moduleIndex).length,
})));
console.log({ modules: course.moduleCount, items: rows.length, minutes: totalMinutes, courseWords: totalWords, materials: materials.length, materialPrompts: materials.reduce((sum, material) => sum + material.prompts.length, 0), audioScripts: audioNames.length });
console.log('auditIssues', issues);
if (issues.length) process.exitCode = 1;
