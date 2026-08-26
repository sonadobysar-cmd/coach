import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.jsonl', '.md', '.mjs', '.sql', '.txt']);
const SCANNED_DIRECTORIES = ['config', 'data', 'docs', 'public', 'scripts', 'src', 'test'];
const ROOT_FILES = ['.env.example', 'package.json', 'package-lock.json', 'README.md'];
const LEGACY_STEMS = [
  ['self', 'ay'].join(''),
  ['eli', 'tel'].join(''),
  ['ni', 'aia'].join('')
];

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(path));
    else if (TEXT_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

test('značka Elitea je ve zdrojích jednotná a bez historických názvů', async () => {
  const files = [
    ...ROOT_FILES.map(file => join(ROOT, file)),
    ...(await Promise.all(SCANNED_DIRECTORIES.map(directory => collectTextFiles(join(ROOT, directory))))).flat()
  ];

  for (const file of files) {
    const path = relative(ROOT, file);
    const normalizedPath = path.toLocaleLowerCase('cs');
    const content = (await readFile(file, 'utf8')).toLocaleLowerCase('cs');
    for (const stem of LEGACY_STEMS) {
      assert.equal(normalizedPath.includes(stem), false, `Historický název v cestě: ${path}`);
      assert.equal(content.includes(stem), false, `Historický název v souboru: ${path}`);
    }
  }
});

test('veřejná metadata používají značku a doménu Elitea', async () => {
  const html = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(html, /<title>Elitea/);
  assert.match(html, /https:\/\/elitea\.cz\//);
  assert.match(html, /og-elitea\.png/);
});
