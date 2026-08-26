const CATEGORY_CONFIG = Object.freeze([
  {
    id: 'self_direction',
    label: 'Sebepoznání a směr',
    families: ['core_coaching', 'solution_focused', 'strengths_coaching'],
    prompts: [
      ['situation', 'Co právě řeším?', 'Popiš konkrétní situaci bez hodnocení a zobecňování.'],
      ['desired', 'Jaký výsledek chci?', 'Co bude po práci s tímto listem pozorovatelně jinak?'],
      ['resources', 'Co už funguje a o co se můžu opřít?', 'Zachyť výjimky, silné stránky, zkušenosti a dostupné zdroje.'],
      ['choice', 'Jakou možnost si volím?', 'Pojmenuj vlastní rozhodnutí, ne očekávání okolí.'],
      ['evidence', 'Jak poznám posun?', 'Napiš první důkaz, termín a způsob krátkého vyhodnocení.'],
    ],
  },
  {
    id: 'goals_action',
    label: 'Cíle, návyky a akce',
    families: ['goal_execution', 'behavior_change', 'productivity'],
    prompts: [
      ['goal', 'Konkrétní cíl', 'Co přesně má vzniknout, změnit se nebo být dokončeno?'],
      ['reality', 'Výchozí realita', 'Fakta, omezení, kapacita a to, co už bylo vyzkoušeno.'],
      ['friction', 'Kde vzniká tření?', 'Spouštěč, překážka, odklad nebo bod, kde se proces obvykle zastaví.'],
      ['step', 'Nejmenší proveditelný krok', 'Co uděláš, kdy, kde a v jaké minimální verzi?'],
      ['review', 'Kontrola a návrat po výpadku', 'Jak změříš výsledek a jak se vrátíš bez trestání sebe sama?'],
    ],
  },
  {
    id: 'thinking_emotions',
    label: 'Myšlení a emoce',
    families: ['cbt_inspired', 'cognitive_behavioral_coaching', 'act_inspired', 'dbt_inspired', 'emotion_skills', 'mindfulness'],
    prompts: [
      ['event', 'Co se skutečně stalo?', 'Zapiš pozorovatelná fakta odděleně od výkladu.'],
      ['inner_response', 'Co se objevilo uvnitř?', 'Myšlenky, emoce, tělesné signály a nutkání k jednání.'],
      ['meaning', 'Jaký význam tomu přikládám?', 'Který závěr je fakt a který je moje současná interpretace?'],
      ['helpful_response', 'Jaká odpověď by byla přesnější a užitečnější?', 'Ne pozitivní fráze, ale věta, které můžeš věřit a podle které lze jednat.'],
      ['action', 'Co udělám v souladu se sebou?', 'Jeden bezpečný krok, který je v mé moci.'],
    ],
  },
  {
    id: 'communication',
    label: 'Komunikace a vztahy',
    families: ['communication', 'motivational_interviewing', 'nlp_inspired'],
    prompts: [
      ['context', 'Situace a vztah', 'S kým mluvím, co se děje a co je pro mě důležité zachovat?'],
      ['observation', 'Pozorování bez nálepky', 'Jak situaci popíšu konkrétně, bez čtení myšlenek a obviňování?'],
      ['need', 'Moje potřeba, hranice nebo záměr', 'Co potřebuji sdělit, chránit, zjistit nebo vyjednat?'],
      ['words', 'Přesná formulace', 'Napiš jednu větu tak, jak ji skutečně chceš říct.'],
      ['response_plan', 'Jak zareaguji na odpověď?', 'Co uděláš při souhlasu, nesouhlasu, odkladu nebo tlaku?'],
    ],
  },
  {
    id: 'learning_focus',
    label: 'Učení, paměť a fokus',
    families: ['learning', 'business_learning'],
    prompts: [
      ['target', 'Co si potřebuji osvojit?', 'Jedna konkrétní dovednost, informace nebo výstup.'],
      ['baseline', 'Co už umím bez nápovědy?', 'Krátce se otestuj a zachyť skutečný výchozí stav.'],
      ['method', 'Jak budu trénovat?', 'Zvol aktivní vybavení, praxi, zpětnou vazbu a vhodné intervaly.'],
      ['environment', 'Jak upravím podmínky?', 'Čas, délka bloku, rušivé vlivy, pomůcky a úroveň obtížnosti.'],
      ['proof', 'Jak ověřím přenos do praxe?', 'Konkrétní úkol, na kterém poznáš, že znalost opravdu používáš.'],
    ],
  },
  {
    id: 'business_strategy',
    label: 'Byznys a rozhodování',
    families: ['business_strategy', 'business_diagnosis', 'business_decision', 'business_research', 'business_risk'],
    prompts: [
      ['decision', 'Jaké rozhodnutí nebo problém řeším?', 'Vymez jednu obchodní otázku a časový horizont.'],
      ['evidence', 'Co víme z dat a reality?', 'Zákazníci, čísla, kapacita, omezení a ověřené signály.'],
      ['options', 'Jaké jsou skutečné varianty?', 'Zahrň i variantu nic neměnit nebo udělat malý test.'],
      ['tradeoffs', 'Cena, přínos a riziko každé varianty', 'Co získáš, čeho se vzdáš a co musí být pravda, aby volba fungovala?'],
      ['experiment', 'Nejlevnější důkaz před velkým rozhodnutím', 'Jaký malý krok přinese nejvíc relevantních informací?'],
    ],
  },
  {
    id: 'offer_marketing',
    label: 'Nabídka, marketing a prodej',
    families: ['business_offer', 'business_marketing', 'business_sales'],
    prompts: [
      ['customer', 'Pro koho přesně?', 'Konkrétní zákaznice, její situace a okamžik, ve kterém hledá řešení.'],
      ['problem', 'Jaký problém nebo žádoucí výsledek řeší?', 'Použij její jazyk, ne interní marketingové fráze.'],
      ['promise', 'Jakou hodnotu nabízím?', 'Výsledek, mechanismus a realistická hranice toho, co slibuji.'],
      ['proof', 'Jak nabídku podložím?', 'Reference, ukázka, data, proces, zkušenost nebo bezpečný test.'],
      ['next_move', 'Další obchodní krok', 'Jedna zpráva, nabídka, rozhovor nebo experiment s termínem.'],
    ],
  },
  {
    id: 'money_operations',
    label: 'Peníze a fungování praxe',
    families: ['business_finance', 'business_execution', 'business_operations', 'business_negotiation'],
    prompts: [
      ['objective', 'Jaký ekonomický nebo provozní výsledek potřebuji?', 'Částka, kapacita, termín nebo standard fungování.'],
      ['inputs', 'Jaká jsou vstupní čísla a podmínky?', 'Čas, přímé náklady, režie, poptávka, odpovědnosti a omezení.'],
      ['calculation', 'Výpočet nebo rozhodovací logika', 'Zapiš předpoklady a postup tak, aby šel později zkontrolovat.'],
      ['boundary', 'Moje minimum a hranice', 'Co je nepřijatelné a kde začíná životaschopná dohoda?'],
      ['followup', 'Akce a datum kontroly', 'Kdo udělá co, do kdy a podle jaké metriky výsledek vyhodnotíš?'],
    ],
  },
]);

const FALLBACK_CATEGORY = CATEGORY_CONFIG[0];

const FAMILY_GUIDANCE = Object.freeze({
  core_coaching: {
    discovery: 'co je skutečný cíl, co je jen tlak okolí a který krok je opravdu tvoje volba',
    takeaway: 'jasně pojmenovaný cíl, rozhodovací kritérium a první dobrovolně zvolený krok',
    followup: 'ověř, zda zvolený krok skutečně vede k cíli, a podle výsledku ho uprav',
  },
  solution_focused: {
    discovery: 'kde už se objevují výjimky, dostupné zdroje a malé známky žádoucí změny',
    takeaway: 'konkrétní obraz zlepšení a malý krok postavený na tom, co už funguje',
    followup: 'sleduj první pozorovatelný důkaz zlepšení a zachyť, co mu pomohlo',
  },
  cognitive_behavioral_coaching: {
    discovery: 'jak spolu souvisejí situace, tvoje interpretace, emoce a následné jednání',
    takeaway: 'přesnější pohled na situaci a proveditelnou odpověď, kterou můžeš vyzkoušet',
    followup: 'porovnej očekávání se skutečným výsledkem a zapiš, co se potvrdilo',
  },
  strengths_coaching: {
    discovery: 'které silné stránky už používáš, v čem se projevují a kde zůstávají nevyužité',
    takeaway: 'mapu konkrétních zdrojů a způsob, jak jeden z nich zapojit do aktuální situace',
    followup: 'v praxi vědomě použij vybranou silnou stránku a zaznamenej její dopad',
  },
  goal_execution: {
    discovery: 'kde přesně se cíl zastavuje, co vytváří tření a jak malý krok je reálně udržitelný',
    takeaway: 'konkrétní plán včetně spouštěče, minimální verze kroku a návratu po výpadku',
    followup: 'proveď nejmenší naplánovanou verzi a po krátkém testu uprav podmínky',
  },
  motivational_interviewing: {
    discovery: 'co tě ke změně skutečně táhne, co tě brzdí a jak silná je tvoje vlastní připravenost',
    takeaway: 'vlastní důvody pro změnu, pojmenovanou ambivalenci a další krok bez vnějšího nátlaku',
    followup: 'vrať se k vlastnímu důvodu pro změnu a ověř, zda další krok stále dává smysl',
  },
  cbt_inspired: {
    discovery: 'které závěry jsou fakta, které jsou domněnky a jak ovlivňují emoce i chování',
    takeaway: 'realističtější pracovní hypotézu a bezpečný způsob, jak ji ověřit v běžné situaci',
    followup: 'udělej malý test a zapiš skutečný výsledek místo původního předpokladu',
  },
  act_inspired: {
    discovery: 'co je pro tebe důležité a zda tě současná reakce přibližuje k hodnotám, nebo od nich vzdaluje',
    takeaway: 'hodnotově ukotvený směr a krok, který můžeš udělat i za přítomnosti nepohodlí',
    followup: 'všimni si nepohodlí bez boje a proveď zvolený hodnotový krok v malé míře',
  },
  dbt_inspired: {
    discovery: 'co říkají fakta, co emoce a kde může vzniknout vyváženější a účinnější reakce',
    takeaway: 'strukturovanou odpověď, která respektuje emoce, realitu i tvoje hranice',
    followup: 'použij připravenou odpověď v nízkorizikové situaci a vyhodnoť její účinek',
  },
  nlp_inspired: {
    discovery: 'jak jazyk, úhel pohledu a úroveň detailu formují tvoje možnosti a vnímání situace',
    takeaway: 'přesnější formulaci výsledku nebo nový rámec, který rozšiřuje dostupné volby',
    followup: 'otestuj novou formulaci v konkrétním jednání a sleduj, zda otevírá užitečnější možnosti',
  },
  emotion_skills: {
    discovery: 'jakou emoci skutečně prožíváš, co ji spouští a jaký signál nebo potřebu nese',
    takeaway: 'přesněji pojmenovaný vnitřní stav a bezpečný další krok bez sebeobviňování',
    followup: 'zkontroluj po zvoleném kroku intenzitu emoce a co se v těle či jednání změnilo',
  },
  communication: {
    discovery: 'co chceš sdělit, jakou potřebu či hranici chráníš a kde komunikaci kalí domněnky',
    takeaway: 'konkrétní větu, žádost nebo zpětnou vazbu a plán reakce na různé odpovědi',
    followup: 'použij připravenou formulaci a následně odděl reakci druhého od kvality vlastního sdělení',
  },
  business_decision: {
    discovery: 'která kritéria rozhodují, jaké jsou skutečné varianty a kde hrozí přehlédnuté riziko',
    takeaway: 'srovnání variant, rozhodovací logiku a nejlevnější ověření před velkým závazkem',
    followup: 'získej chybějící důkaz a podle předem zvolených kritérií rozhodnutí potvrď nebo změň',
  },
  business_execution: {
    discovery: 'které činnosti mají největší dopad, co je pouze naléhavé a kde se práce zbytečně tříští',
    takeaway: 'prioritizovaný postup, jasné pořadí kroků a způsob průběžné kontroly',
    followup: 'dokonči první prioritu, zkontroluj dopad a teprve potom otevři další krok',
  },
  business_strategy: {
    discovery: 'kde je skutečná páka růstu, co omezuje výsledek a které předpoklady strategie nejsou ověřené',
    takeaway: 'strategickou mapu, prioritu a konkrétní test nejdůležitějšího předpokladu',
    followup: 'proveď zvolený strategický test a rozhoduj podle výsledku, ne podle dojmu',
  },
  business_diagnosis: {
    discovery: 'kde vzniká problém, co je příčina, co jen symptom a která data ještě chybějí',
    takeaway: 'pracovní diagnózu problému, seznam důkazů a další ověřovací krok',
    followup: 'doplň chybějící data a zkontroluj, zda zásah mění příčinu, ne pouze viditelný symptom',
  },
  business_offer: {
    discovery: 'jakou práci zákaznice potřebuje vyřešit, za co vnímá hodnotu a kde nabídka ztrácí srozumitelnost',
    takeaway: 'přesnější nabídku, hodnotový argument a bezpečný způsob ověření ochoty koupit',
    followup: 'ukaž upravenou nabídku skutečným zákaznicím a zachyť jejich jednání, ne jen názor',
  },
  business_research: {
    discovery: 'co zákaznice skutečně dělají, potřebují a kupují oproti tomu, co si o nich pouze myslíš',
    takeaway: 'výzkumnou otázku, test a kritérium, podle kterého vyhodnotíš získané signály',
    followup: 'proveď rozhovor nebo malý test a odděl pozorovaná data od vlastní interpretace',
  },
  business_finance: {
    discovery: 'která čísla nesou zisk, kde odtéká hotovost a jaké finanční hranice chrání zdravé fungování',
    takeaway: 'kontrolovatelný výpočet, klíčový limit a rozhodnutí opřené o reálná čísla',
    followup: 'aktualizuj vstupní čísla v určeném termínu a ověř, zda se rozhodnutí stále vyplácí',
  },
  business_negotiation: {
    discovery: 'jaká je tvoje nejlepší alternativa, skutečné minimum a prostor pro dohodu bez zbytečného ústupku',
    takeaway: 'vyjednávací hranice, varianty dohody a konkrétní další tah',
    followup: 'před jednáním si ověř alternativu a během něj nesnižuj hranici bez nové protihodnoty',
  },
  business_sales: {
    discovery: 'kde se obchodní příležitosti zastavují, které leady mají kvalitu a co má následovat',
    takeaway: 'přehled obchodního toku, prioritu kontaktů a konkrétní follow-up',
    followup: 'proveď naplánovaný kontakt a sleduj posun do další fáze místo pouhé aktivity',
  },
  business_operations: {
    discovery: 'co má zůstat ve tvých rukou, co lze předat a jaké zadání chybí pro spolehlivé provedení',
    takeaway: 'rozdělení odpovědností, standard výsledku a kontrolní bod',
    followup: 'předej úkol s jasným výsledkem a kontroluj domluvený výstup, ne každý mezikrok',
  },
  business_learning: {
    discovery: 'co přineslo výsledek, co nefungovalo a jaké poučení má smysl přenést do dalšího pokusu',
    takeaway: 'oddělená fakta, ponaučení a konkrétní změnu pro příští cyklus',
    followup: 'zapracuj vybrané ponaučení do dalšího pokusu a porovnej výsledek',
  },
  productivity: {
    discovery: 'co narušuje soustředění, kam mizí kapacita a jaké podmínky ti umožňují pracovat kvalitněji',
    takeaway: 'upravený pracovní blok, jednu prioritu a pravidlo pro návrat pozornosti',
    followup: 'otestuj nastavení v jednom pracovním bloku a po něm vyhodnoť energii i dokončený výstup',
  },
  learning: {
    discovery: 'co už umíš bez nápovědy, kde vzniká mezera a která forma tréninku podporuje skutečné vybavení',
    takeaway: 'konkrétní studijní plán, způsob aktivního procvičení a důkaz přenosu do praxe',
    followup: 'otestuj se bez podkladů a podle chyb naplánuj další krátké opakování',
  },
  business_risk: {
    discovery: 'které tvrzení nebo krok může vytvořit právní, reputační či platformní riziko a jak ho zpřesnit',
    takeaway: 'kontrolní seznam rizik, bezpečnější formulaci a bod vyžadující odborné ověření',
    followup: 'před zveřejněním ověř označené body a uchovej podklad pro každé důležité tvrzení',
  },
  business_marketing: {
    discovery: 'které sdělení odpovídá fázi zákaznice, co má kreativa dokázat a jak výsledek férově změřit',
    takeaway: 'použitelný marketingový brief, variantu sdělení a jasné kritérium testu',
    followup: 'spusť jednu kontrolovanou variantu, nech test doběhnout a rozhodni podle předem zvolené metriky',
  },
  behavior_change: {
    discovery: 'jaký spouštěč, odměna a prostředí drží současný vzorec a kde lze změnu nejsnáze začít',
    takeaway: 'mapu návykové smyčky, náhradní reakci a malý opakovatelný experiment',
    followup: 'opakuj náhradní reakci ve stejném kontextu a sleduj, co usnadňuje její vybavení',
  },
  mindfulness: {
    discovery: 'co se v přítomném okamžiku skutečně děje, které podněty přehlížíš a kam automaticky odchází pozornost',
    takeaway: 'konkrétní záznam vjemů a jemný způsob, jak vracet pozornost bez hodnocení',
    followup: 'zopakuj krátké pozorování v jiném kontextu a porovnej, čeho sis všimla',
  },
});

export function buildWorksheetLibrary(techniqueCards) {
  const worksheets = techniqueCards
    .filter(card => card.access_level === 'ai_coaching')
    .map(card => buildWorksheet(card));
  const categories = CATEGORY_CONFIG
    .map(category => ({
      id: category.id,
      label: category.label,
      count: worksheets.filter(worksheet => worksheet.category === category.id).length,
    }))
    .filter(category => category.count > 0);
  return {
    categories: [{ id: 'all', label: 'Všechny', count: worksheets.length }, ...categories],
    items: worksheets,
  };
}

function buildWorksheet(card) {
  const category = CATEGORY_CONFIG.find(item => item.families.includes(card.family)) || FALLBACK_CATEGORY;
  const guidance = FAMILY_GUIDANCE[card.family] || FAMILY_GUIDANCE.core_coaching;
  const situations = card.use_when.join(' nebo ');
  return {
    id: `worksheet-${card.id}`,
    techniqueId: card.id,
    title: card.name,
    category: category.id,
    categoryLabel: category.label,
    estimatedMinutes: estimateMinutes(card),
    useWhen: card.use_when,
    method: card.core_move,
    purpose: `Tento list je pro chvíli, kdy řešíš: ${situations}. Pomůže ti převést téma do struktury techniky ${card.name}, aby ses nezastavila jen u přemýšlení.`,
    canDiscover: `Můžeš zjistit ${guidance.discovery}. Konkrétně budeš pracovat s tímto principem: ${card.core_move}`,
    takeaway: `Na konci budeš mít ${guidance.takeaway}. To je praktický výstup listu — ne pouze popsané pocity nebo zaplněný papír.`,
    usageSummary: `Vyber jednu konkrétní situaci, projdi otázky v pořadí a skonči jedním krokem, který ověříš v praxi.`,
    howToUse: [
      `Nejdřív vyber jednu konkrétní situaci, která odpovídá tomuto použití: ${situations}. Nemíchej do jednoho listu více problémů.`,
      `Procházej pět částí v pořadí. Drž se principu techniky ${card.name}: ${card.core_move}`,
      `Po poslední otázce si označ jednu větu, rozhodnutí nebo krok, který je pro tebe nejdůležitější. Výstupem má být ${guidance.takeaway}.`,
      `List ulož a pokračuj v realitě: ${guidance.followup}. Potom se k němu vrať a dopiš, co ses dozvěděla.`,
    ],
    boundary: card.avoid[0],
    prompts: category.prompts.map(([id, label, help]) => ({ id, label, help })),
  };
}

function estimateMinutes(card) {
  const length = card.core_move.length + card.use_when.join(' ').length;
  return length > 220 ? 25 : length > 130 ? 20 : 15;
}
