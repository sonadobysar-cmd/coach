import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import opentype from 'opentype.js';
import {
  CERTIFICATE_AUTH_MARKER,
  certificateVisualFingerprint,
  createCertificateVerificationToken,
} from './certificate-authenticity.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const WIDTH = 3510;
const HEIGHT = 2482;

let assetPromise;

export async function renderCertificatePdf({
  memberName,
  courseTitle,
  completedAt,
  variant = 'light',
  authenticity = null,
  env = process.env,
} = {}) {
  const assets = await certificateAssets();
  const safeVariant = variant === 'dark' ? 'dark' : 'light';
  const background = safeVariant === 'dark' ? assets.dark : assets.light;
  const textColor = safeVariant === 'dark' ? '#fffdf8' : '#151313';
  const date = formatCertificateDate(completedAt);
  const title = wrapCertificateTitle(courseTitle);
  const titleFontSize = title.length === 1 ? 92 : 74;
  const titleStart = title.length === 1 ? 1245 : 1198;
  const titleGap = titleFontSize + 18;
  const titleElements = title.map((line, index) => (
    `<path d="${centeredFontPath(assets.manropeBoldFont, line, 1755, titleStart + index * titleGap, titleFontSize, 16)}" fill="#c98a00"/>`
  )).join('');
  const namePath = centeredFontPath(assets.nameFont, memberName, 1755, 1645, 132);
  const datePath = centeredFontPath(assets.manropeRegularFont, date, 2585, 1815, 54);
  const overlay = Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    ${titleElements}
    <path d="${namePath}" fill="${textColor}"/>
    <path d="${datePath}" fill="${textColor}"/>
  </svg>`);
  const composed = await sharp(background)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842.25, 595.5]);
  const image = await pdf.embedPng(composed);
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  pdf.setTitle(`Elitea Academy — ${String(courseTitle || '').trim()}`);
  pdf.setAuthor('Elitea Academy');
  pdf.setCreator('Elitea Academy');
  pdf.setProducer('Elitea Academy');
  pdf.setSubject('Potvrzení o úspěšném absolvování programu');
  const draft = Buffer.from(await pdf.save({ useObjectStreams: false }));
  if (!authenticity) return draft;
  const visualFingerprint = await certificateVisualFingerprint(draft);
  const token = createCertificateVerificationToken(authenticity, visualFingerprint, env);
  const signed = await PDFDocument.load(draft, { updateMetadata: false });
  signed.setKeywords([`${CERTIFICATE_AUTH_MARKER}${token}`]);
  return Buffer.from(await signed.save({ useObjectStreams: false }));
}

export function formatCertificateDate(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) throw new Error('Chybí platné datum absolvování.');
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Prague',
  }).format(date);
}

export function wrapCertificateTitle(value, maxLineLength = 38) {
  const words = String(value || '').replace(/^Elitea\s+/i, '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('cs-CZ').split(' ').filter(Boolean);
  if (!words.length) return ['PROGRAM'];
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxLineLength && lines.length === 0) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2) return [lines[0], lines.slice(1).join(' ')];
  return lines;
}

async function certificateAssets() {
  assetPromise ||= Promise.all([
    readFile(join(PUBLIC_DIR, 'certificates', 'certificate-light-template.png')),
    readFile(join(PUBLIC_DIR, 'certificates', 'certificate-dark-template.png')),
    readFile(join(PUBLIC_DIR, 'fonts', 'great-vibes-latin-ext.ttf')),
    readFile(join(PUBLIC_DIR, 'fonts', 'manrope-bold.ttf')),
    readFile(join(PUBLIC_DIR, 'fonts', 'manrope-regular.ttf')),
  ]).then(([light, dark, greatVibes, manropeBold, manropeRegular]) => ({
    light,
    dark,
    nameFont: opentype.parse(greatVibes.buffer.slice(greatVibes.byteOffset, greatVibes.byteOffset + greatVibes.byteLength)),
    manropeBoldFont: opentype.parse(manropeBold.buffer.slice(manropeBold.byteOffset, manropeBold.byteOffset + manropeBold.byteLength)),
    manropeRegularFont: opentype.parse(manropeRegular.buffer.slice(manropeRegular.byteOffset, manropeRegular.byteOffset + manropeRegular.byteLength)),
  }));
  return assetPromise;
}

function centeredFontPath(font, value, centerX, baselineY, fontSize, letterSpacingPx = 0) {
  const text = String(value || '').trim();
  const options = { kerning: true, letterSpacing: letterSpacingPx / fontSize };
  const width = font.getAdvanceWidth(text, fontSize, options);
  return font.getPath(text, centerX - width / 2, baselineY, fontSize, options).toPathData(2);
}
