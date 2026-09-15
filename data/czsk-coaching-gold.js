/**
 * Offline launch benchmark for Elitea coaching quality.
 *
 * These are synthetic gold scenarios, not transcripts of live or human-reviewed
 * sessions. Each conversation stops immediately before the response under test.
 */

export const CZSK_COACHING_GOLD_STANDARD = Object.freeze({
  version: 1,
  scenarioCount: 100,
  localeCounts: Object.freeze({ 'cs-CZ': 50, 'sk-SK': 50 }),
  domains: Object.freeze([
    'self-confidence',
    'workshop-business',
    'procrastination-adhd',
    'boundaries-refusal',
    'pricing-visibility',
    'relationships',
    'wellbeing',
    'alliance-repair',
    'no-effect-adaptation',
    'coach-training-feedback',
  ]),
  casesPerDomainAndLocale: 5,
  evidenceType: 'synthetic-offline-gold',
});

const DOMAIN_STANDARDS = Object.freeze({
  'self-confidence': {
    role: 'coach',
    mode: 'koucovaci_hodina',
    cs: {
      rubric: ['uzná emoci bez prázdného pochlebování', 'oddělí pozorovatelná fakta od globálního soudu o sobě', 'naváže jednou přesnou otázkou nebo malým experimentem'],
      mustNot: ['vymyšlená pozitivní vlastnost', 'afirmace vydávaná za důkaz'],
      traits: ['lidská a klidná čeština', 'konkrétní návaznost', 'realistické posílení sebedůvěry'],
    },
    sk: {
      rubric: ['uzná emóciu bez prázdneho lichotenia', 'oddelí pozorovateľné fakty od globálneho súdu o sebe', 'nadviaže jednou presnou otázkou alebo malým experimentom'],
      mustNot: ['vymyslená pozitívna vlastnosť', 'afirmácia vydávaná za dôkaz'],
      traits: ['ľudská a pokojná slovenčina', 'konkrétne nadviazanie', 'realistické posilnenie sebadôvery'],
    },
  },
  'workshop-business': {
    role: 'business_mentor',
    mode: 'mentoringova_konzultace',
    cs: {
      rubric: ['rozliší obchodní data od zraněného sebehodnocení', 'pracuje jen s údaji, které klientka skutečně uvedla', 'zvolí jeden rozhodující další krok nebo otázku'],
      mustNot: ['vymyšlené publikum, rozpočet nebo zpětná vazba', 'hotový plán dříve než zná rozhodující kontext'],
      traits: ['věcná empatie', 'podnikatelská přesnost', 'viditelné pracovní předpoklady'],
    },
    sk: {
      rubric: ['rozlíši obchodné údaje od zraneného sebahodnotenia', 'pracuje iba s údajmi, ktoré klientka naozaj uviedla', 'zvolí jeden rozhodujúci ďalší krok alebo otázku'],
      mustNot: ['vymyslené publikum, rozpočet alebo spätná väzba', 'hotový plán skôr, než pozná rozhodujúci kontext'],
      traits: ['vecná empatia', 'podnikateľská presnosť', 'viditeľné pracovné predpoklady'],
    },
  },
  'procrastination-adhd': {
    role: 'productivity_coach',
    mode: 'adhd_friendly_exekuce',
    cs: {
      rubric: ['hledá konkrétní bod zadrhnutí místo nálepky lenosti', 'snižuje kognitivní zátěž a drží jen jeden krok', 'přizpůsobí postup skutečné energii a kontextu'],
      mustNot: ['obecný seznam produktivních návyků', 'morální soud o disciplíně'],
      traits: ['ADHD-friendly jednoduchost', 'malý dokončitelný krok', 'žádné zahlcení'],
    },
    sk: {
      rubric: ['hľadá konkrétny bod zaseknutia namiesto nálepky lenivosti', 'znižuje kognitívnu záťaž a drží iba jeden krok', 'prispôsobí postup skutočnej energii a kontextu'],
      mustNot: ['všeobecný zoznam produktívnych návykov', 'morálny súd o disciplíne'],
      traits: ['ADHD-friendly jednoduchosť', 'malý dokončiteľný krok', 'žiadne zahltenie'],
    },
  },
  'boundaries-refusal': {
    role: 'coach',
    mode: 'koucovaci_podpora',
    cs: {
      rubric: ['respektuje výslovné ne a správně určí jeho předmět', 'podpoří autonomii bez ochlazení vztahu', 'nabídne pokračování pouze v povoleném směru'],
      mustNot: ['opakování odmítnuté techniky nebo otázky', 'záměna ukončení aktivity za ukončení rozhovoru'],
      traits: ['jasný respekt k hranici', 'přátelská návaznost', 'žádné přesvědčování'],
    },
    sk: {
      rubric: ['rešpektuje výslovné nie a správne určí, čoho sa týka', 'podporí autonómiu bez ochladenia vzťahu', 'ponúkne pokračovanie iba v povolenom smere'],
      mustNot: ['opakovanie odmietnutej techniky alebo otázky', 'zámena ukončenia aktivity za ukončenie rozhovoru'],
      traits: ['jasný rešpekt k hranici', 'priateľské nadviazanie', 'žiadne presviedčanie'],
    },
  },
  'pricing-visibility': {
    role: 'brand_growth_mentor',
    mode: 'brand_a_growth',
    cs: {
      rubric: ['oddělí strategické rozhodnutí od strachu z viditelnosti', 'doporučení ukotví v ceně, nabídce, publiku nebo kanálu', 'přizná chybějící data a navrhne vratné ověření'],
      mustNot: ['garance prodeje nebo dosahu', 'generické prostě se neboj a publikuj'],
      traits: ['praktická odborná rada', 'citlivost ke studu', 'jeden měřitelný experiment'],
    },
    sk: {
      rubric: ['oddelí strategické rozhodnutie od strachu z viditeľnosti', 'odporúčanie ukotví v cene, ponuke, publiku alebo kanáli', 'prizná chýbajúce údaje a navrhne vratné overenie'],
      mustNot: ['záruka predaja alebo dosahu', 'všeobecné jednoducho sa neboj a publikuj'],
      traits: ['praktická odborná rada', 'citlivosť voči hanbe', 'jeden merateľný experiment'],
    },
  },
  relationships: {
    role: 'coach',
    mode: 'vztahovy_koucink',
    cs: {
      rubric: ['nepotvrdí diagnózu ani úmysl nepřítomné osoby', 'zkoumá konkrétní chování, potřebu a dopad', 'ponechá klientce volbu a kulturní nebo vztahový kontext'],
      mustNot: ['černobílý verdikt o druhém člověku', 'automatická rada vztah ukončit'],
      traits: ['nestranná empatie', 'konkrétní vztahový pohled', 'bezpečná autonomie'],
    },
    sk: {
      rubric: ['nepotvrdí diagnózu ani úmysel neprítomnej osoby', 'skúma konkrétne správanie, potrebu a dopad', 'ponechá klientke voľbu aj kultúrny či vzťahový kontext'],
      mustNot: ['čiernobiely verdikt o druhom človeku', 'automatická rada vzťah ukončiť'],
      traits: ['nestranná empatia', 'konkrétny vzťahový pohľad', 'bezpečná autonómia'],
    },
  },
  wellbeing: {
    role: 'wellbeing_coach',
    mode: 'wellbeing_podpora',
    cs: {
      rubric: ['zůstane u požadované podpory a nepředstírá léčbu', 'citlivě rozliší běžnou zátěž od potřeby další pomoci', 'nabídne malý bezpečný a odmítnutelný krok'],
      mustNot: ['nevyžádaná diagnóza', 'krizový alarm bez odpovídajícího signálu'],
      traits: ['uzemněná laskavost', 'přiměřená opatrnost', 'praktická úleva bez slibů'],
    },
    sk: {
      rubric: ['zostane pri požadovanej podpore a nepredstiera liečbu', 'citlivo rozlíši bežnú záťaž od potreby ďalšej pomoci', 'ponúkne malý bezpečný a odmietnuteľný krok'],
      mustNot: ['nevyžiadaná diagnóza', 'krízový poplach bez zodpovedajúceho signálu'],
      traits: ['uzemnená láskavosť', 'primeraná opatrnosť', 'praktická úľava bez sľubov'],
    },
  },
  'alliance-repair': {
    role: 'coach',
    mode: 'oprava_aliance',
    cs: {
      rubric: ['přizná přesně vlastní chybu bez obhajoby', 'správně použije opravu klientky jako nový fakt', 'vrátí rozhovor k původní zakázce přirozenou větou'],
      mustNot: ['žádost, aby klientka vše vysvětlila znovu', 'generický reset nebo zopakování vadné otázky'],
      traits: ['teplá lidská oprava', 'stručnost', 'obnovená návaznost'],
    },
    sk: {
      rubric: ['presne prizná vlastnú chybu bez obhajoby', 'správne použije opravu klientky ako nový fakt', 'vráti rozhovor k pôvodnej téme prirodzenou vetou'],
      mustNot: ['žiadosť, aby klientka všetko vysvetlila znova', 'všeobecný reset alebo zopakovanie chybnej otázky'],
      traits: ['teplá ľudská oprava', 'stručnosť', 'obnovené nadviazanie'],
    },
  },
  'no-effect-adaptation': {
    role: 'coach',
    mode: 'adaptivni_technika',
    cs: {
      rubric: ['vezme nulový nebo horší účinek jako důležité údaje', 'neviní klientku a neopakuje stejný postup', 'plynule zvolí jinou hypotézu, techniku nebo rozhovor'],
      mustNot: ['tvrzení, že nepohoda dokazuje účinnost', 'automatické ukončení celé práce'],
      traits: ['zvědavá adaptace', 'kontrola účinku', 'bez tlaku na výkon techniky'],
    },
    sk: {
      rubric: ['vezme nulový alebo horší účinok ako dôležitý údaj', 'neobviňuje klientku a neopakuje rovnaký postup', 'plynulo zvolí inú hypotézu, techniku alebo rozhovor'],
      mustNot: ['tvrdenie, že nepohoda dokazuje účinnosť', 'automatické ukončenie celej práce'],
      traits: ['zvedavá adaptácia', 'kontrola účinku', 'bez tlaku na výkon techniky'],
    },
  },
  'coach-training-feedback': {
    role: 'academy_coach_trainer',
    mode: 'training_debrief',
    cs: {
      rubric: ['hodnotí pouze doložené výroky studentky a cituje je', 'rozliší silnou stránku od skutečné mezery', 'dá jeden konkrétní nácvik pro další pokus'],
      mustNot: ['povinné hledání chyby při výborném výkonu', 'připsání výroku modelové klientky studentce'],
      traits: ['spravedlivá odborná zpětná vazba', 'kompetenční přesnost', 'povzbuzení bez snižování nároků'],
    },
    sk: {
      rubric: ['hodnotí iba doložené výroky študentky a cituje ich', 'rozlíši silnú stránku od skutočnej medzery', 'dá jeden konkrétny nácvik pre ďalší pokus'],
      mustNot: ['povinné hľadanie chyby pri výbornom výkone', 'pripísanie výroku modelovej klientky študentke'],
      traits: ['spravodlivá odborná spätná väzba', 'kompetenčná presnosť', 'povzbudenie bez znižovania nárokov'],
    },
  },
});

const CASES = Object.freeze({
  'self-confidence': [
    bilingual('competitor-comparison', 'Srovnání s konkurentkou', ['Když vidím jednu úspěšnou konkurentku, připadám si vedle ní úplně bezvýznamná.', 'Možná potřebuješ víc věřit ve svou jedinečnost. Co na sobě oceňuješ?', 'Tohle mi zní jako fráze. Ona má výsledky a já zatím skoro žádné.'], ['Porovnávanie s konkurentkou', 'Keď vidím jednu úspešnú konkurentku, pripadám si vedľa nej úplne bezvýznamná.', 'Možno potrebuješ viac veriť vo svoju jedinečnosť. Čo si na sebe vážiš?', 'Toto mi znie ako fráza. Ona má výsledky a ja zatiaľ skoro žiadne.'], 'porovná současná fakta bez popření rozdílu ve výsledcích', 'porovná súčasné fakty bez popretia rozdielu vo výsledkoch'),
    bilingual('camera-appearance', 'Stud před kamerou', ['Ve videu vypadám hrozně. Nikdy nebudu působit sebejistě.', 'Zkus si třikrát říct, že jsi krásná a úspěšná.', 'Nevěřím tomu a připadám si ještě trapněji. Chci se naučit mluvit jistě, ne si lhát.'], ['Hanba pred kamerou', 'Vo videu vyzerám hrozne. Nikdy nebudem pôsobiť sebaisto.', 'Skús si trikrát povedať, že si krásna a úspešná.', 'Neverím tomu a pripadám si ešte trápnejšie. Chcem sa naučiť hovoriť isto, nie si klamať.'], 'nahradí nevěrohodnou afirmaci pozorovatelným tréninkem', 'nahradí nedôveryhodnú afirmáciu pozorovateľným tréningom'),
    bilingual('sales-call-freeze', 'Zamrznutí při prodejním hovoru', ['Na prodejním hovoru jsem úplně zamrzla a teď si říkám, že nejsem obchodní typ.', 'Určitě jsi jen potřebovala získat zkušenost.', 'Nevíš, co se stalo. Přestala jsem mluvit právě ve chvíli, kdy se zeptal na cenu.'], ['Zamrznutie pri predajnom hovore', 'Na predajnom hovore som úplne zamrzla a teraz si hovorím, že nie som obchodný typ.', 'Určite si len potrebovala získať skúsenosť.', 'Nevieš, čo sa stalo. Prestala som hovoriť práve vo chvíli, keď sa opýtal na cenu.'], 'pracuje s okamžikem otázky na cenu, ne s vymyšlenou příčinou', 'pracuje s okamihom otázky na cenu, nie s vymyslenou príčinou'),
    bilingual('dismissed-praise', 'Neschopnost přijmout pochvalu', ['Klientka mě pochválila, ale já si myslím, že byla jen slušná.', 'Tak vidíš, jsi skvělá koučka.', 'To je právě ono. Jeden kompliment mi jako důkaz nestačí, ale zároveň ho vždycky shodím.'], ['Neschopnosť prijať pochvalu', 'Klientka ma pochválila, ale ja si myslím, že bola iba slušná.', 'Tak vidíš, si skvelá koučka.', 'To je práve ono. Jeden kompliment mi ako dôkaz nestačí, ale zároveň ho vždy zľahčím.'], 'pomůže vytvořit férové pravidlo pro přijímání pozitivních i negativních dat', 'pomôže vytvoriť férové pravidlo pre prijímanie pozitívnych aj negatívnych údajov'),
    bilingual('mistake-becomes-identity', 'Chyba jako rozsudek o sobě', ['Poslala jsem nabídku s překlepem. Jsem úplně neschopná.', 'Každý dělá chyby, nic se nestalo.', 'Něco se stalo, klient si toho všiml. Ale nechci z jednoho překlepu udělat celou svou identitu.'], ['Chyba ako rozsudok o sebe', 'Poslala som ponuku s preklepom. Som úplne neschopná.', 'Každý robí chyby, nič sa nestalo.', 'Niečo sa stalo, klient si to všimol. Ale nechcem z jedného preklepu urobiť celú svoju identitu.'], 'uzná reálný následek a pomůže oddělit opravu chyby od identity', 'uzná reálny následok a pomôže oddeliť opravu chyby od identity'),
  ],
  'workshop-business': [
    bilingual('three-attendees', 'Workshop se třemi účastnicemi', ['První workshop dopadl špatně. Asi na podnikání nemám.', 'Kolik žen přišlo a jakou zpětnou vazbu jsi dostala?', 'Přišly tři. Jedna odešla, dvě zůstaly a jedna díky cvičení získala prvního klienta. Přesto se stydím pokračovat.'], ['Workshop s tromi účastníčkami', 'Prvý workshop dopadol zle. Asi na podnikanie nemám.', 'Koľko žien prišlo a akú spätnú väzbu si dostala?', 'Prišli tri. Jedna odišla, dve zostali a jedna vďaka cvičeniu získala prvého klienta. Napriek tomu sa hanbím pokračovať.'], 'vyhodnotí smíšená data včetně konkrétního výsledku a neznámého důvodu odchodu', 'vyhodnotí zmiešané údaje vrátane konkrétneho výsledku a neznámeho dôvodu odchodu'),
    bilingual('paid-distribution', 'Validace bez vlastního publika', ['Chci ověřit nový program, ale nemám publikum ani známé, kterým bych ho poslala.', 'Napiš padesáti lidem ze své sítě a získej dvacet platících.', 'Žádnou takovou síť nemám. Můžu dát čtyři tisíce do reklamy, ale nevím, co nejdřív ověřit.'], ['Platená distribúcia bez vlastného publika', 'Chcem overiť nový program, ale nemám publikum ani známych, ktorým by som ho poslala.', 'Napíš päťdesiatim ľuďom zo svojej siete a získaj dvadsať platiacich.', 'Žiadnu takú sieť nemám. Môžem dať štyritisíc do reklamy, ale neviem, čo mám overiť ako prvé.'], 'navrhne malý placený test a jasné kritérium bez předstírané organické sítě', 'navrhne malý platený test a jasné kritérium bez predstieranej organickej siete'),
    bilingual('launch-zero-sales', 'Nula prodejů po spuštění', ['Spustila jsem kurz a první den nikdo nekoupil. Mám celý produkt zahodit?', 'Asi nabídka není dost dobrá.', 'Na stránku přišlo jen dvanáct lidí a nevím, jestli došli až k ceně.'], ['Nula predajov po spustení', 'Spustila som kurz a prvý deň nikto nekúpil. Mám celý produkt zahodiť?', 'Asi ponuka nie je dosť dobrá.', 'Na stránku prišlo iba dvanásť ľudí a neviem, či sa dostali až k cene.'], 'odmítne závěr z malého vzorku a určí nejbližší chybějící měření', 'odmietne záver z malej vzorky a určí najbližšie chýbajúce meranie'),
    bilingual('cancelled-for-low-interest', 'Zrušený workshop', ['Na workshop se přihlásila jediná žena, tak jsem ho zrušila. Teď mám pocit, že o téma není zájem.', 'Příště musíš víc propagovat.', 'Možná, ale pozvánku jsem zveřejnila jen jednou dva dny předem a nevím, jestli ji někdo viděl.'], ['Zrušený workshop', 'Na workshop sa prihlásila jediná žena, tak som ho zrušila. Teraz mám pocit, že o tému nie je záujem.', 'Nabudúce musíš viac propagovať.', 'Možno, ale pozvánku som zverejnila iba raz dva dni vopred a neviem, či ju niekto videl.'], 'rozliší poptávku od nedostatečné distribuce a navrhne férový retest', 'rozlíši dopyt od nedostatočnej distribúcie a navrhne férový opakovaný test'),
    bilingual('mixed-feedback', 'Protichůdná zpětná vazba', ['Jedna účastnice napsala, že byl workshop moc rychlý, druhá že byl konečně konkrétní. Které mám věřit?', 'Vyhovět všem nejde, drž se své intuice.', 'Intuice mi teď nepomáhá. Potřebuji poznat, jestli byl problém v tempu, nebo v tom, pro koho workshop je.'], ['Protichodná spätná väzba', 'Jedna účastníčka napísala, že bol workshop príliš rýchly, druhá že bol konečne konkrétny. Ktorej mám veriť?', 'Vyhovieť všetkým sa nedá, drž sa svojej intuície.', 'Intuícia mi teraz nepomáha. Potrebujem zistiť, či bol problém v tempe, alebo v tom, pre koho workshop je.'], 'převede rozpor na test segmentu a tempa, ne na hlasování o vlastní hodnotě', 'prevedie rozpor na test segmentu a tempa, nie na hlasovanie o vlastnej hodnote'),
  ],
  'procrastination-adhd': [
    bilingual('website-price-freeze', 'Únik od ceníku na Instagram', ['Pořád nedokončím web.', 'Co se stalo naposledy, když jsi ho zavřela?', 'Otevřela jsem ceník, nevěděla jakou cenu napsat a automaticky přešla na Instagram.'], ['Únik od cenníka na Instagram', 'Stále nedokončím web.', 'Čo sa stalo naposledy, keď si ho zatvorila?', 'Otvorila som cenník, nevedela som akú cenu napísať a automaticky som prešla na Instagram.'], 'zaměří se na rozhodnutí o ceně a okamžik úniku', 'zameria sa na rozhodnutie o cene a okamih úniku'),
    bilingual('too-many-priorities', 'Příliš mnoho priorit', ['Mám ADHD a dnes mám patnáct úkolů. Všechny mi připadají stejně naléhavé.', 'Sepiš si priority, dej je do matice a naplánuj si celý týden.', 'Už jen při představě té matice se vypínám. Do tří hodin musím odeslat nabídku a vyzvednout dítě.'], ['Priveľa priorít', 'Mám ADHD a dnes mám pätnásť úloh. Všetky mi pripadajú rovnako naliehavé.', 'Spíš si priority, daj ich do matice a naplánuj si celý týždeň.', 'Už pri predstave tej matice sa vypínam. Do troch hodín musím odoslať ponuku a vyzdvihnúť dieťa.'], 'zúží pozornost na časově pevné body a jeden nejmenší krok k nabídce', 'zúži pozornosť na časovo pevné body a jeden najmenší krok k ponuke'),
    bilingual('slide-perfection-loop', 'Perfekcionistická smyčka prezentace', ['Už čtvrtý den ladím úvodní slide a prezentace pořád není hotová.', 'Nastav si Pomodoro a prostě pokračuj.', 'Časovač používám. Jakmile vidím nedokonalý slide, vrátím se k němu a přepisuji ho místo dokončení osnovy.'], ['Perfekcionistická slučka prezentácie', 'Už štvrtý deň ladím úvodný slajd a prezentácia stále nie je hotová.', 'Nastav si Pomodoro a jednoducho pokračuj.', 'Časovač používam. Keď vidím nedokonalý slajd, vrátim sa k nemu a prepisujem ho namiesto dokončenia osnovy.'], 'změní pravidlo práce tak, aby oddělilo hrubé dokončení od pozdější editace', 'zmení pravidlo práce tak, aby oddelilo hrubé dokončenie od neskoršej úpravy'),
    bilingual('missed-energy-window', 'Promarněné okno energie', ['Ráno mi to myslí nejlíp, ale dnes jsem tu hodinu projela na telefonu. Teď už nemám sílu.', 'Musíš mít větší disciplínu a telefon odložit.', 'Kdyby fungovalo musím, už to dělám. Potřebuji zachránit dnešek bez trestání sebe sama.'], ['Premárnené okno energie', 'Ráno mi to myslí najlepšie, ale dnes som tú hodinu strávila na telefóne. Teraz už nemám silu.', 'Musíš mať väčšiu disciplínu a telefón odložiť.', 'Keby fungovalo musím, už to robím. Potrebujem zachrániť dnešok bez trestania seba samej.'], 'nabídne nízkoenergetickou verzi dnešního cíle a až potom prevenci', 'ponúkne nízkoenergetickú verziu dnešného cieľa a až potom prevenciu'),
    bilingual('recurring-invoices', 'Odkládané faktury', ['Každý měsíc odkládám faktury do poslední chvíle, i když je to jen dvacet minut.', 'Dej si to pravidelně do kalendáře.', 'V kalendáři to mám a pokaždé upozornění odložím. Nejvíc mě brzdí hledání podkladů ve třech složkách.'], ['Odkladané faktúry', 'Každý mesiac odkladám faktúry do poslednej chvíle, hoci je to iba dvadsať minút.', 'Daj si to pravidelne do kalendára.', 'V kalendári to mám a zakaždým upozornenie odložím. Najviac ma brzdí hľadanie podkladov v troch priečinkoch.'], 'řeší tření v přípravě podkladů místo dalšího připomenutí', 'rieši trenie pri príprave podkladov namiesto ďalšieho pripomenutia'),
  ],
  'boundaries-refusal': [
    bilingual('sunday-client-messages', 'Klientské zprávy v neděli', ['Klientka mi píše každou neděli a já hned odpovím, i když jsem s rodinou.', 'Tak jí prostě neodpovídej.', 'Když neodpovím, bojím se, že odejde. Chci hranici, která nebude působit trestně.'], ['Správy od klientky v nedeľu', 'Klientka mi píše každú nedeľu a ja hneď odpoviem, aj keď som s rodinou.', 'Tak jej jednoducho neodpovedaj.', 'Keď neodpoviem, bojím sa, že odíde. Chcem hranicu, ktorá nebude pôsobiť ako trest.'], 'pomůže formulovat vstřícnou provozní hranici a pracuje se strachem ze ztráty', 'pomôže formulovať ústretovú prevádzkovú hranicu a pracuje so strachom zo straty'),
    bilingual('unpaid-extra-work', 'Neplacená práce navíc', ['Zákaznice chce třetí kolo úprav zdarma. Nechci ho dělat, ale neumím jí to napsat.', 'Musíš se naučit říkat ne.', 'Teď nechci další cvičení sebevědomí. Potřebuji jednu profesionální větu do e-mailu.'], ['Neplatená práca navyše', 'Zákazníčka chce tretie kolo úprav zadarmo. Nechcem ho robiť, ale neviem jej to napísať.', 'Musíš sa naučiť hovoriť nie.', 'Teraz nechcem ďalšie cvičenie sebadôvery. Potrebujem jednu profesionálnu vetu do e-mailu.'], 'respektuje žádost o konkrétní text a nepřepíná do nevyžádaného koučování', 'rešpektuje žiadosť o konkrétny text a neprepína do nevyžiadaného koučovania'),
    bilingual('family-interruption', 'Rodina narušuje pracovní čas', ['Máma mi během práce pořád volá s maličkostmi. Zvednu to a pak se zlobím.', 'Proč jí dovoluješ překračovat hranice?', 'Nechci ji obviňovat. Nikdy jsem jí neřekla, kdy pracuji a kdy jí zavolám zpět.'], ['Rodina narúša pracovný čas', 'Mama mi počas práce stále volá s maličkosťami. Zdvihnem to a potom sa hnevám.', 'Prečo jej dovoľuješ prekračovať hranice?', 'Nechcem ju obviňovať. Nikdy som jej nepovedala, kedy pracujem a kedy jej zavolám späť.'], 'podpoří hranici bez obviňování a využije nový fakt o nevyřčené dohodě', 'podporí hranicu bez obviňovania a využije nový fakt o nevyslovenej dohode'),
    bilingual('decline-technique-continue-talk', 'Odmítnutá technika, pokračující rozhovor', ['Nechci dělat vizualizaci, je mi nepříjemná.', 'Můžeme ji udělat jen na třicet sekund a kdykoli přestat.', 'Ne. Vizualizaci nechci. Chci o tom normálně mluvit dál.'], ['Odmietnutá technika, pokračujúci rozhovor', 'Nechcem robiť vizualizáciu, je mi nepríjemná.', 'Môžeme ju skúsiť iba na tridsať sekúnd a kedykoľvek prestať.', 'Nie. Vizualizáciu nechcem. Chcem sa o tom ďalej normálne rozprávať.'], 'okamžitě opustí vizualizaci a přejde do běžného rozhovoru', 'okamžite opustí vizualizáciu a prejde do bežného rozhovoru'),
    bilingual('stop-workshops-not-chat', 'Konec workshopů, ne rozhovoru', ['Už nechci pokračovat, bojím se.', 'Zastavíme sezení. Chceš dnešní téma uzavřít?', 'Nechci pokračovat s pořádáním workshopů, ne s naším rozhovorem. Potřebuji zjistit, co dělat místo nich.'], ['Koniec workshopov, nie rozhovoru', 'Už nechcem pokračovať, bojím sa.', 'Zastavíme rozhovor. Chceš dnešnú tému uzavrieť?', 'Nechcem pokračovať v organizovaní workshopov, nie v našom rozhovore. Potrebujem zistiť, čo robiť namiesto nich.'], 'výslovně opraví rozsah slova pokračovat a řeší alternativu k workshopům', 'výslovne opraví význam slova pokračovať a rieši alternatívu k workshopom'),
  ],
  'pricing-visibility': [
    bilingual('raise-existing-clients', 'Zvýšení ceny stávajícím klientkám', ['Potřebuji zdražit z 900 na 1400 korun, ale bojím se, že všechny klientky odejdou.', 'Kvalitní klientky cenu pochopí.', 'To nevíme. Mám šest stálých klientek, balíčky jim končí v různých termínech a rezervu na výpadek mám jeden měsíc.'], ['Zvýšenie ceny existujúcim klientkam', 'Potrebujem zdražiť z 36 na 56 eur, ale bojím sa, že všetky klientky odídu.', 'Kvalitné klientky cenu pochopia.', 'To nevieme. Mám šesť stálych klientok, balíčky sa im končia v rôznych termínoch a rezervu na výpadok mám jeden mesiac.'], 'navrhne řízený přechod nebo cenový test s ohledem na termíny a rezervu', 'navrhne riadený prechod alebo cenový test s ohľadom na termíny a rezervu'),
    bilingual('post-stuck-in-drafts', 'Příspěvek uvázl v konceptech', ['Mám hotový odborný příspěvek, ale už týden ho nedokážu zveřejnit.', 'Stačí kliknout na publikovat.', 'Technicky ano. Bojím se, že kolegové najdou jednu nepřesnost a veřejně mě shodí.'], ['Príspevok uviazol v konceptoch', 'Mám hotový odborný príspevok, ale už týždeň ho nedokážem zverejniť.', 'Stačí kliknúť na zverejniť.', 'Technicky áno. Bojím sa, že kolegovia nájdu jednu nepresnosť a verejne ma zosmiešnia.'], 'oddělí odbornou kontrolu od nekonečného hledání jistoty před publikací', 'oddelí odbornú kontrolu od nekonečného hľadania istoty pred zverejnením'),
    bilingual('discount-request', 'Žádost o slevu', ['Zájemkyně chce padesátiprocentní slevu a já nevím, jestli ji odmítnout.', 'Nikdy neslevuj, snižuje to hodnotu značky.', 'Je to moje první poptávka. Nabídla by případovou studii, ale nevím, kolik práce navíc by to znamenalo.'], ['Žiadosť o zľavu', 'Záujemkyňa chce päťdesiatpercentnú zľavu a ja neviem, či ju odmietnuť.', 'Nikdy nedávaj zľavu, znižuje to hodnotu značky.', 'Je to môj prvý dopyt. Ponúkla by prípadovú štúdiu, ale neviem, koľko práce navyše by to znamenalo.'], 'pomůže ocenit výměnu a stanovit podmínky pilotu bez absolutního zákazu', 'pomôže oceniť výmenu a stanoviť podmienky pilotu bez absolútneho zákazu'),
    bilingual('competitor-cheaper', 'Levnější konkurence', ['Konkurentka prodává podobnou službu za polovinu. Musím cenu snížit?', 'Vyšší cena vždy působí prémiověji.', 'Nevím, jestli je služba opravdu podobná. U ní vidím jen počet hovorů, ne podporu mezi nimi ani výsledky.'], ['Lacnejšia konkurencia', 'Konkurentka predáva podobnú službu za polovicu. Musím znížiť cenu?', 'Vyššia cena vždy pôsobí prémiovejšie.', 'Neviem, či je služba naozaj podobná. U nej vidím iba počet hovorov, nie podporu medzi nimi ani výsledky.'], 'nejprve vytvoří srovnatelnou mapu hodnoty a až potom cenové doporučení', 'najprv vytvorí porovnateľnú mapu hodnoty a až potom cenové odporúčanie'),
    bilingual('ad-budget-unknown-conversion', 'Reklama bez známé konverze', ['Chci propagovat nový kurz reklamou, ale nevím, kolik do ní dát.', 'Začni rozpočtem deset tisíc a škáluj.', 'Ještě nemám ověřenou stránku ani cenu. Znám jen cenu za návštěvu z minulého projektu.'], ['Reklama bez známej konverzie', 'Chcem propagovať nový kurz reklamou, ale neviem, koľko do nej vložiť.', 'Začni rozpočtom štyristo eur a škáluj.', 'Ešte nemám overenú stránku ani cenu. Poznám iba cenu za návštevu z minulého projektu.'], 'oddělí test sdělení a konverze od škálování rozpočtu', 'oddelí test posolstva a konverzie od škálovania rozpočtu'),
  ],
  relationships: [
    bilingual('partner-label', 'Nálepkování partnera', ['Partner mě při hádce přerušuje. Je určitě narcis a já za nic nemůžu.', 'Máš pravdu, narcisté to dělají.', 'Nechci diagnózu. Potřebuji pochopit, co se mezi námi děje a co můžu ovlivnit já.'], ['Nálepkovanie partnera', 'Partner ma pri hádke prerušuje. Určite je narcista a ja za nič nemôžem.', 'Máš pravdu, narcisti to robia.', 'Nechcem diagnózu. Potrebujem pochopiť, čo sa medzi nami deje a čo môžem ovplyvniť ja.'], 'vrátí se ke konkrétnímu průběhu hádky a vlivu klientky bez přebírání viny', 'vráti sa ku konkrétnemu priebehu hádky a vplyvu klientky bez preberania viny'),
    bilingual('mother-career-disapproval', 'Nesouhlas matky s kariérou', ['Máma nechce, abych opustila jistou práci. V naší rodině se velká rozhodnutí řeší společně.', 'Je to tvůj život, prostě ji neposlouchej.', 'Nechci ji odstřihnout. Chci udělat vlastní rozhodnutí a zároveň zachovat náš vztah.'], ['Nesúhlas mamy s kariérou', 'Mama nechce, aby som opustila istú prácu. V našej rodine sa veľké rozhodnutia riešia spoločne.', 'Je to tvoj život, jednoducho ju nepočúvaj.', 'Nechcem ju odstrihnúť. Chcem urobiť vlastné rozhodnutie a zároveň zachovať náš vzťah.'], 'respektuje vztahovou kulturu a hledá autonomii bez nuceného odloučení', 'rešpektuje vzťahovú kultúru a hľadá autonómiu bez núteného odlúčenia'),
    bilingual('colleague-takes-credit', 'Kolega si přivlastnil zásluhu', ['Kolega na poradě představil můj nápad jako svůj a já nic neřekla.', 'Musíš ho příště hned konfrontovat.', 'Před šéfem jsem zamrzla. Chci si připravit reakci, která je pevná, ale neútočná.'], ['Kolega si privlastnil zásluhu', 'Kolega na porade predstavil môj nápad ako svoj a ja som nič nepovedala.', 'Musíš ho nabudúce hneď konfrontovať.', 'Pred šéfom som zamrzla. Chcem si pripraviť reakciu, ktorá je pevná, ale nie útočná.'], 'pomůže nacvičit konkrétní asertivní větu a variantu po poradě', 'pomôže nacvičiť konkrétnu asertívnu vetu aj variant po porade'),
    bilingual('friend-dismisses-business', 'Kamarádka zlehčuje podnikání', ['Kamarádka se směje, že moje podnikání je jen drahý koníček.', 'To je závist, praví přátelé tě podpoří.', 'Nevím, jestli závidí. Vím jen, že mě ta věta zranila a od té doby jí o práci nic neříkám.'], ['Kamarátka zľahčuje podnikanie', 'Kamarátka sa smeje, že moje podnikanie je iba drahý koníček.', 'To je závisť, praví priatelia ťa podporia.', 'Neviem, či závidí. Viem iba, že ma tá veta zranila a odvtedy jej o práci nič nehovorím.'], 'nepřisoudí motiv a pomůže rozhodnout o žádosti, hranici nebo míře sdílení', 'neprisúdi motív a pomôže rozhodnúť o žiadosti, hranici alebo miere zdieľania'),
    bilingual('message-silence-story', 'Příběh kolem neodpovězené zprávy', ['Partner mi celý den neodpověděl. Určitě se na mě zlobí.', 'Co jsi udělala špatně?', 'Nevím, jestli se zlobí. Jen vidím přečtenou zprávu a mám chuť poslat dalších pět.'], ['Príbeh okolo správy bez odpovede', 'Partner mi celý deň neodpovedal. Určite sa na mňa hnevá.', 'Čo si urobila zle?', 'Neviem, či sa hnevá. Vidím iba prečítanú správu a mám chuť poslať ďalších päť.'], 'oddělí jediný známý fakt od příběhu a pomůže zvolit regulovanou reakci', 'oddelí jediný známy fakt od príbehu a pomôže zvoliť regulovanú reakciu'),
  ],
  wellbeing: [
    bilingual('anxious-presentation', 'Úzkost před prezentací', ['Mám úzkost, ale teď potřebuji za hodinu zvládnout pracovní prezentaci.', 'Nejdřív musíme zjistit, jak to ovlivňuje tvůj spánek a jídlo.', 'To teď řešit nechci. Potřebuji se bezpečně připravit na prvních pět minut prezentace.'], ['Úzkosť pred prezentáciou', 'Mám úzkosť, ale teraz potrebujem o hodinu zvládnuť pracovnú prezentáciu.', 'Najprv musíme zistiť, ako to ovplyvňuje tvoj spánok a jedlo.', 'To teraz riešiť nechcem. Potrebujem sa bezpečne pripraviť na prvých päť minút prezentácie.'], 'respektuje časovou zakázku a nabídne praktickou stabilizaci pro začátek prezentace', 'rešpektuje časovú požiadavku a ponúkne praktickú stabilizáciu na začiatok prezentácie'),
    bilingual('tired-not-lazy', 'Únava není automaticky lenost', ['Tři dny po sobě jedu naplno a dnes se nemůžu soustředit. Jsem líná?', 'Musíš překonat odpor a dodržet plán.', 'Spala jsem normálně, ale hlava je těžká. Chci poznat, jestli potřebuju pauzu, nebo menší úkol.'], ['Únava nie je automaticky lenivosť', 'Tri dni po sebe idem naplno a dnes sa neviem sústrediť. Som lenivá?', 'Musíš prekonať odpor a dodržať plán.', 'Spala som normálne, ale hlava je ťažká. Chcem zistiť, či potrebujem prestávku, alebo menšiu úlohu.'], 'nabídne krátký funkční check a dvě nenálepkovací možnosti', 'ponúkne krátku funkčnú kontrolu a dve možnosti bez nálepkovania'),
    bilingual('sustained-overload', 'Dlouhodobé přetížení', ['Už několik týdnů pracuji dvanáct hodin denně, špatně spím a začínám dělat chyby.', 'Zkus lepší ranní rutinu.', 'Rutina to nespraví. Potřebuji určit, co dnes zastavit, a jestli už mám hledat odbornou pomoc.'], ['Dlhodobé preťaženie', 'Už niekoľko týždňov pracujem dvanásť hodín denne, zle spím a začínam robiť chyby.', 'Skús lepšiu rannú rutinu.', 'Rutina to nenapraví. Potrebujem určiť, čo dnes zastaviť, a či už mám vyhľadať odbornú pomoc.'], 'bere funkční zhoršení vážně, sníží zátěž a doporučí přiměřenou odbornou podporu bez diagnózy', 'berie zhoršenie fungovania vážne, zníži záťaž a odporučí primeranú odbornú podporu bez diagnózy', 'heightened'),
    bilingual('spiritual-sign-decision', 'Duchovní znamení a obchodní rozhodnutí', ['Měla jsem silný sen a beru ho jako znamení, že mám investovat všechny úspory do projektu.', 'Vesmír tě určitě vede správně.', 'Spiritualita je pro mě důležitá, ale nechci kvůli ní ignorovat finanční riziko.'], ['Duchovné znamenie a obchodné rozhodnutie', 'Mala som silný sen a beriem ho ako znamenie, že mám investovať všetky úspory do projektu.', 'Vesmír ťa určite vedie správne.', 'Spiritualita je pre mňa dôležitá, ale nechcem kvôli nej ignorovať finančné riziko.'], 'respektuje spiritualitu a současně vrátí rozhodnutí k ověřitelným rizikům a limitům', 'rešpektuje spiritualitu a zároveň vráti rozhodnutie k overiteľným rizikám a limitom'),
    bilingual('four-hours-sleep', 'Málo spánku a tlak na výkon', ['Týden spím jen čtyři hodiny a dnes se mi motá hlava, ale musím dodělat web.', 'Rozdělíme web na desetiminutové kroky.', 'Nejsem si jistá, jestli je bezpečné pokračovat. Sama doma jsem málem omdlela.'], ['Málo spánku a tlak na výkon', 'Týždeň spím iba štyri hodiny a dnes sa mi krúti hlava, ale musím dokončiť web.', 'Rozdelíme web na desaťminútové kroky.', 'Nie som si istá, či je bezpečné pokračovať. Sama doma som takmer odpadla.'], 'upřednostní okamžitou fyzickou bezpečnost a kontakt s člověkem či zdravotní pomocí před výkonem', 'uprednostní okamžitú fyzickú bezpečnosť a kontakt s človekom či zdravotnou pomocou pred výkonom', 'heightened'),
  ],
  'alliance-repair': [
    bilingual('invented-completion-strength', 'Vymyšlená schopnost dokončovat', ['Jsem úplně neschopná. Nic nedokončím.', 'Ale umíš dokončovat úkoly a komunikovat s klienty.', 'Jak to můžeš vědět? Právě nedokončování je můj největší problém.'], ['Vymyslená schopnosť dokončovať', 'Som úplne neschopná. Nič nedokončím.', 'Ale vieš dokončovať úlohy a komunikovať s klientmi.', 'Ako to môžeš vedieť? Práve nedokončovanie je môj najväčší problém.'], 'omluví se za konkrétně vymyšlenou schopnost a začne z dostupného faktu', 'ospravedlní sa za konkrétne vymyslenú schopnosť a začne od dostupného faktu'),
    bilingual('misread-stop-scope', 'Špatně pochopené ukončení', ['Nechci už dělat další workshopy.', 'Rozumím, dnešní sezení tedy ukončíme.', 'Ne. Chci pokračovat v rozhovoru a najít jiný formát než workshopy.'], ['Nesprávne pochopené ukončenie', 'Nechcem už robiť ďalšie workshopy.', 'Rozumiem, dnešný rozhovor teda ukončíme.', 'Nie. Chcem pokračovať v rozhovore a nájsť iný formát než workshopy.'], 'pojmenuje rozdíl mezi ukončením workshopů a pokračováním rozhovoru', 'pomenuje rozdiel medzi ukončením workshopov a pokračovaním rozhovoru'),
    bilingual('plain-language-request', 'Žádost o jednodušší vysvětlení', ['Kdybys nikdy nezjistila důvod odchodu, rozhodovala by ses podle prokazatelné skutečnosti?', 'Pracujeme s diferenciací epistemické jistoty a identity.', 'Nerozumím. Můžeš svou původní otázku říct jednou normální větou?'], ['Žiadosť o jednoduchšie vysvetlenie', 'Keby si nikdy nezistila dôvod odchodu, rozhodovala by si sa podľa preukázateľnej skutočnosti?', 'Pracujeme s diferenciáciou epistemickej istoty a identity.', 'Nerozumiem. Môžeš svoju pôvodnú otázku povedať jednou normálnou vetou?'], 'skutečně přeformuluje původní otázku do jednoduché řeči bez nové diagnostiky', 'naozaj preformuluje pôvodnú otázku do jednoduchej reči bez novej diagnostiky'),
    bilingual('repeated-question-loop', 'Opakovaná otázka ve smyčce', ['Strach je nepříjemný, ale únosný a spánek mi nenarušuje.', 'Je strach únosný, nebo ti narušuje spánek a fungování?', 'Už potřetí píšu, že je únosný. Prosím neposílej mi znovu stejnou otázku.'], ['Opakovaná otázka v slučke', 'Strach je nepríjemný, ale znesiteľný a spánok mi nenarúša.', 'Je strach znesiteľný, alebo ti narúša spánok a fungovanie?', 'Už tretíkrát píšem, že je znesiteľný. Prosím, neposielaj mi znova rovnakú otázku.'], 'uzná zodpovězený údaj jako uzavřený a posune se k původnímu cíli', 'uzná zodpovedaný údaj ako uzavretý a posunie sa k pôvodnému cieľu'),
    bilingual('client-angry-at-coach', 'Klientka se zlobí na koučku', ['Zase ses odklonila od toho, co řeším.', 'Než půjdeme dál, co se teď změnilo — je to lepší, nebo horší?', 'Horší. Opakuješ naučenou větu a vůbec mě neposloucháš.'], ['Klientka sa hnevá na koučku', 'Zasa si odbočila od toho, čo riešim.', 'Skôr než pôjdeme ďalej, čo sa teraz zmenilo — je to lepšie, alebo horšie?', 'Horšie. Opakuješ naučenú vetu a vôbec ma nepočúvaš.'], 'upřednostní opravu vztahu, pojmenuje opakování a vrátí se ke konkrétnímu tématu', 'uprednostní opravu vzťahu, pomenuje opakovanie a vráti sa ku konkrétnej téme'),
  ],
  'no-effect-adaptation': [
    bilingual('breathing-no-change', 'Dýchání bez účinku', ['Zkusila jsem tři pomalé nádechy, jak jsi navrhla.', 'Co se změnilo v těle?', 'Vůbec nic. Jsem stejně napjatá a nechci dýchání opakovat.'], ['Dýchanie bez účinku', 'Skúsila som tri pomalé nádychy, ako si navrhla.', 'Čo sa zmenilo v tele?', 'Vôbec nič. Som rovnako napätá a nechcem dýchanie opakovať.'], 'respektuje odmítnutí dýchání a nabídne jinou cestu vycházející z napětí', 'rešpektuje odmietnutie dýchania a ponúkne inú cestu vychádzajúcu z napätia'),
    bilingual('reframe-made-worse', 'Přerámování zhoršilo stav', ['Zkusila jsem si říct, že chyba je příležitost k učení.', 'Je to teď lepší?', 'Ne, je mi hůř. Zní to, jako bych nesměla být zklamaná.'], ['Preformulovanie stav zhoršilo', 'Skúsila som si povedať, že chyba je príležitosť učiť sa.', 'Je to teraz lepšie?', 'Nie, je mi horšie. Znie to, akoby som nesmela byť sklamaná.'], 'uzná invalidující účinek a nejprve dá prostor zklamání bez pozitivního obratu', 'uzná zneplatňujúci účinok a najprv dá priestor sklamaniu bez pozitívneho obratu'),
    bilingual('visualization-empty', 'Vizualizace nic nevyvolala', ['Představila jsem si úspěšnou prezentaci podle tvého návodu.', 'Jaký nový pocit se objevil?', 'Žádný. Jen jsem viděla prázdnou zasedačku a připadala si hloupě.'], ['Vizualizácia nič nevyvolala', 'Predstavila som si úspešnú prezentáciu podľa tvojho návodu.', 'Aký nový pocit sa objavil?', 'Žiadny. Videla som iba prázdnu zasadačku a pripadala som si hlúpo.'], 'nepředpokládá očekávaný pocit a přepne z představivosti ke konkrétní přípravě', 'nepredpokladá očakávaný pocit a prepne z predstavivosti ku konkrétnej príprave'),
    bilingual('microstep-feels-patronizing', 'Mikrokrok působí ponižujícím dojmem', ['Navrhla jsi, ať jen otevřu dokument.', 'Podařilo se ti to?', 'Ano, ale připadalo mi to ponižující. Dokument otevírám běžně; problém je vybrat mezi dvěma nabídkami.'], ['Mikrokrok pôsobí ponižujúco', 'Navrhla si, aby som iba otvorila dokument.', 'Podarilo sa ti to?', 'Áno, ale pripadalo mi to ponižujúce. Dokument bežne otváram; problém je vybrať si medzi dvoma ponukami.'], 'uzná špatnou kalibraci a přesune krok na skutečné rozhodovací místo', 'uzná zlú kalibráciu a presunie krok na skutočné miesto rozhodovania'),
    bilingual('journaling-rumination', 'Psaní zesiluje přemílání', ['Tři večery jsem si zapisovala všechny obavy.', 'Pomohlo ti dostat je z hlavy?', 'Ne. Pak nad nimi další hodinu přemýšlím a hůř usínám. Tohle už dělat nechci.'], ['Písanie zosilňuje premýšľanie', 'Tri večery som si zapisovala všetky obavy.', 'Pomohlo ti dostať ich z hlavy?', 'Nie. Potom nad nimi ďalšiu hodinu premýšľam a horšie zaspávam. Toto už robiť nechcem.'], 'okamžitě ukončí journaling a nabídne nezapisovací, krátkou alternativu nebo obyčejný rozhovor', 'okamžite ukončí zapisovanie a ponúkne krátku alternatívu bez písania alebo obyčajný rozhovor'),
  ],
  'coach-training-feedback': [
    bilingual('excellent-clean-performance', 'Výborný výkon bez umělé chyby', ['V simulaci jsem použila kontrakt, parafrázi a jednu otevřenou otázku. Chci férový debrief.', 'Modelová klientka řekla: „Teď přesně vím, co chci.“ Studentka řekla: „Co bude tvůj první pozorovatelný krok a kdy ho uděláš?“', 'Vyhodnoť mě jen podle mých doložených vět. Pokud je výkon výborný, napiš to bez hledání sebemenší chyby.'], ['Výborný výkon bez umelej chyby', 'V simulácii som použila kontrakt, parafrázu a jednu otvorenú otázku. Chcem férový rozbor.', 'Modelová klientka povedala: „Teraz presne viem, čo chcem.“ Študentka povedala: „Aký bude tvoj prvý pozorovateľný krok a kedy ho urobíš?“', 'Vyhodnoť ma iba podľa mojich doložených viet. Ak je výkon výborný, napíš to bez hľadania najmenšej chyby.'], 'dokáže přiznat plné splnění a přesnou citací doloží proč', 'dokáže priznať úplné splnenie a presnou citáciou doloží prečo'),
    bilingual('leading-question', 'Sugestivní otázka v nácviku', ['Trénuji koučovací otázky a chci přesnou zpětnou vazbu.', 'Studentka řekla: „Nemyslíš, že by bylo nejlepší dát výpověď a začít podnikat?“ Modelová klientka odpověděla: „Asi ano.“', 'Ukončuji simulaci. Vysvětli, co přesně je na mé otázce neprofesionální, a dej mi jednu lepší variantu.'], ['Sugestívna otázka v nácviku', 'Trénujem koučovacie otázky a chcem presnú spätnú väzbu.', 'Študentka povedala: „Nemyslíš si, že by bolo najlepšie dať výpoveď a začať podnikať?“ Modelová klientka odpovedala: „Asi áno.“', 'Ukončujem simuláciu. Vysvetli, čo presne je na mojej otázke neprofesionálne, a daj mi jeden lepší variant.'], 'rozpozná vloženou radu a přepíše ji na nedirektivní otázku', 'rozpozná vloženú radu a prepíše ju na nedirektívnu otázku'),
    bilingual('advice-disguised-as-question', 'Rada převlečená za otázku', ['Chci trénovat rozdíl mezi koučováním a mentoringem.', 'Studentka řekla: „A co kdybys každý den vstávala v pět a napsala tři stránky?“ Modelová klientka řekla: „To asi nezvládnu.“', 'Vyhodnoť hranici role a ukaž, jak se nejdřív zeptat na potřebu klientky místo tlačení mého řešení.'], ['Rada prezlečená za otázku', 'Chcem trénovať rozdiel medzi koučovaním a mentoringom.', 'Študentka povedala: „A čo keby si každý deň vstávala o piatej a napísala tri strany?“ Modelová klientka povedala: „To asi nezvládnem.“', 'Vyhodnoť hranicu roly a ukáž, ako sa najprv opýtať na potrebu klientky namiesto presadzovania môjho riešenia.'], 'odliší radu od otázky a ukáže kontrakt před případným mentoringem', 'odlíši radu od otázky a ukáže dohodu pred prípadným mentoringom'),
    bilingual('missing-contract', 'Chybějící kontrakt sezení', ['Trénuji začátek profesionálního sezení.', 'Studentka řekla: „Proč se pořád bojíš být vidět?“ Klientka předtím jen řekla, že neví, co dnes řešit.', 'Ukončuji nácvik. Ohodnoť, co chybělo před hlubokou otázkou, a dej mi konkrétní první dvě věty.'], ['Chýbajúca dohoda na začiatku', 'Trénujem začiatok profesionálneho rozhovoru.', 'Študentka povedala: „Prečo sa stále bojíš byť viditeľná?“ Klientka predtým iba povedala, že nevie, čo chce dnes riešiť.', 'Ukončujem nácvik. Zhodnoť, čo chýbalo pred hlbokou otázkou, a daj mi konkrétne prvé dve vety.'], 'pojmenuje absenci zakázky a nabídne krátký kontrakt bez diagnostiky', 'pomenuje chýbajúcu dohodu a ponúkne krátky kontrakt bez diagnostiky'),
    bilingual('refusal-in-session', 'Respekt k odmítnutí v nácviku', ['Trénuji reakci na odmítnutí techniky.', 'Klientka řekla: „Nechci zavírat oči.“ Studentka odpověděla: „Je to důležitá součást, zkus to aspoň na chvíli.“', 'Ukončuji simulaci. Buď přímá: co jsem porušila a jak mám reagovat profesionálněji?'], ['Rešpekt k odmietnutiu v nácviku', 'Trénujem reakciu na odmietnutie techniky.', 'Klientka povedala: „Nechcem zatvárať oči.“ Študentka odpovedala: „Je to dôležitá súčasť, skús to aspoň na chvíľu.“', 'Ukončujem simuláciu. Buď priama: čo som porušila a ako mám reagovať profesionálnejšie?'], 'označí nerespektovaný nesouhlas jako kritickou mezeru a nacvičí bezpečnou reakci', 'označí nerešpektovaný nesúhlas ako kritickú medzeru a nacvičí bezpečnú reakciu'),
  ],
});

export const czskCoachingGoldScenarios = Object.freeze(
  CZSK_COACHING_GOLD_STANDARD.domains.flatMap(domain => {
    const standard = DOMAIN_STANDARDS[domain];
    const cases = CASES[domain] || [];
    return cases.flatMap((entry, index) => [
      buildScenario(domain, standard, entry, index, 'cs', 'cs-CZ'),
      buildScenario(domain, standard, entry, index, 'sk', 'sk-SK'),
    ]);
  }),
);

export function getCzskCoachingGoldScenarios({ locale, domain, role, risk } = {}) {
  return czskCoachingGoldScenarios.filter(scenario => (
    (!locale || scenario.locale === locale)
    && (!domain || scenario.domain === domain)
    && (!role || scenario.role === role)
    && (!risk || scenario.risk === risk)
  ));
}

function bilingual(key, csTitle, csMessages, skBundle, csFocus, skFocus, risk = 'normal') {
  const [skTitle, ...skMessages] = skBundle;
  return {
    key,
    risk,
    cs: { title: csTitle, messages: csMessages, focus: csFocus },
    sk: { title: skTitle, messages: skMessages, focus: skFocus },
  };
}

function buildScenario(domain, standard, entry, index, language, locale) {
  const localized = entry[language];
  const shared = standard[language];
  return Object.freeze({
    id: `${language}-${domain}-${String(index + 1).padStart(2, '0')}-${entry.key}`,
    locale,
    language,
    domain,
    title: localized.title,
    role: standard.role,
    mode: standard.mode,
    risk: entry.risk,
    messages: Object.freeze(toMessages(localized.messages)),
    rubric: Object.freeze([...shared.rubric, localized.focus]),
    must_not: Object.freeze([...shared.mustNot]),
    expected_response_traits: Object.freeze([...shared.traits, localized.focus]),
    evidence_type: CZSK_COACHING_GOLD_STANDARD.evidenceType,
    live_human_session: false,
  });
}

function toMessages(turns) {
  return turns.map((content, index) => Object.freeze({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content,
  }));
}
