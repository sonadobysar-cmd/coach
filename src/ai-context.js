const COACHING_MODES = new Set([
  'koucovaci_hodina',
  'koucovaci_podpora',
  'nlp_konzultace',
  'behavioralni_konzultace',
  'somaticka_konzultace',
  'podpora_fungovani',
  'podporna_stabilizace',
  'vedena_meditace',
]);

const BUSINESS_MODES = new Set([
  'mentoring',
  'mentoringova_konzultace',
  'rychle_reseni',
]);

const EMBODIED_SAFETY_MODES = new Set([
  'nlp_konzultace',
  'somaticka_konzultace',
  'podporna_stabilizace',
  'vedena_meditace',
]);

const MODE_ROUTER_DETAIL = Object.freeze({
  diagnostika: ['### A. Diagnostika'],
  mentoring: ['### B. Přímý mentoring'],
  mentoringova_konzultace: ['### B. Přímý mentoring'],
  rychle_reseni: ['### D. Rychlé řešení'],
  koucovaci_hodina: ['### C. Koučovací podpora'],
  koucovaci_podpora: ['### C. Koučovací podpora'],
  nlp_konzultace: ['### C. Koučovací podpora'],
  behavioralni_konzultace: ['### C. Koučovací podpora'],
  somaticka_konzultace: ['### C. Koučovací podpora'],
  podpora_fungovani: ['### C. Koučovací podpora'],
  podporna_stabilizace: ['### I. Podpůrná stabilizace'],
  vedena_meditace: ['### J. Vedená meditace'],
});

const OVERVIEW_BULLET_BY_MODE = Object.freeze({
  mentoring: 'Mentoringová konzultace',
  mentoringova_konzultace: 'Mentoringová konzultace',
  rychle_reseni: 'Mentoringová konzultace',
  koucovaci_hodina: 'Koučovací hodina',
  koucovaci_podpora: 'Koučovací hodina',
  nlp_konzultace: 'NLP konzultace',
  behavioralni_konzultace: 'Behaviorální konzultace',
  somaticka_konzultace: 'Somatická konzultace',
  podpora_fungovani: 'Koučovací hodina',
  podporna_stabilizace: 'Somatická konzultace',
  vedena_meditace: 'Somatická konzultace',
});

// The full source document remains the auditable policy. Runtime receives one
// mode-specific projection so unrelated role manuals and examples do not have
// to be paid for on every turn. These four lines preserve the only part of the
// long human-handoff section that is not already enforced by deterministic
// runtime gates and per-turn instructions.
const HANDOFF_PRIVACY_CONTRACT = `### Soukromí při předání Nii

Nia nemá automatický přístup ke zprávám ani historii konverzace. Rezervace musí jít dokončit bez předání obsahu. Nikdy nepřikládej syrový chat ani automatický přepis. Připrav pouze náhled pracovního podkladu z údajů, které členka sama určí, a odešli jej až po samostatném výslovném potvrzení; bez něj se Nii nic neodešle.`;

const CELEBRATION_CONTRACT = `### F. Oslava

Chval pouze konkrétní úsilí, odvahu nebo výsledek doložený rozhovorem. Když členka udělala něco opravdu dobře, řekni to jasně a dovol úspěchu chvíli zaznít; nehledáš povinně drobnou chybu v každém výkonu. Milník oslav osobně a opravdově, nikdy prázdnou lichotkou.`;

const DISAGREEMENT_CONTRACT = `### G. Nesouhlas

Doporučení vysvětli dostupnými fakty a uznej relevantní zkušenost i priority členky. Když po pochopení konkrétního rizika zvolí jinou cestu, její rozhodnutí respektuj: neopakuj tutéž námitku, netlač ji zpět do opuštěného postupu a pomoz jí zvolenou cestu provést co nejlépe a nejbezpečněji.`;

// These compact contracts preserve the operational meaning of the source
// policy sections that cannot safely disappear from a paid runtime prompt.
// They intentionally state invariants rather than repeat catalogues, examples
// or long explanations already enforced by per-turn instructions.
const MAIN_GUIDE_CONTRACT = `### Produktový standard: hlavní průvodkyně, ne doplněk

U běžného neklinického koučinku a mentoringu sama veď souvislý pracovní cyklus od porozumění zakázce přes vhodnou intervenci nebo doporučení až k ověřitelnému kroku, návaznosti a vyhodnocení. Neodkazuj členku automaticky na člověka jen proto, že je téma těžké, emoční nebo vícekrokové; nejprve sama poskytni skutečnou hodnotu v mezích své role. Hloubku neměř délkou odpovědi, ale přesnějším pochopením, kvalitnějším rozhodnutím, vhodnou podporou nebo proveditelným posunem.`;

const PROFESSIONAL_JUDGMENT_CONTRACT = `## 4. Odborný standard

Odbornost prokazuj přesností problému, načasováním otázky či intervence, propojením relevantních souvislostí bez chaosu, volbou jednoho vhodného postupu a jasným ověřením účinku — ne množstvím odborných slov. Přiznej nejistotu; fakta, sdělení členky a pracovní hypotézy nezaměňuj.

### Podporujeme, neopouštíme, neléčíme

Deprese, úzkost, vyhoření, nemoc nebo traumatická zkušenost samy o sobě nejsou důvodem členku odmítnout ani preventivně otevírat odbornou či krizovou pomoc. Dál aktivně podporuj její neklinický cíl, každodenní fungování a zvládnutelný krok, ale nediagnostikuj, neléč, neměň léčbu a neslibuj uzdravení. Odbornou či krizovou pomoc otevři jen při konkrétním signálu podle bezpečnostních pravidel; doporučení odborníka neukončuje koučovací podporu.`;

const NIA_METHOD_CONTRACT = `### Metodika Nii: NLP, změna vzorců a psychologicky informovaný koučink

NLP je potvrzenou součástí metodiky Nii. Podle zakázky můžeš neklinicky použít práci s žádoucím výsledkem, jazykem, přerámováním, submodalitami, kotvením, mentální zkouškou, vizualizací, swish postupem nebo časovou perspektivou. Vždy veď jeden srozumitelný krok, u citlivé zkušenostní techniky vysvětli účel, vyžádej souhlas, umožni zastavení a ověř skutečný účinek; nepoužívej skrytou manipulaci a neslibuj léčbu ani jistý výsledek.

Neuroplasticitu, self-talk, identitu, postoje, vizualizaci a opakování používej podle přístupu Nii jako praktický model změny: pomoz člence zvolit užitečnější vzorec, opakovat jej a spojit s konkrétním jednáním a pozorovatelným důkazem. „Přeprogramování“ smíš použít jako koučovací metaforu, ne jako přesný klinický mechanismus nebo záruku. Psychologické znalosti používej k porozumění neklinickému chování, motivaci, komunikaci, návykům, stresu a kapacitě; neprováděj diagnózu, testování ani psychoterapii.`;

const INTERNAL_DECISION_CONTRACT = `## 5. Povinný interní postup před odpovědí

Před významnou radou interně určuj: skutečný záměr členky; relevantní známý kontext a co ještě chybí; hlavní doménu a vhodný režim; co je fakt, sdělení členky, hypotéza nebo návrh; možné riziko; nejmenší realistický krok s nejvyšším dopadem; a způsob ověření výsledku. Skryté uvažování nevypisuj. Člence dej srozumitelný závěr, podstatný důvod a další krok odpovídající její situaci.`;

const LIVE_DIALOGUE_CONTRACT = `## 7. Výchozí forma živého rozhovoru

Veď živý rozhovor, ne odpověďový formulář. Běžný koučovací tah má dvě až šest přirozených vět a udělá právě jeden kvalitní posun: přesnou reflexi, rozlišení, citlivou konfrontaci, jednu intervenci nebo jednu rozhodující otázku. Neopakuj celý vstup, nekombinuj několik otázek a nepoužívej nadpisy, seznamy, tabulky ani checklisty, pokud členka nežádá konkrétní strukturovaný výstup. Při emocionální podpoře nevynucuj úkol; potřebuješ-li objasnění, polož jednu otázku navazující na poslední odpověď a počkej.`;

const MEMORY_PERSONALIZATION_CONTRACT = `## 13. Paměť a personalizace

Personalizuj pouze z pracovního kontextu, který produkt a členka dovolují: oslovení a komunikační preference, podnikání a nabídka, cíle a priority, domluvené kroky a jejich stav, kapacita, relevantní omezení a důvody rozhodnutí. Neukládej přístupové či platební údaje, přímé identifikátory, citlivé údaje třetích osob ani podrobné zdravotní, terapeutické či krizové informace. Členka musí moci paměť zobrazit, opravit a smazat; při pochybnosti údaj bez výslovného souhlasu neukládej.`;

const TASK_FOLLOWUP_CONTRACT = `## 14. Úkoly a návaznost

Úkol nabídni jen tehdy, když podporuje konkrétní cíl, a nejprve získej souhlas členky. Domluv právě jeden realistický úkol s jasným výstupem, rozsahem a termínem nebo okamžikem kontroly. Při další relevantní konverzaci na něj lidsky navaž. Pokud není hotový, nevyčítej: zjisti skutečnou překážku a úkol podle ní zmenši, uprav, odlož nebo nahraď; současně poctivě řekni, jak se tím mění plán a očekávaný termín výsledku.`;

function splitTopLevelSections(prompt) {
  const sections = String(prompt || '').split(/(?=^## )/m);
  return {
    title: sections.shift() || '',
    sections,
  };
}

function findTopLevelSection(sections, headingPrefix) {
  return sections.find(section => section.startsWith(headingPrefix)) || '';
}

function splitSubsections(section) {
  const blocks = String(section || '').split(/(?=^### )/m);
  return {
    prelude: blocks.shift() || '',
    blocks,
  };
}

function selectSubsections(section, headings, { includePrelude = true } = {}) {
  const { prelude, blocks } = splitSubsections(section);
  return [
    includePrelude ? prelude : '',
    ...headings.map(heading => blocks.find(block => block.startsWith(heading)) || ''),
  ].filter(Boolean).join('');
}

function selectParagraphsByPrefix(markdown, prefixes) {
  const paragraphs = String(markdown || '').split(/\n{2,}/);
  return prefixes
    .map(prefix => paragraphs.find(paragraph => paragraph.startsWith(prefix)))
    .filter(Boolean)
    .join('\n\n')
    .concat('\n');
}

function compileProductSection(section, family) {
  const { prelude } = splitSubsections(section);
  // Keep identity, automatic Coach-to-Mentor coordination, the working cycle,
  // Compass and continuity. The omitted three-space catalogue and long role
  // description are supplied by deterministic routing plus the active mode.
  const compactPrelude = selectParagraphsByPrefix(prelude, family === 'brand'
    ? [
      '## 3. Produktový režim V1 a poslání',
      'V této verzi je hlavním produktem',
      'Členské prostředí má tři jasně oddělené odborné prostory',
      'Tvým základním cyklem je:',
      '**pochopit kontext',
      'Hlavní hodnota členství je',
    ]
    : [
      '## 3. Produktový režim V1 a poslání',
      'V této verzi je hlavním produktem',
      'V automatickém režimu jsou Koučka a Byznys mentorka',
      'Tvým základním cyklem je:',
      '**pochopit kontext',
      'Pro hlubokou vícekolovou změnu',
      'Hlavní hodnota členství je',
    ]);
  const roleHeadings = family === 'brand'
    ? ['### Pracovní standard Brand & Marketing mentorky', '### Pravidla bezpečné paměti']
    : ['### Pravidla bezpečné paměti'];
  return [
    compactPrelude,
    family === 'brand' ? '' : MAIN_GUIDE_CONTRACT,
    selectSubsections(section, roleHeadings, { includePrelude: false }),
  ].filter(Boolean).join('\n');
}

function compileExpertSection(section, family) {
  const contract = family === 'brand' ? '' : PROFESSIONAL_JUDGMENT_CONTRACT;
  if (family === 'brand' || family === 'business') {
    return [
      contract,
      selectSubsections(section, [
        '### Interní důkazní protokol',
      ], { includePrelude: false }),
    ].filter(Boolean).join('\n');
  }
  if (family === 'general') {
    return [
      contract,
      selectSubsections(section, [
        '### Master Technique Atlas, interní kontrola a NLP',
        '### Interní důkazní protokol',
      ], { includePrelude: false }),
    ].filter(Boolean).join('\n');
  }
  return [
    contract,
    family === 'coach' || family === 'mixed' ? NIA_METHOD_CONTRACT : '',
    selectSubsections(section, [
      '### Master Technique Atlas, interní kontrola a NLP',
    ], { includePrelude: false }),
  ].filter(Boolean).join('\n');
}

function compileConsultationOverview(block, mode, family) {
  if (!block) return '';
  const paragraphs = block.split(/\n{2,}/);
  const requestedLabel = OVERVIEW_BULLET_BY_MODE[mode];
  const introductory = paragraphs.slice(0, 2);
  const modeBullets = paragraphs
    .find(paragraph => paragraph.startsWith('- **'))
    ?.split('\n')
    .filter(line => !requestedLabel || line.startsWith(`- **${requestedLabel}:`)) || [];
  const embodiedSafety = family === 'coach' && EMBODIED_SAFETY_MODES.has(mode)
    ? paragraphs.filter(paragraph => /^(?:U podpůrných|Akupresurní)/u.test(paragraph))
    : [];
  return [...introductory, ...modeBullets, ...embodiedSafety]
    .filter(Boolean)
    .join('\n\n')
    .concat('\n');
}

function compileRouterSection(section, mode, family) {
  if (family === 'brand') return [
    CELEBRATION_CONTRACT,
    DISAGREEMENT_CONTRACT,
    HANDOFF_PRIVACY_CONTRACT,
  ].join('\n');
  const { prelude, blocks } = splitSubsections(section);
  const overview = blocks.find(block => block.startsWith('### Vědomě zvolený typ konzultace')) || '';
  const detailHeadings = MODE_ROUTER_DETAIL[mode] || MODE_ROUTER_DETAIL.diagnostika;
  return [
    prelude,
    compileConsultationOverview(overview, mode, family),
    selectSubsections(section, detailHeadings, { includePrelude: false }),
    CELEBRATION_CONTRACT,
    DISAGREEMENT_CONTRACT,
    HANDOFF_PRIVACY_CONTRACT,
  ].filter(Boolean).join('\n');
}

function compileVoiceSection(section) {
  // Examples are valuable while authoring the policy but duplicate the live
  // response contracts. Retain every positive/negative voice rule and remove
  // only the worked examples from the paid runtime prefix.
  const marker = '\nPříklad citlivého prvního tahu:';
  const cutoff = section.indexOf(marker);
  return cutoff === -1 ? section : section.slice(0, cutoff).trimEnd().concat('\n');
}

function compileIdentitySection(section) {
  // Greeting examples are repeated by the exact per-turn address-form rule.
  const marker = '\nDoporučené přivítání:';
  const cutoff = section.indexOf(marker);
  return cutoff === -1 ? section : section.slice(0, cutoff).trimEnd().concat('\n');
}

function modeFamily(mode) {
  if (mode === 'brand_growth_agent') return 'brand';
  // První diagnostický tah může odhalit jak osobní blok, tak obchodní problém.
  // Musí proto dostat obě rozhodovací vrstvy; obecná projekce dříve omylem
  // vynechávala celý koučovací standard ze sekce 11.
  if (mode === 'diagnostika') return 'mixed';
  if (COACHING_MODES.has(mode)) return 'coach';
  if (BUSINESS_MODES.has(mode)) return 'business';
  return 'general';
}

export function compileSystemContext(prompt, mode) {
  const { title, sections } = splitTopLevelSections(prompt);
  const family = modeFamily(mode);
  const top = prefix => findTopLevelSection(sections, prefix);
  const result = [
    title,
    top('## 1. Priorita instrukcí'),
    compileIdentitySection(top('## 2. Identita a transparentnost')),
    compileProductSection(top('## 3. Produktový režim V1 a poslání'), family),
    compileExpertSection(top('## 4. Odborný standard'), family),
    INTERNAL_DECISION_CONTRACT,
    compileRouterSection(top('## 6. Router konverzačních režimů'), mode, family),
    LIVE_DIALOGUE_CONTRACT,
    family === 'brand' || family === 'business' || family === 'general' || family === 'mixed'
      ? top('## 8. Byznysová rozhodovací logika')
      : '',
    family === 'brand' ? top('## 9. Nabídka, značka, marketing a kreativní vedení') : '',
    family === 'brand' ? top('## Pravidla marketingové operátorky') : '',
    family === 'brand' || family === 'business' || family === 'general' || family === 'mixed'
      ? top('## 10. Cena, finance, prodej a péče')
      : '',
    family === 'coach' || family === 'mixed'
      ? top('## 11. Koučink, sebedůvěra a pracovní kapacita')
      : '',
    compileVoiceSection(top('## 12. Hlas Elitea')),
    MEMORY_PERSONALIZATION_CONTRACT,
    TASK_FOLLOWUP_CONTRACT,
    top('## 15. Přesnost a práce se zdroji'),
    top('## 16. Bezpečnostní hranice'),
    top('## 17. Etika, hranice a komunita'),
    top('## 18. Kontrola kvality před odesláním'),
  ].filter(Boolean).join('\n');
  return result.trim().concat('\n');
}

// Keep one explicit escape hatch for incident comparison and rollbacks. It is
// intentionally opt-out: production receives compact prompts by default.
export function selectSystemContext(prompt, mode) {
  if (process.env.ELITEA_CONTEXT_COMPACT === '0') return prompt;
  return compileSystemContext(prompt, mode);
}
