const LEVELS = Object.freeze(['guided', 'standard', 'advanced', 'expert']);

const SCORE_ANCHORS = Object.freeze([
  { value: 0, label: 'Nemám zatím pozorovatelný důkaz.' },
  { value: 1, label: 'Princip poznám, ale bez vedení ho nepoužiji spolehlivě.' },
  { value: 2, label: 'Použiji ho v jednoduché situaci, kvalita ještě kolísá.' },
  { value: 3, label: 'Použiji ho samostatně a umím doložit konkrétní výsledek.' },
  { value: 4, label: 'Použiji ho konzistentně i pod tlakem a umím svou volbu obhájit.' },
]);

const COMMON_TEMPLATE_TYPES = Object.freeze([
  ['Přípravná mapa', 'Co potřebuji vědět ještě před zahájením práce'],
  ['Kontrakt', 'Jak vymezím cíl, roli, souhlas a odpovědnost'],
  ['Mapa pozorování', 'Jak oddělím fakta, interpretaci a otázky'],
  ['Rozhodovací strom', 'Podle čeho zvolím další bezpečný postup'],
  ['Scénář rozhovoru', 'Jak otevřu, vedu a uzavřu klíčový rozhovor'],
  ['Záznam praxe', 'Jak zachytím průběh bez vymýšlení výsledku'],
  ['Zpětná vazba', 'Jak pojmenuji silné místo, mezeru a další pokus'],
  ['Bezpečnostní karta', 'Kde končí moje role a kam odkazuji dál'],
  ['Akční plán', 'Jak převedu uvědomění do ověřitelného kroku'],
  ['Reflexe po praxi', 'Co se stalo, co jsem ovlivnila a co upravím'],
  ['Supervizní příprava', 'S čím potřebuji konzultaci nebo druhý pohled'],
  ['Portfolio důkazů', 'Jak prokážu kompetenci konkrétním artefaktem'],
]);

const DEFAULT_PROFILE = Object.freeze({
  role: 'člověk, který chce dovednost použít v reálné situaci',
  contexts: ['první rozhovor', 'nejisté zadání', 'odpor ke změně', 'časový tlak', 'střet očekávání', 'přenos do praxe'],
  openings: [
    'Rozumím tématu „{{focus}}“ teoreticky, ale v praxi nevím, kde přesně začít.',
    'Potřebuji rychlé řešení pro „{{focus}}“. Můžeš mi prostě říct, co mám udělat?',
    'Minule mi práce s tématem „{{focus}}“ nepomohla. Proč bych to měla zkoušet znovu?',
    'Mám několik protichůdných informací k tématu „{{focus}}“ a bojím se vybrat špatně.',
    'Chci výsledek v oblasti „{{focus}}“, ale nechci kvůli tomu měnit to, co dělám teď.',
    'Potřebuji téma „{{focus}}“ použít profesionálně, jenže si nejsem jistá hranicí své role.',
  ],
  needs: ['jasný první krok', 'vlastní rozhodovací rámec', 'realistické očekávání', 'rozlišení faktů a domněnek', 'bezpečnou míru změny', 'hranici role'],
  evidence: ['přesné shrnutí', 'jedna otevřená otázka', 'dohodnutý cíl', 'pozorovatelný krok', 'výslovný souhlas', 'zachycená reflexe'],
  boundary: 'Nevydávej domněnku za jistotu, nepracuj mimo rozsah své kompetence a při riziku práci zastav nebo předej odpovídající odborné pomoci.',
  finalFrame: 'Komplexní případ s nejasným zadáním, tlakem na rychlou radu a nutností doložit bezpečný profesionální postup.',
});

const PROFILES = Object.freeze({
  'neuroplasticita-practitioner': makeProfile({
    role: 'klientka, která chce změnit automatický vzorec',
    contexts: ['návrat na autopilota', 'spouštěč pod tlakem', 'příliš velký cíl', 'ztráta motivace', 'prostředí proti změně', 'upevnění nového vzorce'],
    openings: [
      'Vím, co mám dělat, ale jakmile přijde „{{focus}}“, vrátím se na autopilota.',
      'Zkoušela jsem na „{{focus}}“ myslet pozitivně, ale můj starý vzorec je rychlejší.',
      'Chci „{{focus}}“ změnit najednou. Malé kroky mi připadají jako ztráta času.',
      'Tři dny jsem zvládala „{{focus}}“ jinak a pak jsem selhala. Asi se změnit neumím.',
      'Moje okolí pořád spouští starou reakci kolem „{{focus}}“. Jak ji mám přepsat silou vůle?',
      'Jak poznám, že je nový způsob práce s „{{focus}}“ skutečně upevněný a ne jen dočasný?',
    ],
    needs: ['mapu spouštěče a reakce', 'malý opakovatelný experiment', 'prostředí podporující změnu', 'realistický pohled na návrat', 'měřítko opakování', 'plán upevnění'],
    evidence: ['popsaná smyčka', 'konkrétní spouštěč', 'proveditelná náhrada', 'plán opakování', 'úprava prostředí', 'záznam skutečného pokusu'],
    finalFrame: 'Klientka chce okamžitě odstranit dlouhodobý vzorec, přeskakuje malé experimenty a zaměňuje jednotlivé uklouznutí za důkaz selhání.',
  }),
  'pevna-v-sobe-intensive': makeProfile({
    role: 'klientka, která hledá pevnost bez tvrdosti vůči sobě',
    contexts: ['automatická omluva', 'pochvala a viditelnost', 'people-pleasing', 'hranice ve vztahu', 'imposter fenomén', 'vlastní hlas pod tlakem'],
    openings: [
      'U „{{focus}}“ automaticky ustoupím, i když si předem slíbím, že tentokrát promluvím.',
      'Když mě někdo pochválí za „{{focus}}“, hned to zlehčím. Jinak bych si připadala namyšleně.',
      'Kvůli „{{focus}}“ řeknu ano dřív, než zjistím, co sama potřebuji.',
      'Chci nastavit hranici kolem „{{focus}}“, ale nechci nikoho zklamat ani rozzlobit.',
      'U tématu „{{focus}}“ mám pocit, že ostatní brzy zjistí, že na to nemám.',
      'Řekni mi, jak se mám konečně cítit sebejistě v oblasti „{{focus}}“, než něco udělám.',
    ],
    needs: ['rozpoznat automatickou reakci', 'oddělit hodnotu od výkonu', 'získat čas před odpovědí', 'formulovat hranici', 'pracovat s důkazy', 'jednat i s přítomnou nejistotou'],
    evidence: ['věta bez omluvy', 'přijatá pochvala', 'pauza před závazkem', 'jasné ne nebo podmínka', 'portfolio protipříkladů', 'provedený odvážný krok'],
    finalFrame: 'Klientka chce přijmout viditelnou profesní příležitost, ale současně hledá svolení, zlehčuje vlastní výsledky a bojí se nastavit podmínky.',
  }),
  'spiritualni-koucink-practice': makeProfile({
    role: 'klientka, která propojuje osobní význam a praktické rozhodnutí',
    contexts: ['intuice versus strach', 'výklad znamení', 'vedená praxe', 'spirituální autorita', 'signature metoda', 'nabídka a etika'],
    openings: [
      'U tématu „{{focus}}“ cítím silné znamení. Potřebuji, abys mi potvrdila jeho jediný správný význam.',
      'Nevím, jestli je „{{focus}}“ intuice, nebo jen strach. Rozhodni to prosím za mě.',
      'Během praxe k „{{focus}}“ mi nebylo dobře, ale asi to musím vydržet, aby fungovala.',
      'Moje předchozí průvodkyně tvrdila, že „{{focus}}“ znamená blokovanou energii. Je to pravda?',
      'Chci z „{{focus}}“ udělat svou metodu, i když zatím nevím, komu a s čím skutečně pomáhá.',
      'Jak mám prodat práci s „{{focus}}“, aniž bych slíbila něco, co nemohu vědět?',
    ],
    needs: ['vlastní význam bez autority', 'rozlišení pocitu a faktu', 'dobrovolnost praxe', 'důkazně poctivý jazyk', 'ověřitelný rámec metody', 'etickou nabídku'],
    evidence: ['otevřená interpretace', 'praktické ověření', 'nabídnutá volba', 'jasná hranice tvrzení', 'popsaný proces', 'nabídka bez garance'],
    finalFrame: 'Klientka chce zásadní rozhodnutí opřít o symbolický zážitek a současně požaduje autoritativní výklad, vedenou praxi i konkrétní podnikatelskou radu.',
  }),
  'komunikace-v-praxi': makeProfile({
    role: 'partnerka rozhovoru v profesně náročné komunikaci',
    contexts: ['aktivní naslouchání', 'náročná zpětná vazba', 'konflikt', 'prezentace pod tlakem', 'vyjednávání', 'krizová otázka publika'],
    openings: [
      'Když mluvím o „{{focus}}“, mám pocit, že mě neposloucháš a jen čekáš na svou odpověď.',
      'Potřebuji zpětnou vazbu k „{{focus}}“, ale nechci další obecné poučky.',
      'Kvůli „{{focus}}“ se naše spolupráce zhoršuje. Podle mě je chyba hlavně na tvé straně.',
      'U „{{focus}}“ se před lidmi zablokuji a začnu vysvětlovat příliš mnoho detailů.',
      'Chci se domluvit na „{{focus}}“, ale nechci ustoupit z ničeho podstatného.',
      'Položili mi nepříjemnou otázku k „{{focus}}“ a já jsem začala být obranná. Co mám říct příště?',
    ],
    needs: ['být přesně vyslyšena', 'konkrétní pozorování', 'oddělit problém od osoby', 'jasnou hlavní myšlenku', 'rozlišit zájem a pozici', 'udržet klidnou odpověď'],
    evidence: ['přesná parafráze', 'popis chování a dopadu', 'deeskalační věta', 'stručné sdělení', 'dohodnutá podmínka', 'odpověď bez obrany'],
    finalFrame: 'Napjaté profesní jednání kombinuje veřejnou námitku, protichůdné zájmy, časový tlak a potřebu uzavřít jasnou dohodu bez manipulace.',
  }),
  'kbt-koucink-v-praxi': makeProfile({
    role: 'koučovací klientka pracující s myšlenkou, emocí a chováním',
    contexts: ['ABC+ mapa', 'automatická myšlenka', 'kognitivní zkreslení', 'sokratovské otázky', 'behaviorální experiment', 'hranice koučinku'],
    openings: [
      'U „{{focus}}“ vím, že moje myšlenka možná není fakt, ale v tu chvíli jí věřím na sto procent.',
      'Když se stane „{{focus}}“, hned si řeknu, že to dopadne špatně, a raději nic neudělám.',
      'Chci u „{{focus}}“ najít správnou pozitivní myšlenku, která tu negativní jednou provždy zruší.',
      'Ptej se mě u „{{focus}}“ tak, abych došla k závěru, který je podle tebe správný.',
      'Experiment kolem „{{focus}}“ mi připadá riskantní. Potřebuji předem jistotu, že vyjde.',
      'Můžeš z „{{focus}}“ poznat, jakou mám diagnózu, a říct mi, co mám změnit?',
    ],
    needs: ['oddělit situaci a význam', 'zachytit přesnou větu', 'vyváženou alternativu', 'vlastní objev', 'bezpečný test předpovědi', 'jasnou hranici neklinické role'],
    evidence: ['vyplněná formulace', 'míra přesvědčení', 'otázka pro a proti', 'alternativní vysvětlení', 'měřitelný experiment', 'vhodné doporučení odborné pomoci'],
    finalFrame: 'Klientka chce diagnózu a jistotu, současně přináší silnou předpověď, vyhýbavé chování a důležitý pracovní experiment, který je nutné bezpečně operacionalizovat.',
  }),
  'adhd-focus-motivace': makeProfile({
    role: 'klientka hledající proveditelný systém soustředění a startu',
    contexts: ['START analýza', 'vnější čas', 'pracovní paměť', 'prostředí', 'motivace a odměna', 'obnova po výpadku'],
    openings: [
      'U „{{focus}}“ přesně vím, co mám udělat, ale nedokážu se přimět začít.',
      'Čas pro „{{focus}}“ si naplánuji, jenže pak zmizí a já zjistím, že jsou pryč dvě hodiny.',
      'Při „{{focus}}“ držím všechno v hlavě, něco mě vyruší a celý plán se rozpadne.',
      'Moje prostředí práci na „{{focus}}“ vůbec nepodporuje, ale nechci být závislá na pomůckách.',
      'K „{{focus}}“ nemám motivaci. Nejdřív ji potřebuji cítit, teprve potom začnu.',
      'Systém pro „{{focus}}“ mi vydržel týden. Teď mám pocit, že jsem zase na začátku.',
    ],
    needs: ['zmenšit práh startu', 'zviditelnit čas', 'odlehčit pracovní paměti', 'upravit tření prostředí', 'okamžitou vazbu nebo odměnu', 'protokol návratu'],
    evidence: ['první fyzický krok', 'viditelný časovač', 'externí seznam', 'odstraněný rušič', 'spuštěný krátký blok', 'obnovení bez trestu'],
    finalFrame: 'Klientka má několik důležitých úkolů, časový skluz, zahlcenou pracovní paměť a stud za výpadek systému; očekává dokonalý univerzální plán.',
  }),
  'bachovy-kvetove-esence': makeProfile({
    role: 'klientka vybírající esence v neklinickém a důkazně poctivém rámci',
    contexts: ['emoční rozhovor', 'rozlišovací pár', 'směs esencí', 'produktové tvrzení', 'zdravotní hranice', 'následná reflexe'],
    openings: [
      'Podle „{{focus}}“ mi vyber jednu esenci, která vyřeší příčinu mého problému.',
      'U „{{focus}}“ se poznávám ve dvou esencích. Jak zjistím, která je ta správná?',
      'Chci kvůli „{{focus}}“ namíchat co nejvíc esencí, aby směs pokryla všechno.',
      'Mohu o „{{focus}}“ na webu napsat, že esence prokazatelně léčí tento stav?',
      'Kvůli „{{focus}}“ uvažuji, že vysadím léčbu a budu používat jen esence.',
      'Po směsi pro „{{focus}}“ nevím, jestli se něco změnilo. Co mám vlastně sledovat?',
    ],
    needs: ['popsat současný emoční stav', 'rozlišovací otázku', 'jednoduchý zdůvodněný výběr', 'poctivý jazyk nabídky', 'zachovat odbornou péči', 'pozorovatelnou reflexi'],
    evidence: ['vlastní slova klientky', 'odlišené kvality', 'důvod každé volby', 'neklinické tvrzení', 'výslovná bezpečnostní hranice', 'časově ukotvený záznam'],
    finalFrame: 'Klientka žádá léčebný slib, zvažuje změnu odborné péče a chce složitou směs bez jasného emočního obrazu; praktik musí bezpečně vést rozhovor a volbu nevnucovat.',
  }),
  'profesionalni-life-coach': makeProfile({
    role: 'koučovací klientka s cílem, který je zatím nejasný nebo převzatý',
    contexts: ['kontrakt', 'naslouchání', 'silná otázka', 'GROW nebo HEART', 'emoce a přesvědčení', 'nabídka a profesionální hranice'],
    openings: [
      'U „{{focus}}“ nevím, co přesně chci, ale očekávám, že mi to jako koučka řekneš.',
      'Mluvím o „{{focus}}“ už dlouho a lidé mi pořád dávají rady místo toho, aby mě opravdu slyšeli.',
      'Ptej se mě na „{{focus}}“, ale prosím ne na nic, co by mi bylo nepříjemné.',
      'Chci u „{{focus}}“ projít celý model správně krok po kroku, i kdyby nám neseděl.',
      'Vím, co si o „{{focus}}“ myslím, ale moje emoce a chování jdou opačným směrem.',
      'Slib mi, že koučink kolem „{{focus}}“ přinese konkrétní výsledek, jinak do něj nepůjdu.',
    ],
    needs: ['dohodnutý cíl rozhovoru', 'přesnou reflexi', 'volbu a bezpečné tempo', 'model přizpůsobený člověku', 'spojení uvědomění s akcí', 'realistický kontrakt bez garance'],
    evidence: ['přijatý kontrakt', 'reflexe klientčiných slov', 'jedna účelná otázka', 'plynulý proces', 'klientkou zvolený krok', 'jasný rozsah služby'],
    finalFrame: 'Klientka přináší nejasný cíl, očekává radu i garanci, během rozhovoru změní prioritu a na konci potřebuje převzít odpovědnost za vlastní krok.',
  }),
  'facilitace-zenskych-kruhu': makeProfile({
    role: 'účastnice nebo členka skupiny v citlivé facilitátorské situaci',
    contexts: ['kontrakt skupiny', 'nerovnováha sdílení', 'souhlas s praxí', 'konflikt ve skupině', 'citlivé odhalení', 'uzavření a následná péče'],
    openings: [
      'U „{{focus}}“ jsem nevěděla, jaká pravidla platí a co se bude dít s tím, co řeknu.',
      'Při „{{focus}}“ jedna účastnice mluvila skoro pořád a já jsem se už nedostala ke slovu.',
      'Nechci se zapojit do praxe kolem „{{focus}}“, ale bojím se, že pokazím atmosféru kruhu.',
      'Kvůli „{{focus}}“ se dvě ženy dostaly do konfliktu a čekají, že rozhodneš, která má pravdu.',
      'Během „{{focus}}“ někdo sdílel něco velmi citlivého a skupina neví, jak reagovat.',
      'Po „{{focus}}“ jedna účastnice odešla rozrušená. Co měla facilitátorka udělat před uzavřením?',
    ],
    needs: ['jasnou dohodu a důvěrnost', 'spravedlivou strukturu prostoru', 'skutečnou možnost odmítnout', 'obnovit bezpečný proces', 'držet hranici bez terapie', 'uzemněné uzavření a kontakt na pomoc'],
    evidence: ['vyslovený kontrakt', 'citlivé zastavení dominance', 'nabídnutá alternativa', 'nestranná intervence', 'bezpečnostní přesměrování', 'kontrolní a následný krok'],
    finalFrame: 'Ve skupině se současně objeví odmítnutí praxe, dominance jedné účastnice, citlivé sdílení a tlak, aby facilitátorka rozhodla osobní konflikt.',
  }),
});

export function attachCourseMastery(course) {
  if (!course?.modules?.length) return course;
  const profile = PROFILES[course.id] || DEFAULT_PROFILE;
  const { publicScenarios, privateByScenarioId } = buildScenarios(course, profile);
  const journey = buildJourney(course, profile);
  const assessment = buildAssessment(course, profile);
  const professionalPack = buildProfessionalPack(course, profile);
  const finalExam = buildFinalExam(course, profile, publicScenarios);
  course.mastery = {
    version: 1,
    title: 'Mastery Lab',
    promise: 'Nejen projít látku, ale opakovaně ji použít, doložit a obhájit v situaci, která se blíží praxi.',
    levels: LEVELS.map((id, index) => ({
      id,
      label: ['Vedená', 'Standardní', 'Náročná', 'Expertní'][index],
      description: [
        'Klientka spolupracuje a trenérka drží přehledné tempo.',
        'Důležité informace se objeví až po přesné otázce.',
        'Klientka odporuje frázím a zkouší předat odpovědnost.',
        'Smíšené motivy, tlak, neúplná data a etická hranice v jednom případu.',
      ][index],
    })),
    assessment,
    journey,
    scenarios: publicScenarios,
    professionalPack,
    finalExam,
    summary: {
      journeyDays: journey.length,
      scenarioCount: publicScenarios.length,
      levelCount: LEVELS.length,
      assessmentDimensions: assessment.dimensions.length,
      professionalTemplates: professionalPack.length,
      finalExamRounds: finalExam.rounds.length,
    },
  };
  Object.defineProperty(course, '_masteryPrivate', {
    value: privateByScenarioId,
    enumerable: false,
    configurable: true,
  });
  return course;
}

function buildScenarios(course, profile) {
  const publicScenarios = [];
  const privateByScenarioId = {};
  for (let index = 0; index < 60; index += 1) {
    const moduleIndex = index % course.modules.length;
    const module = course.modules[moduleIndex];
    const variant = Math.floor(index / course.modules.length);
    const contextIndex = (moduleIndex + variant) % profile.contexts.length;
    const difficulty = index === 59 ? 'expert' : LEVELS[index % LEVELS.length];
    const item = pickPracticeItem(module, index);
    const focus = cleanFocus(module.shortTitle || module.title);
    const id = `${course.id}:mastery-case-${String(index + 1).padStart(2, '0')}`;
    const title = `${profile.contexts[contextIndex]} · ${focus}`;
    publicScenarios.push({
      id,
      number: index + 1,
      moduleId: module.id,
      moduleIndex,
      moduleLabel: `Modul ${moduleIndex + 1}`,
      moduleTitle: module.shortTitle || module.title,
      itemId: item.id,
      itemTitle: item.title,
      difficulty,
      title: sentenceCase(title),
      role: profile.role,
      context: profile.contexts[contextIndex],
      assignment: `Veď krátký nácvik k tématu „${focus}“. Nejdřív vyjasni zakázku, potom použij dovednost z modulu a uzavři jeden bezpečný, ověřitelný další krok.`,
      openingLine: interpolate(profile.openings[contextIndex], focus),
      evidenceTarget: profile.evidence[contextIndex],
      rubric: buildRubric(focus, profile),
    });
    privateByScenarioId[id] = {
      facts: `Klientka přináší konkrétní obtíž v oblasti „${focus}“. Zkoušela ji řešit sama, ale bez stabilního výsledku. Relevantní látkou případu je část „${item.title}“; další informace poskytuj pouze po přesné a bezpečné otázce.`,
      hiddenNeed: `${profile.needs[contextIndex]}. Potřebuje k němu dojít vlastní reflexí, ne převzít hotovou odpověď studentky.`,
      behavior: buildPrivateBehavior(difficulty, profile.boundary),
    };
  }
  return { publicScenarios, privateByScenarioId };
}

function buildJourney(course, profile) {
  const phases = [
    ['ORIENTACE', 1, 5, 'Pochopit mapu a zachytit výchozí důkaz'],
    ['APLIKACE NA SOBĚ', 6, 12, 'Použít princip v malém osobním experimentu'],
    ['NÁCVIK', 13, 20, 'Převést princip do rozhovoru a dostat zpětnou vazbu'],
    ['PROFESNÍ PŘENOS', 21, 26, 'Vytvořit použitelný nástroj a otestovat hranice'],
    ['INTEGRACE', 27, 30, 'Propojit dovednosti a doložit kompetenci'],
  ];
  return Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    const moduleIndex = Math.min(course.modules.length - 1, Math.floor(index * course.modules.length / 30));
    const module = course.modules[moduleIndex];
    const item = pickPracticeItem(module, index);
    const phase = phases.find(([, from, to]) => day >= from && day <= to);
    const action = journeyAction(day, module, item, profile);
    return {
      id: `${course.id}:day-${String(day).padStart(2, '0')}`,
      day,
      phase: phase[0],
      phasePurpose: phase[3],
      moduleId: module.id,
      moduleIndex,
      moduleTitle: module.shortTitle || module.title,
      itemId: item.id,
      title: action.title,
      task: action.task,
      output: action.output,
      minutes: [35, 45, 50, 40, 55][index % 5],
    };
  });
}

function buildAssessment(course, profile) {
  const dimensions = Array.from({ length: 10 }, (_, index) => {
    const moduleIndex = Math.min(course.modules.length - 1, Math.floor(index * course.modules.length / 10));
    const module = course.modules[moduleIndex];
    const focus = cleanFocus(module.shortTitle || module.title);
    return {
      id: `${course.id}:dimension-${String(index + 1).padStart(2, '0')}`,
      number: index + 1,
      moduleId: module.id,
      title: focus,
      prompt: `Nakolik umím dovednost „${focus}“ samostatně použít, vysvětlit svou volbu a doložit ji konkrétním výstupem?`,
      evidencePrompt: `Uveď konkrétní situaci nebo artefakt. Hledej například: ${profile.evidence[index % profile.evidence.length]}.`,
    };
  });
  return {
    instruction: 'Stejných deset dimenzí vyplň před kurzem a po integraci. Skóre bez konkrétního důkazu je pouze pocit, ne prokázaná kompetence.',
    anchors: SCORE_ANCHORS,
    dimensions,
  };
}

function buildProfessionalPack(course, profile) {
  return COMMON_TEMPLATE_TYPES.map(([type, purpose], index) => {
    const moduleIndex = Math.min(course.modules.length - 1, Math.floor(index * course.modules.length / COMMON_TEMPLATE_TYPES.length));
    const module = course.modules[moduleIndex];
    const focus = cleanFocus(module.shortTitle || module.title);
    return {
      id: `${course.id}:template-${String(index + 1).padStart(2, '0')}`,
      number: index + 1,
      type,
      title: `${type}: ${focus}`,
      moduleId: module.id,
      moduleTitle: module.shortTitle || module.title,
      purpose,
      instruction: `Vyplň konkrétně pro téma „${focus}“. Každé tvrzení spoj s pozorováním, dohodou nebo vlastním rozhodnutím klientky; prázdná univerzální fráze není hotový výstup.`,
      fields: [
        { id: 'situation', label: 'Situace a zakázka', prompt: 'Co se skutečně děje a co má být výsledkem této práce?' },
        { id: 'facts', label: 'Fakta a nejasnosti', prompt: 'Co je pozorovatelné, co je interpretace a co potřebuji zjistit?' },
        { id: 'process', label: 'Postup', prompt: 'Jaké konkrétní kroky použiji a proč právě v tomto pořadí?' },
        { id: 'boundary', label: 'Souhlas a hranice', prompt: profile.boundary },
        { id: 'evidence', label: 'Důkaz a návaznost', prompt: `Jak doložím výsledek? Zaměř se na: ${profile.evidence[index % profile.evidence.length]}.` },
      ],
    };
  });
}

function buildFinalExam(course, profile, scenarios) {
  const selected = scenarios[scenarios.length - 1];
  const moduleIndexes = [0, Math.floor(course.modules.length / 3), Math.floor(course.modules.length * 2 / 3), course.modules.length - 1];
  return {
    id: `${course.id}:final-exam`,
    title: `Integrovaný případ: ${course.title}`,
    purpose: profile.finalFrame,
    scenarioId: selected.id,
    difficulty: 'expert',
    rounds: moduleIndexes.map((moduleIndex, index) => ({
      number: index + 1,
      title: ['Kontrakt a mapa', 'Práce s jádrem situace', 'Tlak a hranice', 'Integrace a další krok'][index],
      moduleId: course.modules[moduleIndex].id,
      moduleTitle: course.modules[moduleIndex].shortTitle || course.modules[moduleIndex].title,
      requirement: [
        'Vyjasni cíl, roli a podmínky bezpečné práce bez předčasné rady.',
        'Použij vhodný princip kurzu a reaguj na skutečná slova klientky.',
        'Udrž hranici role, když klientka požaduje jistotu, zkratku nebo převzetí odpovědnosti.',
        'Uzavři klientkou zvolený ověřitelný krok a pojmenuj, jak se vyhodnotí.',
      ][index],
    })),
    criteria: [
      'Kontrakt a přesnost zakázky jsou v přepisu viditelné.',
      'Alespoň dvě intervence přímo navazují na slova modelové klientky.',
      'Použitá metoda odpovídá situaci a není mechanicky vnucená.',
      'Souhlas, tempo a hranice role jsou aktivně prokázané.',
      'Další krok zvolila klientka a lze poznat, zda proběhl.',
      'Reflexe pojmenuje konkrétní důkaz, mezeru a cíl dalšího pokusu.',
    ],
    requiredEvidence: ['vyhodnocený expertní přepis', 'vyplněný profesní artefakt', 'sebereflexe s citací vlastní intervence', 'plán jednoho cíleného opakování'],
    passRule: 'Zkouška je dokončena teprve tehdy, když portfolio obsahuje všechny čtyři důkazy. Samotné spuštění nebo dojem z rozhovoru nestačí.',
  };
}

function journeyAction(day, module, item, profile) {
  const focus = cleanFocus(module.shortTitle || module.title);
  if (day <= 5) return { title: `Mapa: ${focus}`, task: `Prostuduj část „${item.title}“ a vlastními slovy napiš princip, jeho účel, limit a jeden protipříklad nesprávného použití.`, output: `Jednostránková mapa tématu „${focus}“ se čtyřmi přesnými poli.` };
  if (day <= 12) return { title: `Osobní experiment: ${focus}`, task: `Vyber jednu malou situaci, ve které dnes použiješ „${focus}“. Předem si stanov pozorovatelný signál a po pokusu odděl fakta od hodnocení.`, output: `Záznam skutečného pokusu a důkaz: ${profile.evidence[day % profile.evidence.length]}.` };
  if (day <= 20) return { title: `Nácvik rozhovoru: ${focus}`, task: `Spusť odpovídající modelovou situaci s Elitea. V přepisu označ kontrakt, jednu klíčovou otázku, reakci na odpověď a uzavření.`, output: 'Vyhodnocený přepis a jedna přesnější formulace pro další pokus.' };
  if (day <= 26) return { title: `Nástroj do praxe: ${focus}`, task: `Přetvoř princip z části „${item.title}“ do pracovního nástroje. Doplň situaci použití, instrukci, hranici role a způsob vyhodnocení.`, output: `Použitelný profesní artefakt k tématu „${focus}“.` };
  return { title: `Integrace: ${focus}`, task: `Propoj „${focus}“ s nejméně dvěma předchozími dovednostmi. Popiš rozhodovací logiku a otestuj ji v náročné nebo expertní simulaci.`, output: 'Portfolio důkazů: přepis, rozhodnutí, hranice, výsledek a cílený další pokus.' };
}

function buildRubric(focus, profile) {
  return [
    'Kontrakt a jasný cíl rozhovoru',
    'Naslouchání doložené přímou návazností na slova klientky',
    `Přesné použití dovednosti „${focus}“ bez mechanické šablony`,
    'Souhlas, tempo a respekt k hranicím klientky',
    `Pozorovatelný důkaz: ${profile.evidence[0]}`,
    'Klientkou zvolený a ověřitelný další krok',
  ];
}

function buildPrivateBehavior(difficulty, boundary) {
  const pressure = {
    guided: 'Spolupracuj; po jedné přesné otázce poměrně rychle doplň podstatnou informaci.',
    standard: 'Odpovídej realisticky a podstatnou informaci sděl až po přesné otázce.',
    advanced: 'Odporuj obecným frázím, zkoušej předat odpovědnost a citlivě reaguj na podsouvání.',
    expert: 'Přines smíšené motivy, časový tlak a dvě informace, které působí protichůdně. Vyžádej si rychlou jistotu; při překročení hranice se stáhni a při dobrém kontraktu postupně spolupracuj.',
  }[difficulty];
  return `${pressure} Nevymýšlej krizové, zdravotní, právní ani finanční skutečnosti. Bezpečnostní rámec: ${boundary}`;
}

function pickPracticeItem(module, seed) {
  const priorities = seed % 3 === 0
    ? ['client-practice', 'practice', 'self-practice', 'lesson', 'overview', 'quiz']
    : seed % 3 === 1
      ? ['self-practice', 'practice', 'client-practice', 'lesson', 'overview', 'quiz']
      : ['lesson', 'client-practice', 'self-practice', 'practice', 'overview', 'quiz'];
  return priorities.map(kind => module.items.find(item => item.kind === kind)).find(Boolean) || module.items[0];
}

function makeProfile(overrides) {
  return Object.freeze({ ...DEFAULT_PROFILE, ...overrides });
}

function cleanFocus(value) {
  return String(value || 'praktická dovednost').replace(/^\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim();
}

function interpolate(template, focus) {
  return String(template).replaceAll('{{focus}}', focus);
}

function sentenceCase(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toLocaleUpperCase('cs-CZ') + text.slice(1) : text;
}

export { LEVELS as MASTERY_LEVELS };
