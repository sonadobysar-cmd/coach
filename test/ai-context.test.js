import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileSystemContext, selectSystemContext } from '../src/ai-context.js';
import { createElitea } from '../src/elitea.js';

const prompt = readFileSync(new URL('../config/system-prompt.md', import.meta.url), 'utf8');
const runtimeModes = [
  'koucovaci_hodina',
  'koucovaci_podpora',
  'nlp_konzultace',
  'behavioralni_konzultace',
  'somaticka_konzultace',
  'podpora_fungovani',
  'podporna_stabilizace',
  'vedena_meditace',
  'mentoring',
  'mentoringova_konzultace',
  'rychle_reseni',
  'diagnostika',
  'brand_growth_agent',
];

test('every runtime mode keeps shared identity, privacy, safety and quality invariants', () => {
  for (const mode of runtimeModes) {
    const result = compileSystemContext(prompt, mode);
    assert.match(result, /bezpečnost, pravdivost, soukromí a zákonné hranice/i, mode);
    assert.match(result, /Jsi \*\*Elitea\*\*/i, mode);
    assert.match(result, /jasně označena jako AI asistentka/i, mode);
    assert.match(result, /Nepředstíráš osobní zkušenost, emoce, licenci/i, mode);
    assert.match(result, /Nikdy netvrď, že si něco pamatuješ/i, mode);
    assert.match(result, /Nikdy nekombinuj, nezmiňuj ani neodvozuj údaje různých členek/i, mode);
    assert.match(result, /Nia nemá automatický přístup ke zprávám ani historii konverzace/i, mode);
    assert.match(result, /samostatném výslovném potvrzení/i, mode);
    assert.match(result, /### F\. Oslava/i, mode);
    assert.match(result, /nehledáš povinně drobnou chybu v každém výkonu/i, mode);
    assert.match(result, /### G\. Nesouhlas/i, mode);
    assert.match(result, /neopakuj tutéž námitku/i, mode);
    assert.match(result, /## 15\. Přesnost a práce se zdroji/i, mode);
    assert.match(result, /## 16\. Bezpečnostní hranice/i, mode);
    assert.match(result, /sebevražedné myšlenky nebo záměr/i, mode);
    assert.match(result, /## 17\. Etika, hranice a komunita/i, mode);
    assert.match(result, /## 18\. Kontrola kvality před odesláním/i, mode);
    assert.match(result, /nezačínej automaticky „Rozumím“/i, mode);
    assert.match(result, /Lidsky působící odpověď není hraní si na člověka/i, mode);
  }
});

test('coach projection keeps continuity, technique and refusal contracts but drops marketing operator', () => {
  const result = compileSystemContext(prompt, 'koucovaci_hodina');
  assert.match(result, /V automatickém režimu jsou Koučka a Byznys mentorka dvě spolupracující odborné role/i);
  assert.match(result, /bez nového chatu, opakování vstupu a vyžadování svolení/i);
  assert.match(result, /ELITEA Compass/i);
  assert.match(result, /Master Technique Atlas/i);
  assert.match(result, /Koučovací hodina:/i);
  assert.match(result, /### C\. Koučovací podpora/i);
  assert.match(result, /Nia nemá automatický přístup ke zprávám ani historii konverzace/i);
  assert.match(result, /samostatném výslovném potvrzení/i);
  assert.match(result, /## 11\. Koučink, sebedůvěra a pracovní kapacita/i);
  assert.doesNotMatch(result, /## Pravidla marketingové operátorky/i);
  assert.doesNotMatch(result, /Příklad mistrovské první reakce/i);
});

test('compact coach keeps the deep-work contracts from source sections 3, 4, 5, 7 and 13', () => {
  const result = compileSystemContext(prompt, 'koucovaci_hodina');
  assert.match(result, /### Produktový standard: hlavní průvodkyně, ne doplněk/i);
  assert.match(result, /sama veď souvislý pracovní cyklus od porozumění zakázce/i);
  assert.match(result, /Neodkazuj členku automaticky na člověka jen proto, že je téma těžké/i);
  assert.match(result, /## 4\. Odborný standard/i);
  assert.match(result, /načasováním otázky či intervence/i);
  assert.match(result, /NLP je potvrzenou součástí metodiky Nii/i);
  assert.match(result, /submodalitami, kotvením, mentální zkouškou/i);
  assert.match(result, /self-talk, identitu, postoje, vizualizaci a opakování/i);
  assert.match(result, /„Přeprogramování“ smíš použít jako koučovací metaforu/i);
  assert.match(result, /Psychologické znalosti používej k porozumění neklinickému chování/i);
  assert.match(result, /### Podporujeme, neopouštíme, neléčíme/i);
  assert.match(result, /doporučení odborníka neukončuje koučovací podporu/i);
  assert.match(result, /## 5\. Povinný interní postup před odpovědí/i);
  assert.match(result, /nejmenší realistický krok s nejvyšším dopadem/i);
  assert.match(result, /způsob ověření výsledku/i);
  assert.match(result, /## 7\. Výchozí forma živého rozhovoru/i);
  assert.match(result, /dvě až šest přirozených vět/i);
  assert.match(result, /právě jeden kvalitní posun/i);
  assert.match(result, /Při emocionální podpoře nevynucuj úkol/i);
  assert.match(result, /polož jednu otázku navazující na poslední odpověď a počkej/i);
  assert.match(result, /## 13\. Paměť a personalizace/i);
  assert.match(result, /domluvené kroky a jejich stav/i);
  assert.match(result, /při pochybnosti údaj bez výslovného souhlasu neukládej/i);
});

test('diagnostická koordinátorka zachová metodiku Nii i před volbou specialistky', () => {
  const result = compileSystemContext(prompt, 'diagnostika');
  assert.match(result, /NLP je potvrzenou součástí metodiky Nii/i);
  assert.match(result, /self-talk/iu);
  assert.match(result, /Přeprogramování/iu);
  assert.match(result, /neprováděj diagnózu, testování ani psychoterapii/iu);
});

test('all compact mode families retain decision, dialogue and memory invariants', () => {
  for (const mode of ['koucovaci_hodina', 'mentoringova_konzultace', 'diagnostika', 'brand_growth_agent']) {
    const result = compileSystemContext(prompt, mode);
    assert.match(result, /## 5\. Povinný interní postup před odpovědí/i, mode);
    assert.match(result, /co je fakt, sdělení členky, hypotéza nebo návrh/i, mode);
    assert.match(result, /## 7\. Výchozí forma živého rozhovoru/i, mode);
    assert.match(result, /Veď živý rozhovor, ne odpověďový formulář/i, mode);
    assert.match(result, /## 13\. Paměť a personalizace/i, mode);
    assert.match(result, /Členka musí moci paměť zobrazit, opravit a smazat/i, mode);
    assert.match(result, /## 14\. Úkoly a návaznost/i, mode);
    assert.match(result, /nejprve získej souhlas členky/i, mode);
    assert.match(result, /jasným výstupem, rozsahem a termínem/i, mode);
    assert.match(result, /úkol podle ní zmenši, uprav, odlož nebo nahraď/i, mode);
  }
});

test('specialized embodied modes retain the relevant safeguards without burdening ordinary coaching', () => {
  const ordinary = compileSystemContext(prompt, 'koucovaci_hodina');
  const somatic = compileSystemContext(prompt, 'somaticka_konzultace');
  const meditation = compileSystemContext(prompt, 'vedena_meditace');
  assert.doesNotMatch(ordinary, /Akupresurní body, deep-tissue masáž/i);
  assert.match(somatic, /Somatická konzultace:/i);
  assert.match(somatic, /Akupresurní body, deep-tissue masáž/i);
  assert.match(somatic, /souhlas a možnost zastavit/i);
  assert.match(meditation, /### J\. Vedená meditace/i);
  assert.match(meditation, /neřídí ani nedělá činnost vyžadující pozornost/i);
});

test('business and brand projections retain their decision standards and exclude unrelated manuals', () => {
  const mentoring = compileSystemContext(prompt, 'mentoringova_konzultace');
  const brand = compileSystemContext(prompt, 'brand_growth_agent');
  assert.match(mentoring, /### B\. Přímý mentoring/i);
  assert.match(mentoring, /## 8\. Byznysová rozhodovací logika/i);
  assert.match(mentoring, /## 10\. Cena, finance, prodej a péče/i);
  assert.match(mentoring, /Interní důkazní protokol/i);
  assert.doesNotMatch(mentoring, /## Pravidla marketingové operátorky/i);
  assert.doesNotMatch(mentoring, /## 11\. Koučink, sebedůvěra a pracovní kapacita/i);

  assert.match(brand, /Pracovní standard Brand & Marketing mentorky/i);
  assert.match(brand, /tři jasně oddělené odborné prostory/i);
  assert.match(brand, /Externí akci nikdy nevydávej za provedenou bez skutečně připojeného nástroje/i);
  assert.match(brand, /## 9\. Nabídka, značka, marketing a kreativní vedení/i);
  assert.match(brand, /## Pravidla marketingové operátorky/i);
  assert.match(brand, /novou placenou kampaň vždy nejprve založ ve stavu PAUSED/i);
  assert.doesNotMatch(brand, /Master Technique Atlas/i);
  assert.doesNotMatch(brand, /V automatickém režimu jsou Koučka a Byznys mentorka/i);
  assert.doesNotMatch(brand, /## 11\. Koučink, sebedůvěra a pracovní kapacita/i);
});

test('diagnostic projection keeps both business reasoning and deep coaching standards', () => {
  const result = compileSystemContext(prompt, 'diagnostika');
  assert.match(result, /### A\. Diagnostika/i);
  assert.match(result, /## 8\. Byznysová rozhodovací logika/i);
  assert.match(result, /## 10\. Cena, finance, prodej a péče/i);
  assert.match(result, /## 11\. Koučink, sebedůvěra a pracovní kapacita/i);
  assert.match(result, /Master Technique Atlas/i);
});

test('mode compiler cuts the static paid context by more than half for core coach and mentor turns', () => {
  for (const mode of ['koucovaci_hodina', 'mentoringova_konzultace']) {
    const result = compileSystemContext(prompt, mode);
    assert.ok(result.length <= prompt.length * 0.5, `${mode}: ${result.length}/${prompt.length}`);
  }
});

test('explicit compact-context rollback returns the original source document', () => {
  const previous = process.env.ELITEA_CONTEXT_COMPACT;
  try {
    process.env.ELITEA_CONTEXT_COMPACT = '0';
    assert.equal(selectSystemContext(prompt, 'koucovaci_hodina'), prompt);
  } finally {
    if (previous === undefined) delete process.env.ELITEA_CONTEXT_COMPACT;
    else process.env.ELITEA_CONTEXT_COMPACT = previous;
  }
});

async function captureRuntimeInstructions(compact) {
  const previousCompact = process.env.ELITEA_CONTEXT_COMPACT;
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  let instructions = '';
  try {
    process.env.ELITEA_CONTEXT_COMPACT = compact ? '1' : '0';
    process.env.AI_GATEWAY_API_KEY = 'prompt-size-test-only';
    const answer = createElitea({
      systemPrompt: prompt,
      knowledgeRecords: [],
      generate: async options => {
        if (!instructions) instructions = options.instructions;
        return {
          text: 'Jeden odchod zatím nevysvětluje celý workshop. Co udělaly dvě zbývající účastnice?',
          usage: {},
        };
      },
    });
    await answer({
      messages: [{ role: 'user', content: 'První workshop dopadl špatně. Asi na podnikání nemám.' }],
      consultationMode: 'coaching_session',
      memory: {
        identity_preferences: { address_form: 'tykani' },
        business_context: {
          stage: 'ověřování',
          industry: 'koučink',
          primary_offer: 'workshop',
          target_customer: 'začínající podnikatelky',
        },
        coaching_profile: {
          onboarding_complete: true,
          desired_outcome: 'vyhodnotit workshop',
          support_style: 'kombinace',
          spiritual_preference: 'none',
          focus_areas: ['sebedůvěra'],
        },
        progress: { active_day_count: 2, completed_milestones: [] },
        role_memories: { coach: { continuity: { last_focus: 'workshop' } } },
      },
    });
    return instructions;
  } finally {
    if (previousCompact === undefined) delete process.env.ELITEA_CONTEXT_COMPACT;
    else process.env.ELITEA_CONTEXT_COMPACT = previousCompact;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
  }
}

test('full production instruction payload is at least 30 percent smaller', async () => {
  const full = await captureRuntimeInstructions(false);
  const compact = await captureRuntimeInstructions(true);
  assert.ok(full.length > 0);
  assert.ok(compact.length <= full.length * 0.7, `${compact.length}/${full.length}`);
  assert.match(compact, /POVINNÝ PROTOKOL PRECIZNÍHO PROVEDENÍ TECHNIKY/i);
  assert.match(compact, /AKTUÁLNÍ PAMĚŤ ČLENKY/i);
  assert.match(compact, /INTERNÍ KOORDINACE ODBORNOSTÍ/i);
  assert.match(compact, /PROFESIONÁLNÍ KOUČOVACÍ ÚSUDEK/i);
});
