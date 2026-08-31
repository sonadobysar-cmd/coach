import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const server = await readFile(join(ROOT, 'src', 'server.js'), 'utf8');

test('server nastavuje základní ochranné hlavičky', () => {
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /Permissions-Policy/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /X-Frame-Options/);
  assert.match(server, /Strict-Transport-Security/);
});

test('cloudový autentizační balík se načítá dynamicky až při vstupu do členství', async () => {
  const app = await readFile(join(ROOT, 'src', 'browser-app.js'), 'utf8');
  const packageJson = await readFile(join(ROOT, 'package.json'), 'utf8');
  assert.doesNotMatch(app, /import \{ createEliteaCloud \} from '\.\/cloud\.js'/);
  assert.match(app, /import\(cloudModuleUrl\)/);
  assert.match(packageJson, /--minify/);
});

test('autorizované JSON požadavky zachovají Content-Type i Authorization', async () => {
  const app = await readFile(join(ROOT, 'src', 'browser-app.js'), 'utf8');
  const requestHelper = app.match(/async function request\(path, options = \{\}\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(requestHelper, /\.\.\.options,[\s\S]*headers: \{ 'Content-Type': 'application\/json', \.\.\.\(options\.headers \|\| \{\}\) \}/);
  assert.doesNotMatch(requestHelper, /headers:[\s\S]*\.\.\.options,[\s\S]*fetch/);
});

test('chráněné požadavky obnoví Neon session a nikdy neukážou syrovou JWT chybu', async () => {
  const [app, cloud] = await Promise.all([
    readFile(join(ROOT, 'src', 'browser-app.js'), 'utf8'),
    readFile(join(ROOT, 'src', 'browser-cloud.js'), 'utf8'),
  ]);
  assert.match(cloud, /getSession\(forceFetch \? \{ forceFetch: true \} : undefined\)/);
  assert.match(cloud, /authorization: async \(\{ forceRefresh = true \} = \{\}\)/);
  assert.match(app, /state\.cloud\?\.authorization\(\{ forceRefresh: true \}\)/);
  assert.match(app, /if \(error\?\.status !== 401\) throw error/);
  assert.match(app, /\(\?:claim\|jwt\|token\|timestamp/);
  assert.match(app, /Přihlášení vypršelo\. Přihlas se prosím znovu\./);
  assert.match(cloud, /try \{[\s\S]*current = await session\(\{ forceFetch: forceRefresh \}\)[\s\S]*catch \{[\s\S]*jwtToken = ''[\s\S]*return ''/);
  assert.match(app, /async function freshAuthorization\(\)[\s\S]*promptExpiredSession\(\)/);
  assert.match(app, /setAuthMode\('signin'\)[\s\S]*authDialog\.showModal\(\)/);
});

test('AI odpověď rezervuje fair-use zprávu ještě před voláním modelu', () => {
  const chatRoute = server.match(/app\.post\('\/api\/chat'[\s\S]*?\n}\);/)?.[0] || '';
  const trainingRoute = server.match(/app\.post\('\/api\/training'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(chatRoute, /await reserveAiTurn/);
  assert.match(trainingRoute, /await reserveAiTurn/);
  assert.match(server, /app\.get\('\/api\/ai-usage'/);
});

test('serverové logy nezapisují tělo zprávy ani objekt paměti', () => {
  const logCalls = [...server.matchAll(/console\.(?:log|warn|error)\((.*?)\);/gs)].map(match => match[1]).join('\n');
  assert.doesNotMatch(logCalls, /request\.body/);
  assert.doesNotMatch(logCalls, /memory/);
  assert.doesNotMatch(logCalls, /messages/);
});

test('hlášení kvality prochází sanitizací a nikdy neloguje text chatu', () => {
  const reportRoute = server.match(/app\.post\('\/api\/quality-report'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(reportRoute, /sameHost\(origin, request\.get\('host'\)\)/);
  assert.match(reportRoute, /sanitizeQualityReport\(request\.body\)/);
  assert.doesNotMatch(reportRoute, /messageText|messages|chatHistory|content/);
});

test('rezervační endpoint má kontrolu původu, validaci a nikdy nepředává chat', () => {
  assert.match(server, /sameHost\(origin, request\.get\('host'\)\)/);
  assert.match(server, /sanitizeBookingRequest\(request\.body\)/);
  assert.match(server, /sendBookingRequest\(parsed\.value\)/);
  assert.match(server, /sanitizeCourseRequest\(request\.body\)/);
  assert.match(server, /sendCourseRequest\(parsed\.value\)/);
  const bookingRoute = server.match(/app\.post\('\/api\/booking-request'[\s\S]*?\n}\);/)?.[0] || '';
  assert.doesNotMatch(bookingRoute, /messages|chatHistory|request\.body\?\.messages/);
});

test('plný kurz i tréninkový scénář vyžadují autorizované členství', () => {
  const courseRoute = server.match(/app\.get\('\/api\/courses\/:slug'[\s\S]*?\n}\);/)?.[0] || '';
  const scenarioRoute = server.match(/app\.get\('\/api\/training\/scenario'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(courseRoute, /await authorizeAiRequest\(request\)/);
  assert.match(courseRoute, /publicCourseDetail\(course\)/);
  assert.match(scenarioRoute, /await authorizeAiRequest\(request\)/);
  assert.match(scenarioRoute, /publicTrainingScenario\(scenario\)/);
});

test('bodování kurzového testu je serverové, přihlášené a chráněné původem', () => {
  const quizRoute = server.match(/app\.post\('\/api\/courses\/:slug\/quizzes\/:itemId\/submit'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(quizRoute, /validMutationOrigin/);
  assert.match(quizRoute, /authorizeAiRequest/);
  assert.match(quizRoute, /submitCourseQuizAttempt/);
  assert.doesNotMatch(quizRoute, /scorePercent\s*=|passed\s*=\s*request\.body/);
});

test('vydání i stažení certifikátu je přihlášené a pravost lze veřejně ověřit nahráním PDF', () => {
  const issueRoute = server.match(/app\.post\('\/api\/certificates\/:slug\/issue'[\s\S]*?\n}\);/)?.[0] || '';
  const downloadRoute = server.match(/app\.get\('\/api\/certificates\/:slug\/download'[\s\S]*?\n}\);/)?.[0] || '';
  const verifyRoute = server.match(/app\.post\('\/api\/certificates\/verify'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(issueRoute, /validMutationOrigin/);
  assert.match(issueRoute, /authorizeAiRequest/);
  assert.match(issueRoute, /issueCertificate/);
  assert.match(downloadRoute, /authorizeAiRequest/);
  assert.match(downloadRoute, /certificatePdf/);
  assert.match(verifyRoute, /express\.raw/);
  assert.match(verifyRoute, /verifyCertificateDocument/);
  assert.match(verifyRoute, /allowPublicTestRequest/);
  assert.doesNotMatch(verifyRoute, /authorizeAiRequest/);
});

test('produkční QA certifikátu je skryté a chráněné samostatným tajným klíčem i allowlistem účtů', () => {
  const qaRoute = server.match(/app\.post\('\/api\/internal\/certificate-production-qa'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(qaRoute, /authorizeCertificateQaRequest/);
  assert.match(qaRoute, /runCertificateProductionQa/);
  assert.match(qaRoute, /status\(404\)/);
  assert.doesNotMatch(qaRoute, /ELITEA_CERTIFICATE_QA_SECRET|ELITEA_CERTIFICATE_QA_USER_IDS/);
});

test('health endpoint kontroluje všechny klíčové produkční závislosti bez tajných hodnot', () => {
  const healthRoute = server.match(/app\.get\('\/api\/health'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(healthRoute, /ai:/);
  assert.match(healthRoute, /auth:/);
  assert.match(healthRoute, /payments:/);
  assert.match(healthRoute, /booking:/);
  assert.match(healthRoute, /lifecycleEmail:/);
  assert.match(healthRoute, /cron: Boolean\(process\.env\.CRON_SECRET\)/);
  assert.match(healthRoute, /runtimeSchema:/);
  assert.match(healthRoute, /certificateSigning:/);
  assert.match(healthRoute, /status\(ok \? 200 : 503\)/);
  assert.doesNotMatch(healthRoute, /API_KEY\s*:/);
});

test('veřejný coach test je oddělený, podepsaný, omezený a nekopíruje členskou paměť', () => {
  const sessionRoute = server.match(/app\.post\('\/api\/public-coach-test\/session'[\s\S]*?\n}\);/)?.[0] || '';
  const chatRoute = server.match(/app\.post\('\/api\/public-coach-test\/chat'[\s\S]*?\n}\);/)?.[0] || '';
  const feedbackRoute = server.match(/app\.post\('\/api\/public-coach-test\/feedback'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(sessionRoute, /validMutationOrigin/);
  assert.match(sessionRoute, /allowPublicTestRequest/);
  assert.match(chatRoute, /advancePublicCoachTestSession/);
  assert.match(chatRoute, /publicTestMemory/);
  assert.doesNotMatch(chatRoute, /authorizeAiRequest|membershipFor/);
  assert.match(feedbackRoute, /sanitizePublicCoachTestFeedback/);
  assert.match(feedbackRoute, /savePublicCoachTestFeedback/);
  assert.doesNotMatch(feedbackRoute, /console\.(?:log|warn|error)\([^)]*(?:notes|messages|transcript)/);
});

test('přehled coach testů je chráněný přihlášením a vlastnickou rolí', () => {
  const adminRoute = server.match(/app\.get\('\/api\/public-coach-test\/admin\/feedback'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(adminRoute, /verifyMemberAuthorization/);
  assert.match(adminRoute, /isOwnerMember/);
  assert.match(adminRoute, /listPublicCoachTestFeedback/);
  assert.match(adminRoute, /Cache-Control', 'no-store/);
});
