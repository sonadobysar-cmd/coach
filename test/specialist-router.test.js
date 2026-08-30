import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_REGISTRY,
  formatSpecialistContext,
  routeSpecialists,
  sanitizeSpecialistSession,
  specialistRouteSummary,
} from '../src/specialist-router.js';

function route(text, options = {}) {
  return routeSpecialists({
    messages: [{ role: 'user', content: text }],
    consultationMode: 'auto',
    ...options,
  });
}

test('koordinátorka má přesně deset unikátních interních odborností', () => {
  assert.equal(SPECIALIST_REGISTRY.length, 10);
  assert.equal(new Set(SPECIALIST_REGISTRY.map(item => item.id)).size, 10);
  assert.ok(SPECIALIST_REGISTRY.every(item => item.label && item.purpose && item.visibleRole));
});

test('jasné téma aktivuje správnou odbornost místo obecného chatbota', () => {
  assert.equal(route('Potřebuji připravit reklamu a kampaň na Meta.').primaryId, 'brand_marketing');
  assert.equal(route('Potřebuji připravit reklamu a kampaň na Meta.', { responseMode: 'mentoring' }).primaryId, 'brand_marketing');
  assert.equal(route('Nevím, co postovat na Instagram a jak postavit Reels.').primaryId, 'content_social');
  assert.equal(route('Mám ADHD, přepínám mezi úkoly a ztrácím pozornost.').primaryId, 'adhd_habits');
  assert.equal(route('Jak funguje moje reakce na stres? Potřebuji tomu rozumět.').primaryId, 'psychoeducation');
  assert.equal(route('Jsem neschopná a vždycky selžu.').primaryId, 'cbt_guide');
});

test('neurčitá prokrastinace vede k jedné rozlišující otázce', () => {
  const result = route('Nedokážu dokončit úkoly a pořád je odkládám.');
  assert.equal(result.primaryId, 'productivity_coach');
  assert.equal(result.status, 'clarifying');
  assert.match(result.discriminatingQuestion, /nejasnost|rozptýlení|obava|vyčerpání/i);
});

test('explicitní režim má přednost a NLP zůstává metodou profesionální koučky', () => {
  const result = route('Chci s tím pracovat.', {
    consultationMode: 'nlp_reframing',
    responseMode: 'nlp_konzultace',
  });
  assert.equal(result.primaryId, 'professional_coach');
  assert.equal(result.activeMethod, 'nlp');
  assert.ok(result.confidence > 0.9);
});

test('krátká navazující odpověď nerozbije kontinuitu odbornosti', () => {
  const previous = route('Potřebuji vybudovat nabídku a ověřit, zda ji klientky koupí.');
  const next = routeSpecialists({
    messages: [
      { role: 'user', content: 'Potřebuji vybudovat nabídku a ověřit, zda ji klientky koupí.' },
      { role: 'assistant', content: 'Jaké máš zatím důkazy?' },
      { role: 'user', content: 'Zatím žádné.' },
    ],
    consultationMode: 'auto',
    previous,
  });
  assert.equal(next.primaryId, 'business_strategy');
  assert.equal(next.changed, false);
});

test('silný nový signál umožní plynulé předání odbornosti', () => {
  const previous = route('Chci si ujasnit, jakým směrem se vydat.');
  const next = routeSpecialists({
    messages: [
      { role: 'user', content: 'Chci si ujasnit, jakým směrem se vydat.' },
      { role: 'assistant', content: 'Co má volba chránit?' },
      { role: 'user', content: 'Teď potřebuji nastavit Meta reklamu, funnel a změřit konverze kampaně.' },
    ],
    consultationMode: 'auto',
    previous,
  });
  assert.equal(next.primaryId, 'brand_marketing');
  assert.equal(next.changed, true);
  assert.match(formatSpecialistContext(next), /Navaž plynule/i);
});

test('profil pouze jemně pomáhá při nerozhodném tématu a nepřebije aktuální zadání', () => {
  const memory = { coaching_profile: { focus_areas: ['adhd_friendly'], support_accommodations: 'malé kroky' } };
  assert.equal(route('Nevím, kde začít.', { memory }).primaryId, 'adhd_habits');
  assert.equal(route('Připrav mi obsahový plán pro Instagram.', { memory }).primaryId, 'content_social');
});

test('veřejné shrnutí neodhaluje interní historii ani evidenci', () => {
  const session = sanitizeSpecialistSession(route('Jak funguje moje reakce na stres?'));
  const summary = specialistRouteSummary(session);
  assert.equal(summary.primary.id, 'psychoeducation');
  assert.equal('history' in summary, false);
  assert.equal('evidence' in summary, false);
});

test('česká adversariální matice rozlišuje běžné i překryvné formulace', () => {
  const cases = [
    ['Newsletter pro klientky', 'content_social'],
    ['Proč při konfliktu zamrzám a co se ve mně děje?', 'psychoeducation'],
    ['Mám dát cenu 990 nebo 1490 Kč?', 'business_strategy'],
    ['Napiš positioning mé značky', 'brand_marketing'],
    ['Automatizovat onboarding přes Make.com a API', 'ai_automation'],
    ['Mám ADHD a nemůžu začít', 'adhd_habits'],
    ['Jsem vyčerpaná a potřebuji rovnováhu', 'wellbeing_spiritual'],
    ['Pořád nedokončuji úkoly', 'productivity_coach'],
    ['Jsem neschopná, protože jsem nedokončila úkol', 'cbt_guide'],
    ['Chci si ujasnit, zda odejít ze zaměstnání', 'professional_coach'],
    ['Kolik dát do Meta Ads?', 'brand_marketing'],
    ['Jak funguje stresová reakce?', 'psychoeducation'],
    ['Chci plán příspěvků na LinkedIn', 'content_social'],
    ['Nejde mi vytvořit API integraci', 'ai_automation'],
    ['Potřebuji zlepšit pracovní disciplínu', 'productivity_coach'],
    ['Meditace mi zhoršuje stav', 'wellbeing_spiritual'],
    ['Co určitě znamená tlak na hrudi?', 'wellbeing_spiritual'],
    ['Chci růst podnikání', 'business_strategy'],
    ['Chci probrat partnerský konflikt', 'professional_coach'],
    ['Vždycky všechno pokazím', 'cbt_guide'],
    ['Chci vytvořit prodejní funnel a reklamní kampaň', 'brand_marketing'],
    ['Chci pochopit, proč opakuji vztahový vzorec', 'psychoeducation'],
    ['Potřebuji naplánovat den a dodělat web', 'productivity_coach'],
    ['Potřebuji načerpat energii a odpočinout si', 'wellbeing_spiritual'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(route(input).primaryId, expected, input);
  }
});
