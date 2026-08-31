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
  const titleElements = title.map((line, index) =>
    `<text x="1755" y="${titleStart + index * titleGap}" text-anchor="middle" class="program">${escapeXml(line)}</text>`).join('');
  const namePath = centeredFontPath(assets.nameFont, memberName, 1755, 1645, 132);
  const overlay = Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <style>
      @font-face { font-family: 'Elitea Manrope'; src: url(data:font/woff2;base64,${assets.manrope}); font-weight: 700; }
      .program { font-family: 'Elitea Manrope'; font-size: ${titleFontSize}px; font-weight: 700; letter-spacing: 16px; fill: #c98a00; }
      .date { font-family: 'Elitea Manrope'; font-size: 54px; font-weight: 700; fill: ${textColor}; }
    </style>
    ${titleElements}
    <path d="${namePath}" fill="${textColor}"/>
    <text x="2585" y="1815" text-anchor="middle" class="date">${escapeXml(date)}</text>
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
    readFile(join(PUBLIC_DIR, 'fonts', 'manrope-latin-ext.woff2')),
  ]).then(([light, dark, greatVibes, manrope]) => ({
    light,
    dark,
    nameFont: opentype.parse(greatVibes.buffer.slice(greatVibes.byteOffset, greatVibes.byteOffset + greatVibes.byteLength)),
    manrope: manrope.toString('base64'),
  }));
  return assetPromise;
}

function centeredFontPath(font, value, centerX, baselineY, fontSize) {
  const text = String(value || '').trim();
  const width = font.getAdvanceWidth(text, fontSize, { kerning: true });
  return font.getPath(text, centerX - width / 2, baselineY, fontSize, { kerning: true }).toPathData(2);
}

function escapeXml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[character]));
}
