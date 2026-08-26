import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const content = JSON.parse(await readFile(join(ROOT, 'data', 'community-content.json'), 'utf8'));
const html = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
const css = await readFile(join(ROOT, 'public', 'styles.css'), 'utf8');
const client = await readFile(join(ROOT, 'public', 'app.js'), 'utf8');

test('komunitní knihovna pokrývá všechny požadované kategorie', () => {
  const categories = new Set(content.map(item => item.category));
  for (const category of ['business', 'meditation', 'yoga', 'aromatherapy', 'breath', 'free_tips']) {
    assert.ok(categories.has(category), `Chybí kategorie ${category}`);
  }
});

test('obsah má unikátní ID, free přístup a publikační stav', () => {
  assert.equal(new Set(content.map(item => item.id)).size, content.length);
  for (const item of content) {
    assert.equal(item.access, 'free');
    assert.ok(['planned', 'draft', 'published', 'archived'].includes(item.status));
    assert.ok(item.title.length > 5);
    assert.ok(item.description.length > 10);
  }
});

test('Elitea Library odděluje e-booky a audio od certifikačních kurzů', () => {
  const formats = new Set(content.map(item => item.format));
  assert.ok(formats.has('ebook'));
  assert.ok(formats.has('audio'));
  assert.ok(content.filter(item => item.format === 'ebook').length >= 2);
  assert.ok(content.filter(item => item.format === 'audio').length >= 4);
  assert.match(html, /ELITEA LIBRARY/);
  assert.match(html, /Library není další kurz/);
  assert.match(html, /e-booky, audio nahrávky, praktické průvodce/);
});

test('wellbeing obsah má bezpečnostní poznámku a neslibuje léčbu', () => {
  const wellbeing = content.filter(item => ['meditation', 'yoga', 'aromatherapy', 'breath'].includes(item.category));
  for (const item of wellbeing) {
    assert.ok(item.safety_note.length > 15, `${item.id} nemá bezpečnostní poznámku`);
    assert.doesNotMatch(`${item.title} ${item.description}`, /vyl[eé]č|garantuje|odstraní nemoc/i);
  }
});

test('knihovna je přístupná z aplikace a má hledání i filtry', () => {
  assert.match(html, /id="content-panel"/);
  assert.match(html, /id="category-filters"/);
  assert.match(html, /id="library-search"/);
  assert.match(html, /data-view="library"/);
});

test('členství obsahuje samostatnou profesionální komunitu', () => {
  assert.match(html, /id="community-panel"/);
  assert.match(html, /ELITEA COMMUNITY/);
  assert.match(html, /Aktuálně v komunitě/);
  assert.match(html, /Supervizní kruh s Niou/);
  assert.match(html, /data-view="community"/);
  assert.match(client, /communityPanel\.hidden/);
});

test('prostředí komunikuje personalizaci, bezpečí, členství a mobilní orientaci', () => {
  assert.match(html, /UŠITÁ TOBĚ/);
  assert.match(html, /Paměť máš pod kontrolou/);
  assert.match(html, /Tvá hlavní koučka · byznys mentorka · dlouhodobá podpora/);
  assert.match(html, /Elitea Mini/);
  assert.match(html, /class="mobile-nav"/);
  assert.match(css, /Cormorant Garamond/);
  assert.match(css, /\.mobile-nav \{ height: 62px/);
});

test('přímý odkaz do členské sekce se po načtení skutečně otevře', () => {
  assert.match(client, /#app-\(member\|chat\|community\|academy\|worksheets\|library\)/);
  assert.match(client, /if \(requestedMemberView\) requestMembershipEntry\(requestedMemberView\)/);
  assert.match(html, /id="auth-dialog"/);
  assert.match(html, /id="account-dialog"/);
});

test('první poznání probíhá v chatu a ne v povinném formuláři', () => {
  assert.match(html, /Napsat, co právě řeším/);
  assert.match(html, /Celou konzultaci povedu krok za krokem/);
  assert.doesNotMatch(html, /id="onboarding-dialog"/);
  assert.doesNotMatch(html, /id="onboarding-form"/);
});

test('aplikace nabízí pět oddělených konzultačních režimů a automatický výběr', () => {
  for (const mode of ['coaching_session', 'business_mentoring', 'nlp_reframing', 'behavioral_change', 'somatic_regulation', 'auto']) {
    assert.match(html, new RegExp(`data-consultation-mode="${mode}"`));
  }
  assert.match(html, /id="consultation-mode"/);
  assert.match(html, /id="end-session"/);
  assert.match(client, /consultationMode: state\.consultationMode/);
});

test('positioning vede výsledkem a AI transparentně přiznává před prvním sezením', () => {
  assert.match(html, /Profesionální AI Coach &amp; Mentor/);
  assert.match(html, /class="session-transparency"/);
  assert.match(html, /Elitea pracuje s rozsáhlou metodickou knihovnou/);
  assert.match(html, /vede celé sezení a navazuje na předchozí práci/);
  assert.doesNotMatch(html, /osobní AI koučka/i);
});

test('volba přístupu odlišuje neklinický koučink od psychoterapie', () => {
  assert.match(html, /Klasický koučink/);
  assert.match(html, /Byznys mentoring/);
  assert.match(html, /NLP a práce s jazykem/);
  assert.match(html, /KBT-inspirované koučovací techniky/);
  assert.match(html, /Somaticky orientované sezení/);
  assert.doesNotMatch(html, /KBT terapie|KBT konzultace/i);
});

test('volba tykání nebo vykání z chatu se uloží před další odpovědí', () => {
  assert.match(client, /inferAddressForm\(content/);
  assert.match(client, /identity_preferences\.address_form = chosenAddressForm/);
});

test('konverzace má vlastní scroll a historie zůstává v aktuální relaci', () => {
  assert.match(css, /\.workspace \{ min-height: 0; overflow: hidden;/);
  assert.match(css, /\.chat-panel \{ min-width: 0; min-height: 0; overflow: hidden;/);
  assert.match(css, /\.chat-scroll \{[\s\S]*overflow-y: auto;/);
  assert.match(css, /touch-action: pan-y/);
  assert.match(client, /state\.messages\.slice\(-200\)/);
});

test('koučovací místnost používá čistý redakční chat s rychlou volbou vedení', () => {
  assert.match(html, /class="chat-online-status"/);
  assert.match(html, /class="session-mode-chips"/);
  assert.match(html, /data-consultation-mode="coaching_session">Koučink/);
  assert.match(html, /data-consultation-mode="business_mentoring">Mentoring/);
  assert.match(css, /\.member-mode \.chat-panel \{[\s\S]*box-shadow: 22px 22px 0 var\(--elitea-purple\)/);
  assert.match(css, /\.member-mode \.message\.assistant \.bubble \{[\s\S]*background: #111114/);
  assert.match(css, /\.member-mode \.message\.user \.bubble \{[\s\S]*background: #eeebff/);
  assert.match(css, /TY · DNEŠNÍ KONTEXT/);
});

test('každý typ konzultace má oddělený přepis a vědomé navázání', () => {
  assert.match(html, /id="mode-resume-dialog"/);
  assert.match(html, /Kde jste skončily/);
  assert.match(html, /Kde můžeš navázat/);
  assert.match(html, /Začít čisté sezení/);
  assert.match(html, /Navázat tam, kde jsme skončily/);
  assert.match(client, /state\.conversations\[state\.consultationMode\] = messages/);
  assert.match(client, /const previousConversation = state\.conversations\[nextMode\]/);
  assert.match(client, /delete state\.conversations\[mode\]/);
  assert.match(client, /summarizeConversation\(mode, messages\)/);
  assert.match(client, /sessionStorage\.setItem\('elitea\.conversations'/);
});

test('předání Nii vyžaduje samostatný souhlas a nikdy nesdílí celý chat', () => {
  assert.match(html, /Nia nevidí tvoje zprávy ani historii chatu/);
  assert.match(html, /Ano, připravit návrh podkladu/);
  assert.match(html, /Ne, rezervovat bez podkladu/);
  assert.match(html, /Souhlasím s přiložením přesně tohoto textu/);
  assert.match(html, /Nia neuvidí můj chat/);
  assert.match(client, /buildHandoffDocument\(topic\)/);
  assert.doesNotMatch(client, /state\.messages[\s\S]{0,240}buildHandoffDocument/);
  assert.match(client, /handoffDocument\.addEventListener\('input'/);
  assert.match(client, /handoffConsent\.checked = false/);
  assert.match(html, /Bez tvého výslovného souhlasu se jí nic z této konverzace nezpřístupní/);
});

test('rezervační formulář odesílá jen explicitní údaje a volitelný schválený podklad', () => {
  assert.match(html, /id="booking-form"/);
  assert.match(html, /Odeslat žádost Nii/);
  assert.match(client, /Chat ani jeho přepis nikoli/);
  assert.match(client, /\/api\/booking-request/);
  assert.match(client, /documentApproved: state\.bookingWithDocument/);
  assert.doesNotMatch(client, /booking-request[\s\S]{0,800}messages:/);
});

test('členky mohou navrhovat další profesionální kurzy přímo z Academy', () => {
  assert.match(html, /Náš obsah\.<br><span>Vaše volba\.<\/span>/);
  assert.match(html, /id="course-request-form"/);
  assert.match(html, /Jaký kurz bys chtěla\?/);
  assert.match(html, /Nia si námět osobně přečte/);
  assert.match(html, /Vybere vhodného špičkového odborníka/);
  assert.match(client, /\/api\/course-request/);
  assert.doesNotMatch(client, /course-request[\s\S]{0,900}messages:/);
});

test('lekce umožňuje ukládat vlastní poznámky a předat je Elitea', () => {
  assert.match(html, /id="lesson-notes"/);
  assert.match(html, /Moje poznámky a odpovědi/);
  assert.match(client, /elitea\.courseNotes/);
  assert.match(client, /Navazuj na moje poznámky/);
});

test('čtyři odborné role jsou umístěné podle své skutečné práce a mají oddělené přepisy', () => {
  assert.match(html, /data-assistant-role="coach"/);
  assert.match(html, /data-assistant-role="brand"/);
  assert.doesNotMatch(html, /data-assistant-role="coach_training"/);
  assert.doesNotMatch(html, /data-assistant-role="brand_training"/);
  assert.match(html, /Dvě odborné větve/);
  assert.match(html, /Jedna komunita/);
  assert.match(html, /Elitea Coach &amp; Mentor/);
  assert.match(html, /AI lektorka a Coaching Lab/);
  assert.match(html, /Elitea Brand &amp; Marketing mentorka/);
  assert.match(html, /AI lektorka každého kurzu/);
  assert.match(html, /1:1 s Niou za zvýhodněnou cenu pro členy/);
  assert.match(html, /data-open-role="coach"/);
  assert.match(html, /data-open-role="brand"/);
  assert.doesNotMatch(html, /data-open-role="coach_training"/);
  assert.doesNotMatch(html, /data-open-role="brand_training"/);
  assert.match(html, /data-open-academy-branch="coach-mentor"/);
  assert.match(html, /data-open-academy-branch="brand-marketing"/);
  assert.match(html, /Elitea Community/);
  assert.match(html, /id="lesson-trainer-title"/);
  assert.match(client, /Probrat lekci s AI lektorkou/);
  assert.match(client, /Spustit praktický nácvik/);
  assert.doesNotMatch(html, /Druhá role Elitea/);
  assert.match(html, /id="finish-training"/);
  assert.match(client, /assistantRole: initialAssistantRole/);
  assert.match(client, /\/api\/training/);
  assert.match(client, /elitea\.trainingSessions/);
  assert.match(client, /TRAINING_ROLES = new Set\(\['coach_training', 'brand_training'\]\)/);
  assert.match(client, /elitea\.trainingPortfolio/);
  assert.match(client, /state\.conversations\[state\.consultationMode\]/);
});

test('Brand & Marketing je samostatná expertka s vlastní konverzací a poctivým schvalováním akcí', () => {
  assert.match(html, /data-assistant-role="brand"/);
  assert.match(html, /Brand &amp; Marketing/);
  assert.match(html, /BRAND &amp; MARKETING MENTORKA/);
  assert.match(html, /id="brand-agent-banner"/);
  assert.match(html, /data-brand-work-mode="collaborate"/);
  assert.match(html, /data-brand-work-mode="execute"/);
  assert.match(html, /Reklamu Elitea připraví jako pozastavený koncept/);
  assert.match(client, /state\.consultationMode = 'brand_growth'/);
  assert.match(client, /state\.conversations\.brand_growth/);
  assert.match(client, /brandWorkMode: state\.assistantRole === 'brand'/);
  assert.match(client, /Publikování, změnu rozpočtu, platbu nebo odeslání vždy provede až po tvém schválení/);
});

test('každá část kurzu ukazuje modul, pořadí a rozsah materiálů', () => {
  assert.match(html, /id="lesson-module-label"/);
  assert.match(html, /id="lesson-module-position"/);
  assert.match(client, /function moduleMaterialSummary/);
  assert.match(client, /v tomto modulu/);
  assert.match(client, /praktických částí/);
  assert.match(css, /\.outline-module-head small/);
});

test('Academy používá české tvary počtů modulů, částí a hodin', () => {
  assert.match(client, /function czechCountLabel/);
  assert.match(client, /'modul', 'moduly', 'modulů'/);
});

test('Academy třídí kurzy do dvou obchodně srozumitelných odborných větví', () => {
  assert.match(html, /id="academy-category-filters"/);
  assert.match(client, /Kouč & Mentor/);
  assert.match(client, /Brand & Marketing/);
  assert.match(client, /courseCategories: \['coaching-mental-health'\]/);
  assert.match(client, /courseCategories: \['marketing', 'business-strategy'\]/);
  assert.match(client, /data-academy-category/);
  assert.match(client, /data-academy-section/);
  assert.match(client, /Programy v této oblasti připravujeme/);
  assert.match(css, /\.academy-category-filters/);
  assert.match(css, /\.academy-category-section/);
});

test('veřejný web používá správný název Academy', () => {
  assert.match(html, /Elitea Academy/);
  assert.doesNotMatch(html, /Elitea academy/);
});

test('veřejný web konkrétně komunikuje ověřitelnou metodickou hloubku', () => {
  assert.match(html, /data-live-count="techniques"[\s\S]{0,80}technik a metod/);
  assert.match(html, /data-live-count="knowledge"[\s\S]{0,100}znalostních záznamů/);
  assert.match(html, /291[\s\S]{0,100}praktických pracovních částí/);
  assert.match(html, /142 cvičení na sobě, 148 profesních či modelových aplikací/);
  assert.match(html, /148[\s\S]{0,80}modulových testů/);
  assert.match(html, /896[\s\S]{0,80}studijních částí/);
  assert.match(html, /150[\s\S]{0,80}modulů/);
  assert.match(html, /devíti programům/);
  assert.match(html, /40 h[\s\S]{0,40}studia a praxe/);
  assert.match(html, /540[\s\S]{0,100}kurzových tréninkových situací/);
});

test('každý kurz zpřístupňuje Mastery Lab s celou praktickou cestou', () => {
  assert.match(html, /id="course-mastery"/);
  assert.match(html, /data-mastery-tab="journey"/);
  assert.match(html, /data-mastery-tab="scenarios"/);
  assert.match(html, /data-mastery-tab="assessment"/);
  assert.match(html, /data-mastery-tab="pack"/);
  assert.match(html, /data-mastery-tab="exam"/);
  assert.match(html, /value="expert"/);
  assert.match(client, /elitea\.courseMastery/);
  assert.match(client, /function startMasteryScenario/);
  assert.match(client, /scenarioId: session\.scenario/);
  assert.match(css, /\.course-mastery/);
  assert.match(css, /\.mastery-exam/);
});

test('členská sekce obsahuje samostatnou knihovnu interaktivních pracovních listů', () => {
  assert.match(html, /data-view="worksheets"/);
  assert.match(html, /id="worksheets-panel"/);
  assert.match(html, /data-live-count="worksheets"/);
  assert.match(client, /updateLiveCount\('worksheets'/);
  assert.match(html, /id="worksheet-filters"/);
  assert.match(html, /id="worksheet-search"/);
  assert.match(html, /id="worksheet-dialog"/);
  assert.match(html, /id="worksheet-dialog-purpose"/);
  assert.match(html, /id="worksheet-dialog-discovery"/);
  assert.match(html, /id="worksheet-dialog-takeaway"/);
  assert.match(html, /id="worksheet-dialog-usage"/);
  assert.match(client, /\/api\/worksheets/);
  assert.match(client, /elitea\.worksheetEntries/);
  assert.match(client, /data-open-worksheet/);
  assert.match(client, /K ČEMU JE/);
  assert.match(client, /CO MŮŽEŠ ZJISTIT/);
});
