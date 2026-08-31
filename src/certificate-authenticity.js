import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PDFName, PDFDocument } from 'pdf-lib';

export const CERTIFICATE_AUTH_MARKER = 'elitea-auth-v1:';
const TOKEN_VERSION = 1;

export function certificateSigningConfigured(env = process.env) {
  return Buffer.byteLength(String(env.CERTIFICATE_SIGNING_SECRET || ''), 'utf8') >= 32;
}

export function createCertificateVerificationToken(record, visualFingerprint, env = process.env) {
  const secret = signingSecret(env);
  const payload = normalizeSignedRecord(record, visualFingerprint);
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `v${TOKEN_VERSION}.${encoded}.${signature}`;
}

export function verifyCertificateVerificationToken(token, env = process.env) {
  const secret = signingSecret(env);
  const match = String(token || '').match(/^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!match) return { valid: false, reason: 'missing_or_invalid_signature' };
  const [, encoded, provided] = match;
  const expected = createHmac('sha256', secret).update(encoded).digest();
  let actual;
  try { actual = Buffer.from(provided, 'base64url'); }
  catch { return { valid: false, reason: 'invalid_signature' }; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { valid: false, reason: 'invalid_signature' };
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!validSignedPayload(payload)) return { valid: false, reason: 'invalid_payload' };
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'invalid_payload' };
  }
}

export async function certificateVisualFingerprint(pdfBytes) {
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  if (pdf.getPageCount() !== 1) throw authenticityError('Certifikát musí mít právě jednu stránku.', 'CERTIFICATE_PAGE_COUNT_INVALID');
  const page = pdf.getPages()[0];
  const annotations = page.node.Annots();
  if (annotations?.size?.() > 0) throw authenticityError('Dokument obsahuje nepovolené interaktivní prvky.', 'CERTIFICATE_ANNOTATIONS_INVALID');
  const contents = page.node.Contents();
  if (!contents?.size || contents.size() < 1) throw authenticityError('Dokument nemá ověřitelný obrazový obsah.', 'CERTIFICATE_CONTENT_MISSING');
  const xObjects = page.node.Resources()?.lookup(PDFName.of('XObject'));
  const xEntries = [...(xObjects?.entries?.() || [])].sort(([left], [right]) => left.toString().localeCompare(right.toString()));
  if (xEntries.length !== 1) throw authenticityError('Dokument nemá očekávanou obrazovou strukturu.', 'CERTIFICATE_VISUAL_STRUCTURE_INVALID');

  const hash = createHash('sha256');
  hash.update('elitea-certificate-visual-v1\0');
  hash.update(String(page.getWidth()));
  hash.update('\0');
  hash.update(String(page.getHeight()));
  for (let index = 0; index < contents.size(); index += 1) {
    const stream = pdf.context.lookup(contents.get(index));
    if (!Buffer.isBuffer(stream?.contents) && !(stream?.contents instanceof Uint8Array)) {
      throw authenticityError('Obsah stránky nelze kryptograficky ověřit.', 'CERTIFICATE_CONTENT_INVALID');
    }
    hash.update('\0content\0');
    hash.update(Buffer.from(stream.contents));
  }
  for (const [name, reference] of xEntries) {
    const stream = pdf.context.lookup(reference);
    if (stream?.dict?.get(PDFName.of('Subtype'))?.toString() !== '/Image') {
      throw authenticityError('Dokument obsahuje neočekávaný typ objektu.', 'CERTIFICATE_VISUAL_STRUCTURE_INVALID');
    }
    hash.update('\0image\0');
    hash.update(name.toString());
    hash.update('\0');
    hash.update(Buffer.from(stream.contents || []));
  }
  return hash.digest('hex');
}

export async function extractCertificateVerification(pdfBytes) {
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const keywords = String(pdf.getKeywords() || '');
  const markerIndex = keywords.indexOf(CERTIFICATE_AUTH_MARKER);
  if (markerIndex < 0) return { token: '', visualFingerprint: await certificateVisualFingerprint(pdfBytes) };
  const token = keywords.slice(markerIndex + CERTIFICATE_AUTH_MARKER.length).split(/[\s,;]/)[0].trim();
  return { token, visualFingerprint: await certificateVisualFingerprint(pdfBytes) };
}

export function signedRecordMatchesDatabase(payload, record) {
  if (!payload || !record) return false;
  const database = normalizeSignedRecord({
    id: record.id,
    courseId: record.course_id || record.courseId,
    courseSlug: record.course_slug || record.courseSlug,
    memberName: record.member_name || record.memberName,
    courseTitle: record.course_title || record.courseTitle,
    completedAt: record.completed_at || record.completedAt,
    issuedAt: record.issued_at || record.issuedAt,
    evidenceHash: record.evidence_hash || record.evidenceHash,
  }, payload.visualFingerprint);
  return Object.keys(database).every(key => database[key] === payload[key]);
}

function normalizeSignedRecord(record, visualFingerprint) {
  const payload = {
    version: TOKEN_VERSION,
    certificateId: clean(record?.id, 80),
    courseId: clean(record?.courseId || record?.course_id, 160),
    courseSlug: clean(record?.courseSlug || record?.course_slug, 160),
    memberName: clean(record?.memberName || record?.member_name, 120),
    courseTitle: clean(record?.courseTitle || record?.course_title, 240),
    completedAt: validIso(record?.completedAt || record?.completed_at),
    issuedAt: validIso(record?.issuedAt || record?.issued_at),
    evidenceHash: clean(record?.evidenceHash || record?.evidence_hash, 128),
    visualFingerprint: clean(visualFingerprint, 128),
  };
  if (!validSignedPayload(payload)) throw authenticityError('Podklady pro podpis certifikátu nejsou úplné.', 'CERTIFICATE_SIGNATURE_PAYLOAD_INVALID');
  return payload;
}

function validSignedPayload(payload) {
  return payload?.version === TOKEN_VERSION
    && /^[0-9a-f-]{36}$/i.test(payload.certificateId || '')
    && Boolean(payload.courseId && payload.courseSlug && payload.memberName && payload.courseTitle)
    && /^[0-9a-f]{64}$/i.test(payload.evidenceHash || '')
    && /^[0-9a-f]{64}$/i.test(payload.visualFingerprint || '')
    && Boolean(validIso(payload.completedAt, false) && validIso(payload.issuedAt, false));
}

function signingSecret(env) {
  const secret = String(env.CERTIFICATE_SIGNING_SECRET || '');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw authenticityError('Kryptografické podepisování certifikátů zatím není připojené.', 'CERTIFICATE_SIGNING_UNAVAILABLE', 503);
  }
  return secret;
}

function validIso(value, fail = true) {
  const date = new Date(value || '');
  if (Number.isFinite(date.getTime())) return date.toISOString();
  if (fail) throw authenticityError('Podpis certifikátu obsahuje neplatné datum.', 'CERTIFICATE_SIGNATURE_DATE_INVALID');
  return '';
}

function clean(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function authenticityError(message, code, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}
