import { readFile, writeFile } from 'node:fs/promises';

const generatedAssets = [
  new URL('../public/app.js', import.meta.url),
  new URL('../public/cloud.js', import.meta.url),
];

for (const assetUrl of generatedAssets) {
  const source = await readFile(assetUrl, 'utf8');
  const cleaned = source.replace(/[\t ]+$/gm, '');
  if (cleaned !== source) {
    await writeFile(assetUrl, cleaned, 'utf8');
  }
}
