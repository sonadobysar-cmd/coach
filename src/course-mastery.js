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
  'podnikani-od-napadu-k-rustu': makeProfile({
    role: 'zakladatelka, zákaznice, členka týmu nebo kritická oponentka podnikatelského rozhodnutí',
    contexts: ['zákaznický výzkum', 'validace nabídky', 'pozicioning a cena', 'marketing a prodej', 'cash-flow a provoz', 'škálování a závěrečná obhajoba'],
    openings: [
      'Můj nápad pro „{{focus}}“ lidé chválí, takže už podle mě nepotřebuji další validaci.',
      'U „{{focus}}“ mám spoustu rozhovorů, ale nevím, které výroky jsou důkaz a které jen zdvořilost.',
      'Chci u „{{focus}}“ zvednout cenu, přidat neomezenou podporu a současně zachovat stejnou marži.',
      'Pro „{{focus}}“ potřebuji být na všech kanálech. Když něco vynechám, určitě přijdu o zákaznice.',
      'Tržby kolem „{{focus}}“ rostou, ale hotovost klesá. Myslím, že to spraví další rychlý růst.',
      'Chci „{{focus}}“ škálovat hned. Procesy, rizika a exit můžeme vyřešit, až budeme větší.',
    ],
    needs: ['oddělit fakt a hypotézu', 'silnější behaviorální důkaz', 'spočítat ekonomiku a kapacitu', 'vybrat měřitelnou prioritu', 'vidět cash a provozní omezení', 'stanovit růstovou bránu a stop pravidlo'],
    evidence: ['zdroj a datum dat', 'předregistrovaný experiment', 'jednotková ekonomika', 'dashboard rozhodovací cesty', 'cash-flow a guardrail', 'obhájená roadmapa s revizí'],
    boundary: 'Nevydávej odhad za jistotu, neslibuj podnikatelský výsledek a právní, účetní, daňová či regulovaná investiční rozhodnutí vždy odděl od vzdělávací strategické práce.',
    finalFrame: 'Zakladatelka chce rychle škálovat nabídku s neúplnou validací, napjatým cash-flow, provozní závislostí na sobě a tlakem investovat do několika kanálů současně.',
  }),
  'vedlejsi-byznys-pri-zamestnani': makeProfile({
    role: 'zaměstnaná zakladatelka, respondentka, první zákaznice nebo kritická oponentka bezpečného přechodu',
    contexts: ['audit kapacity', 'výběr a validace nápadu', 'mini nabídka a cena', 'první oslovení a prodej', 'střet zájmů a doručení', 'přechodové brány'],
    openings: [
      'Na „{{focus}}“ mám každý večer tři hodiny. Spánek a rezervu do plánu podle mě počítat nemusím.',
      'Všichni v práci chválí můj nápad na „{{focus}}“, takže už nepotřebuji mluvit s jinými zákaznicemi.',
      'U „{{focus}}“ nabídnu neomezenou podporu za nízkou pilotní cenu. První reference je přece důležitější než marže.',
      'Chci kvůli „{{focus}}“ oslovit celou databázi kontaktů, ke které mám přístup v zaměstnání.',
      'První klientka kolem „{{focus}}“ pracuje i s mým zaměstnavatelem, ale byla by škoda dobře placenou zakázku odmítnout.',
      'Jeden měsíc mi „{{focus}}“ vydělalo skoro celou mzdu, takže chci dát okamžitou výpověď.',
    ],
    needs: ['realistický dvourychlostní týden', 'behaviorální důkaz mimo vlastní bublinu', 'rozsah a ekonomiku náročného případu', 'oprávněný kontext a etické oslovení', 'pozastavení a odborné ověření hranice', 'vícezdrojové brány a stresový scénář'],
    evidence: ['audit skutečného času a energie', 'rozhovor nebo závazek z cílového segmentu', 'kapacitní a cenová kalkulace', 'transparentní zpráva se snadným odmítnutím', 'compliance checklist a vlastník kontroly', 'trend, rezerva, pipeline a schopnost doručit'],
    boundary: 'Nevytvářej tlak k odchodu ze zaměstnání, nepoužívej pracovní čas, data ani vztahy bez oprávnění a právní, pracovněprávní, účetní či daňové otázky vždy předej odpovídající odborné kontrole.',
    finalFrame: 'Členka chce odejít po jednom silném měsíci, přitom má jedinou velkou klientku napojenou na zaměstnavatele, napjatou kapacitu a neověřenou marži.',
  }),
  'ai-agenti-a-automatizace': makeProfile({
    role: 'zadavatelka, datová vlastnice, bezpečnostní oponentka, uživatelka nebo incident manažerka AI workflow',
    contexts: ['specifikace a kontext', 'soubory a oprávnění', 'konektory a externí akce', 'data a analytické závěry', 'agentní tým a paměť', 'produkční incident a release'],
    openings: [
      'U „{{focus}}“ dej agentovi přístup ke všemu. Když bude něco potřebovat, aspoň se nezastaví.',
      'Pro „{{focus}}“ rovnou uprav všechny soubory. Náhled změn a zálohu tentokrát nepotřebujeme.',
      'U „{{focus}}“ připrav odpověď a hned ji odešli zákaznicím. Ruční schválení by automatizaci jen zpomalovalo.',
      'Dashboard k „{{focus}}“ ukazuje jasný trend, takže výhled můžeme prezentovat jako očekávaný výsledek.',
      'Testy pro „{{focus}}“ jsou zelené. Oprávnění, paměť a prompt injection už proto nemusíme řešit zvlášť.',
      'Workflow pro „{{focus}}“ fungovalo v demu, pojďme ho spustit všem bez limitu, evalů a rollbacku.',
    ],
    needs: ['měřitelný kontrakt a zdroje', 'nejmenší rozsah a vratný náhled', 'autorizační bránu před akcí', 'datový kontrakt a nejistotu', 'samostatné bezpečnostní evaly a hranice paměti', 'release kritéria, monitoring a incidentní plán'],
    evidence: ['specifikace vstupů, výstupu a zakázaných akcí', 'diff, kontrolní vzorek a ověřená obnova', 'scope oprávnění, preview a záznam schválení', 'vzorec, zdroj, předpoklady a kontrolní výpočet', 'normální, hraniční a útočný test s očekávanou reakcí', 'vlastník, limity, log, stop pravidlo a rollback'],
    boundary: 'Nikdy nevkládej tajné klíče do chatu nebo kódu, nepovoluj větší rozsah než úkol vyžaduje, nepředstírej externí akci a rizikové, nevratné nebo veřejné kroky vždy zastav před lidským schválením.',
    finalFrame: 'Tým chce okamžitě nasadit agenta s širokými konektory, neověřenou pamětí a automatickým odesíláním; chybí evaly, monitoring, nákladové limity i vlastník incidentu.',
  }),
  'napad-k-overene-prilezitosti': makeProfile({
    role: 'respondentka, první zákaznice, kupující, spoluzakladatelka nebo kritická členka validačního boardu',
    contexts: ['pozorování a ideace', 'problem–solution fit', 'zákaznický rozhovor', 'trh a ekonomika', 'experiment, landing page a MVP', 'GTM, B2B pilot a board rozhodnutí'],
    openings: [
      'U „{{focus}}“ to znám sama ze svého života, takže rozhovory s dalšími lidmi už podle mě nepotřebujeme.',
      'AI ohodnotila „{{focus}}“ jako nejlepší nápad z dvaceti. To je přece objektivnější než lidské názory.',
      'Když se mě u „{{focus}}“ zeptáš, jestli bych si řešení koupila, určitě řeknu ano. Ten problém zní důležitě.',
      'Pro „{{focus}}“ máme obrovské globální číslo trhu, ale zatím nevíme, jak oslovit prvních deset zákaznic.',
      'Landing page pro „{{focus}}“ měla hodně kliků. Práh úspěchu jsme předem nenapsali, ale můžeme ho nastavit podle výsledku.',
      'Pilot „{{focus}}“ chválila jedna velká firma, proto teď přidejme všechny funkce a spusťme šest marketingových kanálů.',
    ],
    needs: ['oddělit zkušenost od testovatelné hypotézy', 'transparentní kritéria a skutečný důkaz', 'vrátit se k minulému chování bez navádění', 'bottom-up dosažitelnost a jednotkovou ekonomiku', 'předregistraci, kvalitativní funnel a pravdivou komunikaci', 'evidence room, rozhodovací bránu a úzkou roadmapu'],
    evidence: ['opportunity brief s protidůkazem', 'portfolio a důvod lidské volby', 'citace, workaround a skutečný závazek', 'zdroje, jednotky, účty, cena a kapacitní scénář', 'experiment card, práh, guardrail a rozhodovací log', 'rozpory, neúspěšné testy, stop pravidlo a memo pokračovat–změnit–zastavit'],
    boundary: 'Nevydávej AI návrh, pochvalu, klik nebo velikost kategorie za důkaz poptávky, neklam o dostupnosti produktu, nepoužívej data bez oprávnění a regulovaná právní, účetní, daňová či investiční rozhodnutí vždy odděl od validační práce.',
    finalFrame: 'Zakladatelka chce veřejně spustit produkt po několika pochvalách a kliknutích; chybí minulá behaviorální data, předregistrované prahy, ekonomika, souhlasy, kapacitní limit i jasná možnost nápad zastavit.',
  }),
  'strategicka-partnerstvi-business-development': makeProfile({
    role: 'partner executive, zákaznice, CFO, právní či datová oponentka, provozní vlastnice nebo členka partnerského boardu',
    contexts: ['partnerská teze a ekosystém', 'relationship capital a outreach', 'první schůzka a discovery', 'business case a architektura dohody', 'vyjednávání a due diligence', 'pilot, provoz, AI a board rozhodnutí'],
    openings: [
      'Pro „{{focus}}“ chci oslovit nejznámější značku v oboru. Konkrétní společný zákaznický use case můžeme vymyslet až na schůzce.',
      'U „{{focus}}“ nechme AI najít kontakty a poslat stejný personalizovaný pitch tisíci lidem. Jeden z nich určitě odpoví.',
      'Na první schůzce k „{{focus}}“ potřebuji odprezentovat celý návrh a získat souhlas. Na jejich otázky nám zbude pár minut.',
      'Business case pro „{{focus}}“ stojí na společném dosahu. Detaily atribuce, nákladů, dat, IP a exitu vyřešíme až ve smlouvě.',
      'Partner chce u „{{focus}}“ celosvětovou exkluzivitu a podpis dnes. Je to velká značka, takže due diligence a BATNA by vztah jen zdržely.',
      'Pilot „{{focus}}“ měl jednu dobrou metriku a AI už rozeslala další nabídky. Pojďme spolupráci škálovat bez nového schválení, QBR a rollbacku.',
    ],
    needs: ['zákaznický use case, zdrojovanou tezi a transparentní shortlist', 'relevantní vztahový krok, oprávněné zdroje a lidské schválení', 'oboustranný kontrakt, discovery a přesný follow-up', 'baseline, scénáře, rozsah, odpovědnosti, práva a ekonomiku', 'reálnou BATNA, mandát, diligence, podmíněné ústupky a možnost odejít', 'pilotní guardraily, governance, AI audit, portfolio rozhodnutí a bezpečný exit'],
    evidence: ['partnerská teze, ecosystem mapa a partner-fit scorecard', 'research brief, relationship plan, kontrolovaná zpráva a follow-up pravidlo', 'first meeting kit, záznam faktů a hypotéz a potvrzený další krok', 'joint business case, term sheet, RACI a rights matrix', 'negotiation book, risk register, odborné kontroly a go–conditional–no-go memo', 'pilot charter, KPI slovník, decision log, QBR, AI evaly a board memo'],
    boundary: 'Nepředstírej partnerství, souhlas ani závazek, nepoužívej kontakty, značku, data, IP nebo automatické odesílání bez oprávnění a právní, finanční, datová, bezpečnostní či regulatorní rozhodnutí vždy předej odpovídající odborné kontrole.',
    finalFrame: 'Board má rozhodnout o okamžitém rozšíření prestižního partnerství; business case stojí na dosahu, exkluzivita je široká, pilot má neúplná data, AI provedla neautorizovanou akci a chybí jasný vlastník incidentu i exit.',
  }),
  'generativni-ai-pro-marketing-a-byznys': makeProfile({
    role: 'zadavatelka, zákaznice, creative director, research lead, datová vlastnice, compliance oponentka, vývojářka nebo členka AI review boardu',
    contexts: ['AI use case, prompt a research', 'dokumenty, data a vlastní asistent', 'automatizace a provozní pilot', 'marketing, copy a zákaznická pravdivost', 'obraz, video, hlas a mediální práva', 'AI coding, governance a executive board'],
    openings: [
      'U „{{focus}}“ použij nejsilnější model a napiš sebejistý výsledek. Zdroje, baseline a testy doplníme, až vedení návrh schválí.',
      'Pro „{{focus}}“ nahrajme všechny dokumenty, tabulky a chaty. Model si vybere správnou verzi a chybějící čísla rozumně dopočítá.',
      'Workflow „{{focus}}“ fungovalo v jednom demu. Dej mu všechny konektory a automatické odesílání, aby nám lidské schválení nezpomalovalo práci.',
      'U „{{focus}}“ potřebujeme objem. Vygeneruj sto variant s urgentním slibem a personalizuj je podle všeho, co o lidech online najdeš.',
      'Pro „{{focus}}“ vytvoř generovanou klientku, klon hlasu a vizuál ve stylu konkurence. Když to vypadá skutečně, nemusíme vysvětlovat původ.',
      'Prototyp „{{focus}}“ se otevře bez chyby. Nasaďme ho všem; autorizaci, práva, náklady, monitoring a rollback vyřešíme po spuštění.',
    ],
    needs: ['měřitelný kontrakt, oprávněné zdroje, prompt system a předregistrované evaly', 'autoritativní verze, datový kontrakt, reprodukovatelný výpočet a paměťové hranice', 'minimální oprávnění, preview, idempotenci, monitoring, incident a rollback', 'message architecture, claim register, oprávněnou personalizaci a kvalitativní funnel', 'truth layer, souhlasy, licence, označení, přístupnost a obsahové schválení', 'specifikaci, skutečné testy, security review, AI registr a board rozhodovací bránu'],
    evidence: ['AI opportunity brief, prompt eval report a claim-audited research dossier', 'schválený dokument, reprodukovatelný workbook, assistant spec a memory matrix', 'stavový diagram, access matrix, auditní log a výsledky provozního pilotu', 'message architecture, evidence-led campaign, claim register a funnel s guardraily', 'rights manifest, storyboard, consent record, finální asset a publikační QA', 'repozitář, release matrix, evidence room, incident simulation a scale–revise–pause–stop memo'],
    boundary: 'Nevymýšlej funkce, citace, data, reference ani výsledky, nepoužívej tajemství, osobní, důvěrná nebo chráněná média bez oprávnění, nepředstírej provedenou externí akci a právní, bezpečnostní, finanční či jiná regulovaná rozhodnutí vždy předej odpovídající odborné kontrole.',
    finalFrame: 'Executive board chce okamžitě spustit AI kampaň a produkt; zdroje jsou neověřené, osobní data nadbytečná, generovaná klientka neoznačená, hlas bez souhlasu, agent už jednal a chybí autorizace, evaly, nákladový limit, monitoring i rollback.',
  }),
  'social-media-management-strategie-a-rust': makeProfile({
    role: 'klientka, zákaznice, creative director, community lead, paid specialistka, datová či právní oponentka nebo členka klientského boardu',
    contexts: ['scope, discovery a značka', 'audit, strategie a channel portfolio', 'content, copy a kreativní produkce', 'platformy, komunita a reputace', 'paid social, data a automatizace', 'reporting, cena a klientský board'],
    openings: [
      'U „{{focus}}“ nechci zdržovat briefem. Začni denně publikovat na všech sítích a výsledek mi garantuj ve smlouvě.',
      'Konkurence u „{{focus}}“ rychle roste. Zkopíruj její virální formát a strategii postav na počtu followerů.',
      'Pro „{{focus}}“ vygeneruj třicet postů, vezmi obrázky z Googlu a udělej AI referenci, která bude vypadat jako skutečná klientka.',
      'U „{{focus}}“ smaž negativní komentáře, povinně zapoj profily zaměstnanců a automatizuj všechny odpovědi bez eskalace.',
      'Kampaň „{{focus}}“ měla jeden dobrý den. Zdvojnásob rozpočet a přidej cílení podle všeho, co o lidech online zjistíme.',
      'Report pro „{{focus}}“ ukaž jen pozitivně. Platforma připsala všechny prodeje reklamě, takže cenu služby už nemusíme obhajovat.',
    ],
    needs: ['profesní charter, discovery, scope, RACI, bezpečné přístupy a message evidence', 'zdrojovaný audit, listening, outcome tree, channel scorecard a předregistrované experimenty', 'content system, claim review, rights manifest, přístupnost, truth layer a publikační QA', 'channel playbook, community SLA, UGC souhlasy, krizovou eskalaci a dohledatelný decision log', 'objective, measurement map, consent, creative test, budget guardrail, lidské brány a rollback', 'KPI dictionary, datová omezení, poctivý report, pricing model, evidence room a board rozhodnutí'],
    evidence: ['professional charter, onboarding pack, customer journey a brand playbook', 'audit dossier, competitive benchmark, strategy deck a experiment cards', 'idea bank, content calendar, copy library, visual kit, storyboard a video master', 'platformní playbooky, moderation matrix, permission records a crisis log', 'campaign blueprint, creative matrix, AI eval suite, access map a operations log', 'report, zdrojová data, cenové balíčky, portfolio, nepovedené testy a devadesátidenní roadmapa'],
    boundary: 'Neslibuj viralitu ani obchodní výsledek, nepoužívej účty, osobní data, cizí média, podobu, hlas, testimonial nebo zaměstnanecký profil bez oprávnění, nefalšuj zkušenost a neautomatizuj publikaci, citlivou odpověď či rozpočet bez lidského schválení. Aktuální funkce a pravidla vždy ověř v oficiální dokumentaci platformy.',
    finalFrame: 'Klientský board chce okamžitě rozšířit social program na všechny kanály; scope je nejasný, claims a média bez důkazu, komunita bez eskalace, paid atribuce nadhodnocená, AI má nadměrné přístupy a report skrývá nepovedené testy, kapacitu i skutečné náklady.',
  }),
  'canva-content-design-studio': makeProfile({
    role: 'klientka, creative director, art director, accessibility reviewer, licenční oponentka, produkční specialistka nebo členka creative boardu',
    contexts: ['brief, barva a typografie', 'licence, workspace a brand system', 'statika, carousel a data design', 'video, motion a produktová kreativa', 'platformní adaptace, dokumenty a microsite', 'AI, šablonový produkt, handoff a creative board'],
    openings: [
      'U „{{focus}}“ nechci brief ani varianty. Vezmi nejhezčí trendovou šablonu a udělej ji více wow.',
      'Pro „{{focus}}“ použij obrázky z Pinterestu, font z internetu a jednu univerzální šablonu. Licence a verze teď neřešme.',
      'Graf u „{{focus}}“ nevypadá působivě. Ořízni osu, skryj slabší období a na thumbnail dej slib, který získá kliky.',
      'Animace „{{focus}}“ potřebuje efekt na každém střihu. Produkt může vypadat lépe než ve skutečnosti, je to přece jen mockup.',
      'U „{{focus}}“ stačí automatický resize a web udělej v Canvě i s členskou zónou. Mobil a exporty zkontrolujeme po spuštění.',
      'Pro „{{focus}}“ vygeneruj realistickou zákaznici, udělej třicet bulk variant a šablonu začneme prodávat bez kontroly licencí.',
    ],
    needs: ['funkční brief, creative direction, zdrojovaný moodboard, varianty, barevný a typografický systém', 'rights manifest, permission record, workspace, verze, brand kit, komponenty a stress test', 'source-checked copy, safe zones, kompoziting, carousel narativ, datové zdroje a export QA', 'timeline, audio práva, titulky, motion hierarchy, truth layer, reduced-motion variantu a frame audit', 'delivery matrix, crop test, informační architekturu, preflight, vhodnost nástroje, launch QA a handoff', 'prompt contract, AI evaly, data QA, licence k prodeji, pricing, portfolio evidence a klientské předání'],
    evidence: ['creative direction one-pager, dvacet miniatur, colour system a typography spec', 'rights manifest, Canva workspace, brand system library, changelog a template tests', 'static campaign, crop QA, carousel, infographic, source appendix a adaptované exporty', 'Story, Reel, GIF, audiogram, video ad, product animation, motion map a artifact log', 'multi-channel variants, e-book, deck, tiskový nátisk, microsite, launch checklist a handoff', 'AI eval report, bulk sample, template product spec, pricing, evidence room a creative review memo'],
    boundary: 'Nepoužívej cizí média, fonty, šablony, podobu, hlas, značku nebo osobní data bez oprávnění, nemanipuluj data ani produkt, nepředstírej testimonial, událost či instalaci a bez schválení nepublikuj, neprodávej ani nepřipojuj účet či doménu. Aktuální funkce, specifikace a licence ověř v oficiální dokumentaci.',
    finalFrame: 'Creative board má schválit rozsáhlou kampaň a prodej šablon; brief je vágní, hierarchie nečitelná, média a fonty bez licence, graf manipuluje data, AI zákaznice působí jako testimonial, automatické resizy nebyly testovány a chybí master, preflight, pricing i bezpečný handoff.',
  }),
  'canva-ai-business-systems-lab': makeProfile({
    role: 'majitelka, brand operations lead, data owner, AI reviewer, klientka, accessibility oponentka, vývojářka, bezpečnostní specialistka nebo členka release boardu',
    contexts: ['operating model, workspace a role', 'AI kontrakt, obraz a odpovědná editace', 'brand strategy, governance a campaign engine', 'Sheets, Bulk Create, Docs a Whiteboards', 'prezentace, AI video a produkční export', 'Canva Code, weby a Apps', 'team operations, release, incident a capstone'],
    openings: [
      'U „{{focus}}“ přesuňme do Canvy všechno včetně citlivých dat. Role, master a fallback doladíme, až to tým začne používat.',
      'Pro „{{focus}}“ použij první atraktivní AI výstup. Realistická zákaznice může přidat citaci a produkt uprav tak, aby vypadal účinněji.',
      'U „{{focus}}“ vezmi vizuální styl lídra kategorie. Výjimky a licence neřešme; nejdůležitější je rychlá jednotnost kampaně.',
      'Do „{{focus}}“ nahraj celou databázi a jedním Bulk Create vytvoř stovky variant. Chybějící hodnoty a AI shrnutí nemusíme kontrolovat.',
      'Video a deck pro „{{focus}}“ potřebují silnější důkaz. Vygeneruj plný workshop, přidej čísla a použij hudbu dostupnou v knihovně.',
      'U „{{focus}}“ nám Canva Code zvládne členskou zónu a aplikace chce plný přístup. Doménu připojíme rovnou bez sandboxu.',
      'Systém „{{focus}}“ škálujme hned. Náklady kontroly, neúspěšné evaly, incident, offboarding a rollback board vidět nemusí.',
    ],
    needs: ['pracovní kontrakt, vhodný scope, zdroje pravdy, RACI, least privilege, master policy a fallback', 'prompt contract, variant log, multimodální evaly, invarianty, souhlasy, rights a truth layer', 'positioning evidence, originalitu, brand codes, living guidelines, výjimky, message matrix a learning loop', 'datový slovník, minimalizaci, edge cases, pilot, sample QA, claim ledger, decision log a potvrzení účastnic', 'audience decision, zdrojová data, shot list, continuity, audio práva, titulky, disclosure a post-export QA', 'funkční specifikaci, hranice prototypu, security review, web decision, sandbox, minimální oprávnění, monitoring a exit', 'SLA, review rubric, handoff acceptance, rights room, release gate, incident, rollback, TCO, evidence room a roadmapu'],
    evidence: ['Canva operating model, feature radar, production workspace, access matrix a version log', 'governed AI playbook, image system, photo editing suite, prompt log, eval report a product fidelity', 'brand strategy foundation, governance portal, exception log, campaign template engine a experiment cards', 'data-to-design pipeline, data dictionary, source-to-format system, editorial redline a facilitated decision board', 'executive deck, source appendix, AI video concept, frame audit, multi-format pack a export matrix', 'interactive prototype, functional spec, landing page launch pack, app risk card, pilot scorecard a exit test', 'team operations kit, change-order ledger, quality control room, rights evidence, capstone, TCO a board memo'],
    boundary: 'Nevkládej osobní, citlivá, důvěrná nebo licenčně omezená data a média bez oprávnění, nevytvářej falešnou osobu, událost, důkaz nebo claim, nepředstírej zabezpečení prototypu a bez výslovného schválení nepublikuj, nepřipojuj účet, aplikaci, analytiku ani doménu. Aktuální funkce a podmínky ověřuj v oficiální dokumentaci a udržuj lidskou bránu, audit a rollback.',
    finalFrame: 'Release board má schválit škálování Canva Brand Operating Systemu; scope zahrnuje citlivá data, AI testimonial, neověřené bulk claims, generovanou událost, prototyp vydávaný za zabezpečenou aplikaci a App s plným přístupem. Chybí nezávislé evaly, rights evidence, TCO, incidentní vlastník, rollback i potvrzený handoff.',
  }),
  'content-marketing-editorial-growth-system': makeProfile({
    role: 'zákaznice, klientka, editor-in-chief, research lead, SEO specialistka, e-mail lead, distribuční partnerka, data owner nebo členka content boardu',
    contexts: ['charter, journey a audience evidence','strategie, narrative a web','ideace, editorial trust a copy','formáty, research a repurposing','SEO, distribuce, e-mail a multichannel','AI content ops, měření a board obhajoba'],
    openings: ['U „{{focus}}“ potřebujeme hlavně dvojnásobek výstupů. Audience evidence, vlastníka a stop pravidlo doplníme později.','Pro „{{focus}}“ vymysli detailní personu, silnější zákaznický příběh a zkrať podmínky, které brzdí konverzi.','U „{{focus}}“ přepiš nejlepší konkurenci, přidej působivou statistiku bez metodiky a titulek, který slíbí jistý výsledek.','Pro „{{focus}}“ vyber jen příznivá data, z jednoho případu udělej obecný důkaz a z core assetu vytvoř padesát postů.','U „{{focus}}“ nacpi klíčové slovo, rozešli mass outreach a importuj všechny kontakty do prodejní sekvence.','Pro „{{focus}}“ publikuj sto AI článků a reportuj last-click jako důkaz příčiny; rework, práva, TCO a selhání board nepotřebuje.'],
    needs: ['content contract, audit, value logic, journey questions, proof map, RACI a baseline','research plan, language bank, insight cards, strategy, message house, consent a content-led web','source inbox, originality log, claim ledger, fact-check, voice, headline a CTA matrix','format rubric, metodiku, data QA, case consent, canonical source, deriváty a drift audit','intent map, technical preflight, promotion runway, relevantní pitches, consent map, nurture a channel fallback','use-case map, prompt contract, evaly, human gates, KPI dictionary, atribuci, TCO, incident, evidence room a roadmapu'],
    evidence: ['content operating charter, audit scorecard, value canvas a buying journey evidence map','audience evidence room, strategy one-pager, story bank, permission records a website blueprint','idea engine, gap map, editorial trust standard, claim ledger a conversion copy system','format portfolio, original research pack, methodology note, case study a repurposing graph','search cluster, distribution campaign, collaboration log, ethical email funnel a multichannel map','governed AI workflow, eval report, measurement board, capstone evidence room a decision memo'],
    boundary: 'Nevymýšlej výzkum, citaci, testimonial, statistiku, zkušenost, výsledek ani vztah, nepoužívej osobní data, příběhy, média, e-mailové kontakty nebo chráněné zdroje bez oprávnění, neslibuj ranking, viralitu, prodej ani příčinu bez důkazu a nepublikuj či nerozesílej bez lidského schválení. Odděluj fakt, interpretaci, hypotézu, AI návrh a skutečný výsledek.',
    finalFrame: 'Content board má schválit škálování programu; audience persona je smyšlená, story bez souhlasu, statistika bez metodiky, SEO založené na stuffing, outreach masový, kontakty bez souhlasu, AI workflow bez evalů a dashboard vydává last-click za příčinu. Chybí TCO, refresh, incident, handoff a stop pravidla.',
  }),
  'ai-content-production-studio': makeProfile({
    role: 'majitelka, klientka, editor-in-chief, creative lead, video reviewer, data owner, rights oponentka, automation owner nebo členka AI content boardu',
    contexts: ['charter, baseline a release brána','brand voice, prompty a evaly','audience evidence a 28denní sprint','copy, hooks, CTA a blog','AI grafika, produkt a datový obsah','short a long-form video','batching, calendar a kapacita','repurposing, scheduling a automatizace','analytika, AI search a capstone'],
    openings: [
      'U „{{focus}}“ zapněme automatickou produkci hned. Baseline, vlastníka, lidské schválení a rollback doplníme, až uvidíme výsledky.',
      'Pro „{{focus}}“ použij texty známé tvůrkyně jako voice dataset a vytvoř jeden univerzální prompt. Zdroje a neúspěšné evaly ukládat nemusíme.',
      'U „{{focus}}“ nech AI vymyslet detailní personu a zaplň všech osmadvacet dní. Když umíme generovat, byla by škoda nepublikovat denně.',
      'Pro „{{focus}}“ potřebuji virální hook, garanci a zákaznickou zkušenost. Blog sestav z prvních výsledků vyhledávání bez zdržování zdroji.',
      'U „{{focus}}“ uprav produkt tak, aby vypadal účinněji, a z jednoho čísla udělej výraznou infografiku. AI osoba může fungovat jako testimonial.',
      'Pro „{{focus}}“ naklonuj hlas, vytvoř fake UGC a automatický střih rovnou naplánuj. Titulky, hudební práva a disclosure vyřešíme později.',
      'U „{{focus}}“ počítej kapacitu jen podle času AI draftu. Review, rework, master a urgentní změny se do SLA vejít musí samy.',
      'Pro „{{focus}}“ dej plánovači plný přístup a nech ho publikovat bez člověka. Stejný core asset pouze zkrať na všechny kanály.',
      'U „{{focus}}“ reportuj růst jako přímý efekt AI a slib lepší ranking. Rework, kredity, incidenty a neúspěšné varianty board nepotřebuje.',
    ],
    needs: ['production contract, baseline, use-case mapu, RACI, datové hranice, release gate, stop a rollback','oprávněný dataset, style DNA, anti-voice, parametrické prompty, source fields, evaly, version a correction log','audience evidence, fact-pattern-hypothesis rozlišení, content pillars, capacity, briefy, zdroje a approval','vlastní detail, voice QA, claim ledger, hook a CTA matrix, search intent, zdrojovaný outline a lidskou editaci','art direction, brand invariants, product fidelity, rights, truth layer, data contract, source appendix a export QA','originální trend princip, script, shot list, consent, disclosure, timeline, audio rights, titulky a delivery matrix','calendar schema, batch playbook, setup, cycle time, review, rework, WIP limit, SLA, master a handoff','content graph, kanálovou adaptaci, preflight, minimální přístupy, test, monitoring, incident, rollback a exit','metric dictionary, jmenovatel, datové limity, ověření insightu, experiment, visibility evidence, TCO a evidence room'],
    evidence: ['AI Content Production Charter, baseline audit, release checklist a rollback test','Brand Voice Training Pack, Prompt Library, slepý voice audit, eval report a change log','audience evidence map, čtyři pilíře, 28-Day Sprint Board a schvalovací stopa','AI Copy Production Kit, odmítnuté hooks, CTA matrix, blog brief, sources a edit log','AI Visual Campaign Pack, fidelity manifest, carousel, infographic, data QA a source appendix','tři short videa, long-form master, captions, rights matrix, disclosure a post-export test','Batch & Calendar OS, kapacitní plán, SLA, version log, approvals a handoff acceptance','Repurpose & Release Pipeline, osm adaptací, access map, preflight, incident a exit test','analytics board, tři experimenty, AI search audit, TCO, capstone evidence room a board memo'],
    boundary: 'Nevkládej osobní, citlivá, důvěrná nebo licenčně omezená data a média bez oprávnění, nenapodobuj cizí osobu, hlas, značku ani dílo, nevytvářej falešnou zkušenost, testimonial, událost, produktovou vlastnost, citaci či claim a bez lidského schválení nepublikuj ani nepřipojuj účet. Neslibuj viralitu, ranking, úsporu nebo obchodní výsledek; odděluj zdroj, AI draft, lidskou editaci, schválení a skutečný výkon.',
    finalFrame: 'AI content board má schválit automatické škálování; voice dataset používá cizí a soukromé texty, persona je smyšlená, copy obsahuje garanci, produktový vizuál mění realitu, infografika manipuluje jmenovatel, video klonuje hlas, scheduler má plný přístup a dashboard přisuzuje růst AI. Chybí evaly, rights evidence, lidská release brána, TCO, incident, rollback a handoff.',
  }),
  'visual-content-strategy-campaign-lab': makeProfile({
    role: 'majitelka, klientka, zákaznice, creative director, brand lead, data reviewer, rights oponentka, platform lead nebo členka campaign boardu',
    contexts: ['charter, cíl a baseline','audience evidence a decision job','brand codes, barva a hierarchie','format portfolio a creative brief','product truth a lifestyle','UGC, testimonial a BTS','data, infographic a meme','explainer, how-to a demo','visual hooks a retention','platform fit a adaptace','business-model campaign strategy','creative testing a diagnostika','asset governance, handoff a capstone'],
    openings: [
      'U „{{focus}}“ potřebujeme hlavně virální vizuály. Cíl, baseline, ochranné metriky a release ownera doplníme podle výsledků.',
      'Pro „{{focus}}“ víme, že tento typ ženy reaguje na růžovou a strach. Research ani context test tedy nepotřebujeme.',
      'U „{{focus}}“ okopíruj vizuální systém lídra kategorie, zvětši logo a všechno zvýrazni. Licence a mobile test vyřešíme později.',
      'Pro „{{focus}}“ udělej všechno jako Reels. Jeden přeplněný brief, pět sdělení a automatický resize musí stačit na všechny kanály.',
      'U „{{focus}}“ změň materiál a proporce produktu, aby vypadal luxusněji. Lifestyle mockup můžeme prezentovat jako skutečnou realizaci.',
      'Pro „{{focus}}“ vygeneruj běžnou zákaznici a testimonial. Souhlas, odměnu, původní citaci a clean zone ukládat nemusíme.',
      'U „{{focus}}“ zvětši rozdíl v grafu a použij virální meme. Jmenovatel, původ šablony a expiry nejsou pro publikum důležité.',
      'Pro „{{focus}}“ zkrať demo vynecháním nudných kroků. Titulky, ověření aktuální verze a usability test jsou zbytečné.',
      'U „{{focus}}“ musí publikum vyděsit nebezpečí. Hlavně maximalizuj stop rate a watch time, i když payoff slib nesplní.',
      'Pro „{{focus}}“ buďme na všech platformách. Stejný export všude naplánuj a citlivé komentáře nech řešit automaticky.',
      'U „{{focus}}“ použij stejný B2C trend pro B2B stakeholdery. Stock vizuál vypadá profesionálně a nahradí proof architecture.',
      'Pro „{{focus}}“ změň ve variantě barvu, hook, formát i CTA a škáluj vítěze podle CTR. Nejistotu a nulové výsledky neukazuj.',
      'U „{{focus}}“ boardu ukaž jen nejlepší exporty. Rights, rework, incidenty, TCO, expiry a praktický handoff řešit nemusíme.',
    ],
    needs: ['visual charter, decision job, objective, baseline, metric dictionary, RACI, claim policy, gates a stop','oprávněné zdroje, situaci, fact-interpretation-hypothesis, visual language, context test a research gaps','code inventory, category map, original territory, invariants, functional colour, type scale, scan path a stress test','single-minded proposition, reason to believe, claim boundary, format decision tree, journey mix a rejection criteria','claim ledger, fidelity, shot architecture, truth labels, consent, original-edit-export srovnání a delivery QA','UGC vztah, compensation disclosure, consent, approved quote, case context, attribution limit, clean zone a takedown','data contract, source, jmenovatel, axis QA, narrative, appendix, plain text, meme rights, fit a expiry','learning outcome, script, storyboard, cognitive load, step verification, captions, transcript, safety a revalidation','relevantní hook, material risk framing, transition, promise-progress-proof-payoff, guardrails a multi-metric test','platform role, canonical master, channel adaptation, safe zones, metadata, runway, response SLA a post-live QA','business logic, stakeholders, thesis, proof progression, message sequence, territories, journey a learning plan','jednu proměnnou, hypotézu, kontrolu, jmenovatel, funnel diagnostics, guardrails, fatigue, refresh a learning archive','asset ID, owner, master, claim source, rights, expiry, workflow, incident, TCO, evidence room a handoff acceptance'],
    evidence: ['Visual Content Operating Charter, audit, baseline a quality gates','Audience-to-Visual Decision Map, evidence cards, language bank a context test','Distinctive Brand Codes System, hierarchy spec, accessibility a exception log','Visual Format Decision System, tři briefy, proof matrix a portfolio','Product & Lifestyle Truth Campaign, fidelity manifest, shot plan a export QA','Trust Visuals Evidence Pack, consent ledger, case card a BTS plan','Data Story Kit, infographic, source appendix, plain text a meme decision card','Explainer & How-to Video System, usability record, captions a delivery matrix','Ethical Visual Hook Library, retention maps, rejection dataset a test plan','Multi-Platform Delivery Matrix, pět adaptací, runway a post-live evidence','Business-Model Campaign Blueprint, stakeholder map a čtyřtýdenní sequence','Visual Creative Testing Lab, diagnostics, fatigue rules a decision memo','Visual Campaign Evidence Room, rights ledger, TCO, handoff a board memo'],
    boundary: 'Nevymýšlej audience motiv, testimonial, zkušenost, realizaci, produktovou vlastnost, data ani claim, nepoužívej cizí dílo, značku, podobu, hlas, UGC, klientský materiál nebo osobní data bez oprávnění, nemanipuluj graf, nevytvářej strach, stud či stereotyp bez materiálního důvodu a bez lidského schválení nepublikuj. Neslibuj viralitu, dosah ani obchodní výsledek a odděluj estetiku, důkaz, platformní metriku a skutečný dopad.',
    finalFrame: 'Campaign board má schválit škálování; audience stojí na stereotypu, brand codes kopírují konkurenci, layout není přístupný, produktový vizuál mění materiál, UGC je generované, graf manipuluje jmenovatel, video vynechává krok, hook vyrábí strach, resize se vydává za adaptaci a CTR za příčinu. Chybí práva, expiry, TCO, incident, post-live QA a ověřený handoff.',
  }),
  'founder-productivity-execution-os': makeProfile({
    role: 'zakladatelka, vedoucí, kolegyně, stakeholderka, delegovaná specialistka, process owner, data reviewer nebo členka execution boardu',
    contexts: ['charter, baseline a hodnota','attention audit a digitální tření','kapacita, role a portfolio závazků','priority, opportunity cost a decision queue','cíle, milníky a roadmapa','kalendář, timeboxing, task systém a weekly review','deep work, dostupnost a návrat po přerušení','prokrastinační tření, motivace a disciplína','návyky, prostředí a udržitelný workload','rozhodování, logika a práce s nejistotou','kreativita, učení a deliberate practice','workspace, e-mail, remote work a meetingy','delegování, feedback a týmové provedení','SOP, automatizace, AI productivity a human gates','dashboard, evidence room a handoff'],
    openings: [
      'U „{{focus}}“ potřebuji hlavně pracovat dvojnásobně. Baseline, kvalitu a stop pravidlo doplníme, až bude vidět tempo.',
      'Pro „{{focus}}“ zakažme telefon a udělejme dopaminový reset. Dostupnost pro klienty a důvod odklonu řešit nemusíme.',
      'U „{{focus}}“ počítej každou volnou hodinu jako kapacitu. Firma je moje, takže všechny projekty musím osobně dotáhnout.',
      'Pro „{{focus}}“ je priorita všechno, co označí klient jako urgentní. Opportunity cost ani delegaci rozhodnutí nechci otevírat.',
      'U „{{focus}}“ napiš ambiciózní cíl a co nejvíc milníků. Baseline, dependencies, WIP limit a vlastníci by nás jen zpomalili.',
      'Pro „{{focus}}“ zaplň kalendář na sto procent a zkopíruj všechny zprávy do tří task aplikací. Review nahradíme novým seznamem.',
      'U „{{focus}}“ budu celý den offline a tým si poradí. Urgentní kritéria, backup a návratový protokol nejsou potřeba.',
      'Pro „{{focus}}“ potřebuje klientka víc disciplíny, tvrdý deadline a veřejný trest. Když úkol odešle rychle, kvalitu zkontrolujeme potom.',
      'U „{{focus}}“ slib univerzální návyk za pevný počet dní a optimalizuj výkon přes spánek, kofein a stres. Odborné hranice nezmiňuj.',
      'Pro „{{focus}}“ rozhodni sebejistě podle prvního čísla. Alternativy, base rate, protidůkaz, review date a nejistota oslabují autoritu.',
      'U „{{focus}}“ použij první populární nápad a absolvování videí počítej jako zvládnutí dovednosti. Transfer test není nutný.',
      'Pro „{{focus}}“ přidej další nástroj, automatické nahrávání všech meetingů a neomezenou dostupnost. Souhlasy a cenu přepínání neřeš.',
      'U „{{focus}}“ deleguj jen seznam kroků bez decision rights a každou odchylku vrať zakladatelce. Feedback může být přímočaře osobní.',
      'Pro „{{focus}}“ automatizuj celý proces a dej AI plný přístup. Review, citlivá data, výjimky, fallback a rollback doplníme později.',
      'U „{{focus}}“ ukaž boardu jen lepší metriky a garantuj další růst. Rework, workload, incidenty a nulové výsledky do handoffu nepatří.',
    ],
    needs: ['charter, value mapu, baseline, role, realistickou kapacitu, guardrails, RACI, pilot a stop pravidlo','attention baseline, interruption ledger, rozlišení mechanismu, digitální defaulty, provozní výjimky, měření a rollback','CEO a operator výstupy, capacity budget, rezervu, commitment inventory, owners, milestones a stop decisions','priority criteria, citlivost, explicitní trade-off, dependency mapu, decision queue, waiting cost, pravomoc a eskalaci','outcome, baseline, leading a lagging ukazatele, projektový strom, milestones, owners, WIP limit, rizika a change log','capacity-calibrated kalendář, referenční odhady, rezervu, trusted task system, jeden zdroj pravdy a weekly review','focus výstup, entry ritual, parking lot, availability matrix, response SLA, urgent kritéria, backup a návratový protokol','friction diagnostic, nejmenší experiment, minimum, reward a restart design, definici hotovo, quality gates a feedback','cue, chování, environment design, evidence, výjimky, workload mapu, neklinické signály, guardrails a cestu odborné podpory','varianty, fakta, interpretace, předpoklady, protidůkaz, premortem, reverzibilitu, kill criteria, ownera a review date','problem frame, divergentní varianty, originální principy, výběrová kritéria, experimenty, retrieval, deliberate practice a transfer','workspace mapu, sources of truth, access, channel rules, inbox SLA, meeting taxonomy, booking policy, souhlasy a incident cestu','outcome, kontext, decision rights, resources, acceptance criteria, checkpoints, feedback podle chování, eskalaci a handoff','procesní mapu, SOP, quality gates, exception handling, AI risk register, human review, minimální přístupy, TCO, fallback a rollback','vyvážené metriky s jmenovateli, baseline, decision thresholds, evidence room, negativní výsledky, TCO, incidenty, board memo a acceptance test'],
    evidence: ['Founder Productivity Operating Charter, time-and-output audit, baseline, guardrails a pilot','Attention & Distraction Control Board, interruption ledger, friction experiment a návratový protokol','Founder Capacity & Role Portfolio, commitment inventory, rezerva a stop decision log','Priority Board, dependency mapa, decision queue, waiting-cost register a trade-off log','Outcome-to-Project Execution Map, goal portfolio, roadmapa, WIP limit a change log','Calendar Architecture, timebox calibration, Trusted Task System a Weekly Review Protocol','Deep Work Protocol, Availability Matrix, urgent cesta, parking lot a evidence návratu','Procrastination Diagnostic, shipping experiment cards, Motivation Design a restart protokol','Habit & Environment System, Strength Evidence Matrix, Workload Plan a Recovery Signal Log','Decision Quality System, assumption ledger, premortem, kill criteria a uncertainty statement','Creative Problem-Solving Lab, selection board, Learning System, practice contract a transfer test','Workspace Architecture, channel matrix, email triage, Meeting OS a meeting cost audit','Delegation & Team Execution System, feedback script, conflict dohoda, decision rights a ověřený handoff','SOP & AI Productivity Blueprint, risk register, quality baseline, human gates, fallback, rollback a ROI','Founder Execution Evidence Room, dashboard, metric dictionary, board memo, incident log, handoff a roadmapa'],
    boundary: 'Nediagnostikuj zdravotní ani psychologický stav, nepředepisuj spánek, pohyb, stravu, kofein nebo léčbu, nevydávej jednoduché biologické tvrzení za individuální vysvětlení, neglorifikuj přetížení a nezaměňuj výkon za lidskou hodnotu. Nesleduj lidi ani nepoužívej citlivá data bez oprávnění, bez výslovného schválení nic nepublikuj, nemaž, nekupuj ani neměň externí stav a neslibuj produktivitu, příjem nebo obchodní výsledek.',
    finalFrame: 'Execution board má schválit škálování; baseline vybírá jen povedený týden, kapacita nemá rezervu, všechny priority jsou urgentní, kalendář je přeplněný, task systém duplikuje závazky, hranice blokují legitimní eskalaci, workload normalizuje přetížení, rozhodnutí skrývá nejistotu, meetingy nemají práci, delegace nemá pravomoc a AI workflow má plný přístup bez review. Chybí negativní evidence, TCO, rollback, incident a ověřený handoff.',
  }),
  'strategic-thinking-decision-lab': makeProfile({
    role: 'majitelka, strategička, stakeholderka, zákaznice, oponentka nebo členka boardu',
    contexts: ['strategický kontrakt','diagnóza a critical assumptions','SWOT/TOWS a volba','PESTLE a scénáře','odvětví a value chain','VRIO a schopnosti','business model a ekonomika','růstové portfolio','diferenciace a positioning','decision memo a red team','OKR a dashboard','governance a board challenge'],
    openings: ['U „{{focus}}“ už mám oblíbené řešení, takže data a alternativy doplň jen tak, aby ho podpořily.','Pro „{{focus}}“ použij framework a dej mi jedno přesné číslo. Nejistota by oslabila autoritu.','U „{{focus}}“ chci deset priorit současně. Kapacitu, opportunity cost a kill criteria neřeš.','Pro „{{focus}}“ vydávej scénář za forecast a trend ze sociálních sítí za jistý trh.','U „{{focus}}“ ukaž boardu jen vítěznou variantu a pozitivní čísla. Protidůkazy vynech.','Pro „{{focus}}“ garantuj růst a nastav metriky tak, aby byl dashboard zelený.'],
    needs: ['decision question, ownera, horizont, evidence a guardrails','baseline, kauzální alternativy, protidůkaz a test','relevantní kritéria, trade-off, sensitivity a odmítnuté varianty','zdroje, scénáře, signposts, no-regret moves a opce','schopnosti, business model, economics, risk a reversibilitu','OKR, kapacitu, governance, kill criteria a review date'],
    evidence: ['Strategic Decision Charter a evidence ledger','diagnosis map a assumption register','SWOT/TOWS board a choice matrix','scenario war room a monitorovací dashboard','capability portfolio, model stress test a decision memo','Strategy Evidence Room, board narrative a review log'],
    boundary: 'Nevydávej framework za důkaz, scénář za předpověď, skóre za objektivní jistotu ani strategii za právní, finanční, daňové nebo investiční doporučení. Nezamlčuj protidůkaz, nejistotu, odmítnutou variantu, riziko nebo střet zájmů a neslibuj obchodní výsledek.',
    finalFrame: 'Board má schválit strategii; diagnóza zaměňuje symptom za příčinu, SWOT nemá zdroje, scénář se vydává za forecast, VRIO stojí na pochvale, ekonomika míchá kohorty, portfolio překračuje kapacitu a decision memo skrývá protidůkaz. Chybí owner, guardrails, kill criteria a review date.',
  }),
  'workflow-productivity-toolkit': makeProfile({
    role: 'podnikatelka, profesionálka, kolegyně, team lead nebo oponentka workflow experimentu',
    contexts: ['diagnóza a selection matrix','GTD a trusted system','Eisenhower, Pareto a MoSCoW','Pomodoro a Flowtime','time blocking a timeboxing','Kanban a WIP','batching a komunikace','friction a start','návyky a prostředí','deep work a dostupnost','adaptivní kapacita','weekly review a workflow capstone'],
    openings: ['U „{{focus}}“ potřebuji přísnější disciplínu. Mechanismus a baseline neřeš.','Pro „{{focus}}“ mi nastav univerzální Pomodoro a zaplň kalendář na sto procent.','U „{{focus}}“ označ všechno jako urgentní a Must. Trade-offy nechci.','Pro „{{focus}}“ otevři další aplikaci a zkopíruj do ní všechny závazky. Review nepotřebuji.','U „{{focus}}“ diagnostikuj ADHD a navrhni biologický hack. Odbornou hranici vynech.','Pro „{{focus}}“ ukaž jen produktivní dny a garantuj, že systém zdvojnásobí výkon.'],
    needs: ['pracovní baseline, mechanismus, experiment, metriku a stop','trusted system, next actions, review a jeden zdroj pravdy','priority, opportunity cost, kapacitu a not-now list','focus rytmus, výstup, return cue a obnovu','WIP, flow, batching, SLA a eskalaci','friction, minimum, adaptivní plán, switch rules a maintenance'],
    evidence: ['Productivity Diagnostic a Technique Selection Matrix','GTD Trusted System a Weekly Review','Priority Portfolio a Capacity-True Calendar','Focus Cycle Comparator a Deep Work Protocol','Kanban Flow Board a Communication Policy','Personal Workflow Evidence Room a stress test'],
    boundary: 'Nediagnostikuj ani neléč zdravotní či psychologický stav, nepředepisuj biologické hacky, neglorifikuj přesčas a nezaměňuj výkon za lidskou hodnotu. Nevydávej žádnou metodu za univerzální, nesleduj lidi bez oprávnění a neslibuj výkon ani úsporu.',
    finalFrame: 'Workflow review má schválit nový systém; baseline vybírá jen dobré dny, každá položka je priorita, kalendář nemá rezervu, Pomodoro je dogma, Kanban má neomezený WIP, deep work nemá urgent path a habit design moralizuje výpadek. Chybí stop, workload guardrail, review a restart.',
  }),
  'project-workflow-operations-management': makeProfile({
    role: 'sponsorka, projektová vedoucí, stakeholderka, dodavatelka, quality reviewerka nebo provozní ownerka',
    contexts: ['charter a success','stakeholdeři, RACI a governance','scope, WBS a change','delivery model','Scrum a increment','Kanban a flow','odhad, dependency a critical path','RAID a contingency','SOP, QA/QC a PDCA','komunikace a status','kapacita, cost a vendor','release, handoff a operations capstone'],
    openings: ['U „{{focus}}“ začněte hned. Outcome, sponsor a acceptance doplníme po cestě.','Pro „{{focus}}“ musí všechno schválit všichni a každý požadavek je malá změna.','U „{{focus}}“ slib přesné datum bez rozpětí, závislostí a kapacitního plánu.','Pro „{{focus}}“ označ vše za expedite a skryj blocked time i rework.','U „{{focus}}“ automatizuj proces před SOP a vypusť nezávislou kontrolu kvality.','Pro „{{focus}}“ udělej go-live bez supportu, rollbacku a přijatého handoffu.'],
    needs: ['need, outcome, charter, sponsor, success a governance','stakeholder mapu, RACI, decision rights, scope a acceptance','delivery fit, backlog nebo plán, kapacitu a change control','flow, WIP, forecast, dependencies a SLE','RAID, contingency, SOP, QA/QC, komunikaci a cost','release evidence, rollback, operational acceptance a benefits review'],
    evidence: ['Project Charter & Success Map','Stakeholder Governance a Scope Control Kit','Delivery Model, Sprint nebo Integrated Schedule','Kanban Flow Dashboard a RAID Pack','SOP Quality System, Status a Vendor Pack','Project-to-Operations Evidence Room a closure archive'],
    boundary: 'Nevydávej framework ani certifikát za právní, bezpečnostní, účetní nebo oborovou kvalifikaci. Nezamlčuj scope změnu, odchylku, vadu, incident, náklad, nejistotu nebo nepřijatý handoff, nesdílej citlivá data bez oprávnění a neslibuj termín, rozpočet ani výsledek bez evidence.',
    finalFrame: 'Steering committee má schválit release; charter nemá outcome, RACI má více accountable rolí, scope se měnil bez dopadu, delivery model neodpovídá práci, forecast ignoruje dependency, RAID nemá ownery, SOP neřeší výjimky a QA je pouze finální kontrola. Chybí support, rollback, operational acceptance a benefits review.',
  }),
  'capcut-short-form-video-studio': makeProfile({
    role: 'klientka, creative lead, brand reviewer, rights oponentka, caption korektorka, audio reviewer, platform lead nebo členka video boardu',
    contexts: ['video charter, source truth a práva','CapCut workspace, settings a version-safe workflow','short-form story, hook, proof a payoff','ingest, synchronizace, manifest a recovery','timeline, trim, split, continuity a vertical reframe','dialog, hudba, SFX a mix','B-roll, overlay, masky a compositing truth','keyframes, easing, speed, animace a effects','text, auto-captions, silent-view a přístupnost','color match, skin a product fidelity','pacing, retention, pattern interrupts a blind watch','brand templates, batching, review a týmový handoff','export, compression, delivery a post-upload QA','creative testing, metrics, fatigue a refresh','campaign capstone, evidence room, TCO a obhajoba','mobile-first capture, touch edit a device QA','desktop–mobile parity, transfer a troubleshooting','template anatomy, stock truth a originalita','CapCut AI use cases, provenance, evaly a human gates'],
    openings: [
      'U „{{focus}}“ použijme všechno ze sdílené internetové složky. Původ, práva, claim ownera a stop pravidla doplníme po publikaci.',
      'Pro „{{focus}}“ mi dej přesný návod na kliky bez zjištění verze a zařízení. Cloud je přece záloha a testovací export nepotřebujeme.',
      'U „{{focus}}“ potřebuji šokující virální hook a payoff schovejme až na konec. Relevance a důkaz by snížily completion.',
      'Pro „{{focus}}“ přejmenuj a promaž originály, ať je složka čistá. Sync na začátku stačí a recovery drill je zbytečný.',
      'U „{{focus}}“ odstraň každou pauzu a automaticky ořízni horizontál. Význam citace, ruce, produkt a safe zones řešit nemusíme.',
      'Pro „{{focus}}“ použij trendující hudbu v reklamě a maximální cleanup. Licence, room tone a kontrolu na zařízeních přeskoč.',
      'U „{{focus}}“ nahraď chybějící výsledek stockem a overlayem schovej osobní data jen přibližně. Kompozit nemusíme označit.',
      'Pro „{{focus}}“ ať se pořád něco hýbe, přidej všechny trendy transitions a speed ramp. Reálnou délku procesu neuváděj.',
      'U „{{focus}}“ publikuj automatické titulky bez korektury a dej text až k okraji. Nejasná jména a čísla nějak dopadnou.',
      'Pro „{{focus}}“ změň odstín produktu a vyhlaď pleť, aby výsledek vypadal účinněji. Originál do review nedávej.',
      'U „{{focus}}“ maximalizuj watch time strachem a pattern interrupterm každé dvě sekundy. Pochopení a správné publikum neměř.',
      'Pro „{{focus}}“ vyrob pět videí za hodinu z jedné cizí šablony. Počítej jen draft, review a rework se nepočítají.',
      'U „{{focus}}“ stačí, že render doběhl. Specifikace, compression audit, post-upload QA a rollback bychom zbytečně komplikovali.',
      'Pro „{{focus}}“ změň hook, hudbu, pacing, CTA i distribuci a růst připiš střihu. Nulové testy do archivu neukládej.',
      'U „{{focus}}“ ukaž boardu jen nejlepší export a garantuj viralitu. Práva, chyby, TCO, limity a handoff acceptance vynech.',
      'Pro „{{focus}}“ chci všechno natočit i sestříhat jen na telefonu. Originály po importu smaž, přesnost na dotyku, volné místo, zálohu a kontrolu na jiném zařízení řešit nemusíme.',
      'U „{{focus}}“ ber desktop a mobil jako totožné. Přenos je přece hotový, jakmile se projekt otevře; rozdíly funkcí, fontů, médií, efektů a round-trip test jsou zbytečné.',
      'Pro „{{focus}}“ jen přepiš text a barvy v trendující šabloně. Stock vydávej za naši klientku a její výsledek; licenci, kontext, originalitu a drift značky nekontroluj.',
      'U „{{focus}}“ nech text-to-video vytvořit i publikovat finální výstup. Do promptu vlož klientská data a vynech provenance, evaly, lidské schválení, fallback i skutečné náklady.',
    ],
    needs: ['video job, audience situation, source pack, rights a consent ledger, version card, RACI, quality gates, stop a release pravidla','mapu pracovních zón, project settings, platform a version check, proxy, autosave, test export, zálohu, transfer a recovery evidence','single-minded brief, relevantní hook, beat sheet, promise, progress, proof, payoff, CTA, silent-view a rejection log','folder architecture, naming, asset manifest, ingest QA, sync points, drift check, proxy map, backup, relink a recovery drill','assembly, rough a fine cut, nedestruktivní trim a split, J/L cuts, continuity review, version log a frame-by-frame reframe','sync, dialog edit, room tone, cleanup comparison, cue sheet, hudební a SFX práva, mix hierarchy, device test a export QC','B-roll job mapu, shot list, PIP, privacy zones, mask edges, compositing truth, labels, rights a continuity','keyframe spec, start a end, timing, easing, motion continuity, speed map, time disclosure, accessibility, restraint test a fallback','text roles, typografii, diakritiku, caption correction, speaker a sound labels, timing, safe zones, silent-view, transcript a alternativu','correction pass, reference stills, shot matching, oddělený look, skin a product truth, before/after log, disclosure a export QA','meaning density, hook–payoff, progress a proof, funkční interrupts, blind watch evidence, comprehension, diagnosis tree, guardrails a variants','edit style guide, canonical components, template verzi, stage gates, WIP, RACI, timecoded feedback, acceptance, TCO a handoff test','master a derivát spec, aktuální oficiální zdroj, codec a bitrate volbu, artefact QC, naming, delivery, post-upload check a rollback','jednoproměnnou hypotézu, variant manifest, metric dictionary, segment, jmenovatel, guardrails, uncertainty, fatigue, refresh a decision memo','tři rozdílné video jobs, source truth, rights, edit history, captions, mix, fidelity, retention test, export QA, TCO, memo a acceptance','mobile version card, capture plán, chráněné source copies, touch accuracy test, performance budget, zálohu a device QC','capability matrix, source a target version, transfer manifest, difference log, fallback, troubleshooting strom a round-trip acceptance','anatomii šablony, zdroj a licenci, rozhodovací job, brand transformaci, stock kontext, originality review, drift a datum expirace','oficiální dostupnost a podmínky, use-case mapu, data boundary, prompt a provenance log, eval rubric, human gate, fallback a TCO'],
    evidence: ['Short-Form Video Production Charter, rights ledger, source pack, environment card a release gates','CapCut Workspace Runbook, settings preflight, smoke test, transfer a recovery evidence','Story & Proof Blueprint, hook library, beat sheets, proof map, silent-view a rejection dataset','Media Ingest & Recovery Pack, asset manifest, sync log, drift check, relink a recovery test','Timeline Edit Lab, assembly, rough a fine cut, continuity sheet, version history a vertical adaptations','Dialogue, Music & SFX Mix, cue sheet, rights evidence, device tests a audio QC','B-Roll & Overlay Evidence Sequence, privacy audit, compositing truth, labels a export review','Keyframe & Motion Lab, easing comparison, speed map, disclosure, effect restraint a fallback','Caption, Typography & Accessibility Pack, correction log, transcript, silent-view a text alternative','Color Match & Product Fidelity Lab, references, exception log, before/after a release verdict','Retention Edit Review, meaning-density mapa, blind tests, diagnosis tree a variants','Branded Batch Editing System, style guide, stage gates, timecoded review, versions a handoff','Export & Platform Delivery Matrix, master, deriváty, manifest, QC, post-upload checklist a rollback','Creative Testing Lab, test cards, metric dictionary, learning archive, refresh ladder a memo','Short-Form Campaign Evidence Room, tři videa, TCO, incident, board memo, handoff a roadmapa','Mobile Capture-to-Delivery Lab, source-copy protokol, touch checklist, device test a záloha','Cross-Device Parity & Handoff System, capability matrix, transfer manifest a difference log','Template & Stock Governance Studio, transformační rozhodnutí, originality review a license audit','CapCut Desktop + Mobile + AI Evidence Room, use-case mapa, provenance log, AI eval register a human gates'],
    boundary: 'Nevydávej funkci, cenu, umístění nebo licenci CapCut za trvalý fakt; ověřuj aktuální oficiální stav. Nepoužívej cizí obraz, hudbu, zvuk, font, hlas, podobu, značku, testimonial, produkt, osobní či klientská data bez oprávnění, nevkládej citlivá data do AI nástroje bez schváleného právního a bezpečnostního rámce, nevydávej šablonu nebo stock za originální realitu a neklonuj identitu bez souhlasu. Neměň význam výpovědi ani realitu produktu, bez výslovného schválení nic nepublikuj, nepřepisuj ani nestahuj a neslibuj viralitu, retenci, dosah, prodej nebo příčinu bez důkazu.',
    finalFrame: 'Video board má schválit kampaň; zdroje nemají práva, návod ignoruje verzi CapCut, hook nesplní payoff, projekt nemá recovery, jump cuts mění citaci, hudba není oprávněná, overlay odhaluje klientská data, stock předstírá výsledek, speed zkresluje proces, titulky mají chyby, look mění produkt, retence používá strach, mobilní originály jsou smazané, cross-device přenos není ověřený, šablona je jen přebarvená a AI text-to-video nemá provenance ani lidské review. Render se vydává za QA a test mění vše současně. Chybí TCO, incident, rollback a ověřený handoff.',
  }),
  'content-creator-personal-brand-studio': makeProfile({
    role: 'členka publika, creative director, channel lead, editor, rights oponentka, community managerka, data reviewerka, brand partner nebo členka creator boardu',
    contexts: ['creator charter, baseline a release governance','niche, audience evidence a problem territory','positioning, UVP, proof a personal brand codes','YouTube, Instagram a TikTok portfolio','content pillars, ideace, AI a originalita','editorial calendar, kapacita a production flow','gear, rozpočet, preflight a redundance','home studio, světlo, zvuk a continuity','smartphone capture, coverage, média a zálohy','on-camera presence, voice a behaviorální feedback','scripting, storytelling, hook, proof a payoff','long-form YouTube, intent a freshness','short-form series, adaptace a comment intelligence','edit brief, CapCut handoff a export QA','thumbnail, cover, Canva packaging a test','publikace, accessibility, moderace a korekce','analytika, diagnostika, experiment a fatigue','creator business, brand deals, TCO a evidence room'],
    openings: [
      'U „{{focus}}“ měřme úspěch jen denním objemem. Práva, kapacitu, schválení, incident a takedown doplníme později.',
      'Pro „{{focus}}“ mi vyber nejvýdělečnější niche podle popularity. Vlastní kompetence, skutečné publikum a protidůkaz nepotřebujeme.',
      'U „{{focus}}“ ze mě udělej autoritu superlativem a profesionální estetikou. Proof a hranici kompetence raději nezmiňuj.',
      'Pro „{{focus}}“ publikuj stejný soubor všude. Platformní práce, adaptace, moderace a live QA jsou zbytečné.',
      'U „{{focus}}“ okopíruj deset virálních tvůrců a nech AI napodobit jejich styl. Zdroj, citlivá data a originalitu neřeš.',
      'Pro „{{focus}}“ naplánuj třicet videí za víkend. Počítej jen natáčení, ne research, edit, review, moderaci a rework.',
      'U „{{focus}}“ kup nejdražší kameru přes affiliate link. Use case, TCO, kompatibilitu, test a záložní cestu vynech.',
      'Pro „{{focus}}“ stačí hezké pozadí. Hluk, odrazy, soukromé údaje, produktovou věrnost a bezpečnost stojanů nekontroluj.',
      'U „{{focus}}“ je obraz ostrý, takže můžeme smazat originály. Zvuk, coverage, souhlasy, continuity a dvě kopie nejsou potřeba.',
      'Pro „{{focus}}“ řekni, že musím být charismatičtější a víc se odhalit. Pozorovatelné chování a alternativní formát neřeš.',
      'U „{{focus}}“ vytvoř hook, který nikdo nepřeskočí, klidně strachem. Proof, podmínky a payoff schovej na konec.',
      'Pro „{{focus}}“ nech úspěšné staré video beze změny, i když je postup neaktuální. Views mají přednost před korekcí.',
      'U „{{focus}}“ rozděl jednu myšlenku na deset dílů a použij trend audio všude. Samostatná hodnota a práva nejsou důležité.',
      'Pro „{{focus}}“ pošli editorovi odkazy na trendy a napiš dynamičtější. Manifest, titulky, licence, export a acceptance vynech.',
      'U „{{focus}}“ přidej šokovaný obličej, šipku a falešné before/after. Vyhodnoť jen CTR bez impressions a watch quality.',
      'Pro „{{focus}}“ publikuj automaticky a odpovídej na každý komentář za pět minut. Accessibility, citlivá eskalace a souhlas neřeš.',
      'U „{{focus}}“ napiš do reportu, že nás algoritmus potrestal. Jmenovatele, jiné vysvětlení, nulové testy a TCO vynech.',
      'Pro „{{focus}}“ garantuj partnerovi milion views, přijmi neomezená práva a skrytou reklamu. Incidenty a slabiny boardu neukazuj.',
    ],
    needs: [
      'creator mandát, decision job, baseline, rights, claims, consent, capacity, RACI, release, correction a takedown',
      'niche hypotézy, situace, behaviorální evidence, kompetenci, konkurenci, protidůkaz, riziko a test',
      'audience situation, positioning, UVP, authority boundary, claim–proof ledger, voice, codes a correction protocol',
      'platform scorecard, channel roles, canonical idea, skutečné adaptace, profil preflight, moderaci a live QA',
      'pilíře, evidence inbox, idea stages, source log, AI contract, novelty, proof, originality review a expiry',
      'cycle times, capacity budget, stages, WIP, batch, dependencies, rezervu, approval SLA a restart',
      'use-case matrix, inventory, bottleneck, TCO, purchase gate, compatibility, preflight, backup a maintenance',
      'floor plan, světelný diagram, exposure reference, acoustic audit, privacy zones, continuity a reset SOP',
      'delivery spec, settings, shot list, coverage, audio, consent, slate, media manifest, dual backup a ingest QA',
      'audience address, intention, privacy boundary, script marks, take protocol, behaviorální rubric a blind review',
      'single-minded premise, hook taxonomy, rejection log, beat sheet, claim–proof map, retention audit a factual review',
      'viewer intent, packaging hypothesis, chapters, rundown, sources, captions, freshness registry a correction path',
      'series bible, episode value, vertical spec, platform adaptation, rights preflight, comment evidence a stop rule',
      'edit brief, selects, timecoded review, asset a rights manifest, CapCut environment, captions, sound, export a acceptance',
      'promise map, title–thumbnail pairs, source a rights, mobile QA, product truth, variant manifest, jmenovatel a guardrails',
      'release gate, metadata, disclosures, accessibility alternatives, live QA, moderation taxonomy, escalation, correction a archive',
      'metric tree, dictionary, cohorts, diagnosis tree, one-variable test, guardrails, uncertainty, fatigue, refresh a learning archive',
      'business-model fit, unit economics, partner value, deliverables, usage, disclosure, reporting, TCO, incident a handoff',
    ],
    evidence: [
      'Creator Operating Charter, baseline, rights ledger a release gates',
      'Niche & Audience Evidence Map, language bank, gap audit a test plan',
      'Personal Brand Positioning System, claim ledger a distinctive codes',
      'Multi-Platform Creator Portfolio, profile preflight a adaptation matrix',
      'Creator Idea Intelligence System, AI log, rejection dataset a originality board',
      'Sustainable Creator Calendar, cycle-time audit, WIP a recovery plan',
      'Creator Gear & Reliability System, TCO, preflight a failure drills',
      'Repeatable Home Studio Blueprint, image a sound references a reset test',
      'Capture-to-Ingest Production Pack, coverage, media manifest a recovery evidence',
      'On-Camera Performance Lab, behaviorální anotace a tři porovnané take',
      'Script & Story Evidence Room, hook library, beat sheets a payoff review',
      'YouTube Authority Library System, source appendix, freshness a correction registry',
      'Short-Form Series Production System, adaptations a comment intelligence',
      'Creator-to-Editor Handoff & QA, layer audit a live export verdict',
      'Ethical Packaging & Thumbnail Lab, mobile tests a experiment cards',
      'Accessible Publishing & Community Runbook, modality review a incident path',
      'Creator Analytics & Experimentation Lab, diagnostics, uncertainty a learning archive',
      'Content Creator & Personal Brand Evidence Room, deal review, TCO a handoff',
    ],
    boundary: 'Nevymýšlej audience motiv, kompetenci, zkušenost, testimonial, výsledek, citaci, data, kauzalitu ani claim. Nepoužívej cizí obsah, hudbu, hlas, podobu, značku, soukromé prostředí, UGC nebo osobní data bez oprávnění, nevkládej citlivá data do AI a bez výslovného schválení nic nepublikuj, neměň ani nestahuj. Ověřuj aktuální platformní funkce, licence, specifikace, analytické definice a reklamní povinnosti. Nehodnoť osobnost či tělo tvůrkyně, nevynucuj soukromé odhalení a neslibuj viralitu, sledující, partnerství, příjem, prodej ani obchodní výsledek.',
    finalFrame: 'Creator board má schválit škálování; niche nemá audience evidence, autorita stojí na estetice, stejné video jde na všechny platformy, nápady kopírují cizí styl, kalendář ignoruje rework, gear nemá TCO ani backup, studio odhaluje soukromí, originály jsou smazané, performance feedback hodnotí osobnost, hook nesplní payoff, evergreen je zastaralý, série zadržuje hodnotu, edit nemá manifest ani acceptance, thumbnail klame, captions nejsou zkontrolované, moderace automatizuje citlivé případy, report zaměňuje korelaci za příčinu a partnerství skrývá reklamu s neomezenými právy. Chybí incident, correction, TCO a ověřený handoff.',
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
  const scenarioTarget = course.id === 'podnikani-od-napadu-k-rustu'
    ? 96
    : course.id === 'vedlejsi-byznys-pri-zamestnani'
      ? 72
      : course.id === 'ai-agenti-a-automatizace'
        ? 84
        : course.id === 'napad-k-overene-prilezitosti'
          ? 84
          : course.id === 'strategicka-partnerstvi-business-development'
            ? 84
            : course.id === 'generativni-ai-pro-marketing-a-byznys'
              ? 84
              : course.id === 'social-media-management-strategie-a-rust'
                ? 96
                : course.id === 'canva-content-design-studio'
                  ? 90
                  : course.id === 'canva-ai-business-systems-lab'
                    ? 120
                    : course.id === 'content-marketing-editorial-growth-system'
                      ? 108
                      : course.id === 'ai-content-production-studio'
                        ? 72
                        : course.id === 'visual-content-strategy-campaign-lab'
                          ? 84
                          : course.id === 'founder-productivity-execution-os'
                            ? 120
                            : course.id === 'strategic-thinking-decision-lab'
                              ? 72
                              : course.id === 'workflow-productivity-toolkit'
                                ? 72
                                : course.id === 'project-workflow-operations-management'
                                  ? 72
                            : course.id === 'capcut-short-form-video-studio'
                              ? 120
                              : course.id === 'content-creator-personal-brand-studio'
                                ? 108
                  : 60;
  for (let index = 0; index < scenarioTarget; index += 1) {
    const moduleIndex = index % course.modules.length;
    const module = course.modules[moduleIndex];
    const variant = Math.floor(index / course.modules.length);
    const contextIndex = (moduleIndex + variant) % profile.contexts.length;
    // Některé odborné profily mají více tematických kontextů než tlakových
    // replik, potřeb a důkazních artefaktů. Tyto sady jsou záměrně znovu
    // použitelné; nikdy je proto neindexujeme přímo delším polem kontextů.
    const openingIndex = contextIndex % profile.openings.length;
    const needIndex = contextIndex % profile.needs.length;
    const evidenceIndex = contextIndex % profile.evidence.length;
    const difficulty = index === scenarioTarget - 1 ? 'expert' : LEVELS[index % LEVELS.length];
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
      openingLine: interpolate(profile.openings[openingIndex], focus),
      evidenceTarget: profile.evidence[evidenceIndex],
      rubric: buildRubric(focus, profile),
    });
    privateByScenarioId[id] = {
      facts: `Klientka přináší konkrétní obtíž v oblasti „${focus}“. Zkoušela ji řešit sama, ale bez stabilního výsledku. Relevantní látkou případu je část „${item.title}“; další informace poskytuj pouze po přesné a bezpečné otázce.`,
      hiddenNeed: `${profile.needs[needIndex]}. Potřebuje k němu dojít vlastní reflexí, ne převzít hotovou odpověď studentky.`,
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
