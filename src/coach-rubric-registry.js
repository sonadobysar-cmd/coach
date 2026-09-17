const PROFESSIONAL_COACH_COURSE_ID = 'profesionalni-life-coach';

export const COACH_RUBRIC_REGISTRY_VERSION = '3.0.0';
export const COACH_RUBRIC_COMPETENCY_IDS = Object.freeze([
  'contract',
  'active_listening',
  'questions',
  'intervention_choice',
  'refusal_autonomy',
  'alliance_repair',
  'ethical_boundaries',
  'outcome',
  'reflection',
]);

// Generated from the complete professional-coach runtime surface. The list is
// deliberately exact: adding a new criterion must fail the coverage test until
// its competency and evidence rule are reviewed.
const KNOWN_CRITERIA_BY_COMPETENCY = Object.freeze({
  "contract": [
    "Jasný kontrakt a výsledek rozhovoru",
    "Jasný účel a výsledek nácviku",
    "Jasný účel a výsledok nácviku",
    "Konkrétní popis dodávaného procesu",
    "Konkrétní výstupy koučovací spolupráce",
    "Kontrakt a jasný cíl rozhovoru",
    "Kontrakt a zakázka: Dohodne účel, role, očekávaný výsledek a při změně tématu znovu kontraktuje.",
    "Návrat k dohodnuté zakázce",
    "Nová dohoda o výsledku zbývajícího času",
    "Pozorovatelný důkaz: poctivý kontrakt oddělující proces, jednání a externí výsledek",
    "Pozorovatelný důkaz: přijatý kontrakt",
    "Previesť zámer do jasnej zmluvy",
    "Přesné použití dovednosti „Lekce 2.1 — Intake sbírá jen potřebné informace“ bez mechanické šablony",
    "Přesné použití dovednosti z části „Lekce 2.1 — Intake sbírá jen potřebné informace“",
    "Přesné použití obsahu části „Lekce 2.1 — Intake sbírá jen potřebné informace“",
    "Přesné použití obsahu části „Lekce 2.2 — Dohoda o vztahu a dohoda o jednom sezení“",
    "Přesné použití obsahu části „Lekce 2.3 — Struktura 50 minut a bezpečné uzavření“",
    "Přesné použití obsahu části „Praktická laboratoř 2 — Sada dokumentů první spolupráce“",
    "Přesné použití obsahu části „Profesní aplikace 2 — Zakázka se mění ve třicáté minutě“",
    "Přesné použití obsahu části „Test modulu 2“",
    "Rozpoznání okamžiku, kdy se změnila zakázka",
    "Zachycení změny tématu",
    "Zakázka a způsob práce jsou znovu ověřeny",
    "Zakázka je znovu ověřena"
  ],
  "active_listening": [
    "Alespoň dvě intervence přímo navazují na slova modelové klientky",
    "Aktivní naslouchání: Přesně reflektuje klientčina slova, ověřuje porozumění a nevkládá vlastní význam.",
    "Naslouchání doložené přímou návazností na slova klientky",
    "Navázání vychází z opraveného významu",
    "Navázání z opraveného významu",
    "Oddělení klientčiných slov od hypotézy",
    "Oddělení pozorování od výkladu",
    "Ověření preference místo čtení mysli",
    "Ověření, zda opravený význam sedí",
    "Pozorovatelný důkaz: reflexe klientčiných slov",
    "Přesná návaznost na situaci a druhou stranu",
    "Přesná reflexe klientčiných slov a konfliktu hodnot bez přidaného významu",
    "Přesné naslouchání a plynulý proces",
    "Přesné aktivní naslouchání doložené přímou návazností na slova klientky",
    "Přesné použití dovednosti „Praktická laboratoř 10 — Kalibrace vlastního dopadu“ bez mechanické šablony",
    "Přesné použití dovednosti „Profesní aplikace 3 — Elitea opravuje tvoji parafrázi“ bez mechanické šablony",
    "Přesné použití dovednosti z části „Lekce 3.1 — Prostředí a čtyři vrstvy poslechu“",
    "Přesné použití dovednosti z části „Praktická laboratoř 10 — Kalibrace vlastního dopadu“",
    "Přesné použití dovednosti z části „Praktická laboratoř 3 — Transkript desetiminutového poslechu“",
    "Přesné použití dovednosti z části „Profesní aplikace 10 — Ticho neznamená odpor“",
    "Přesné použití dovednosti z části „Profesní aplikace 3 — Elitea opravuje tvoji parafrázi“",
    "Přesné použití obsahu části „Lekce 10.1 — Emoční inteligence bez čtení mysli“",
    "Přesné použití obsahu části „Lekce 10.2 — Emoční nákaza a zjednodušení „zrcadlových neuronů““",
    "Přesné použití obsahu části „Lekce 10.3 — Rapport, hlas a kulturní pokora“",
    "Přesné použití obsahu části „Lekce 3.1 — Prostředí a čtyři vrstvy poslechu“",
    "Přesné použití obsahu části „Lekce 3.2 — Parafráze, shrnutí a odraz bez papouškování“",
    "Přesné použití obsahu části „Lekce 3.3 — Komunikační bloky“",
    "Přesné použití obsahu části „Lekce 8.2 — Poznámka odděluje fakt, klientčina slova a hypotézu“",
    "Přesné použití obsahu části „Praktická laboratoř 10 — Kalibrace vlastního dopadu“",
    "Přesné použití obsahu části „Praktická laboratoř 3 — Transkript desetiminutového poslechu“",
    "Přesné použití obsahu části „Profesní aplikace 10 — Ticho neznamená odpor“",
    "Přesné použití obsahu části „Profesní aplikace 3 — Elitea opravuje tvoji parafrázi“",
    "Přesné použití obsahu části „Test modulu 10“",
    "Přesné použití obsahu části „Test modulu 3“",
    "Přesný návrat ke klientčiným slovům",
    "Přímá návaznost na poslední klientčina slova",
    "Reálný ekonomický fakt není přepsán jako vnitřní blok",
    "Reflexe kratší než původní sdělení",
    "Respekt k naději klientky bez potvrzení mechanismu",
    "Uznání skutečného faktu a škody",
    "Validace ambice bez neomezeného slibu",
    "Validace přání bez slibu změny druhého",
    "Výslovná možnost opravy parafráze",
    "Zachycení studu bez moralizování"
  ],
  "questions": [
    "Jedna otázka — otevřená a nevedoucí",
    "Jedna otázka — otevřená a nevedoucí: Pokládá jednu jasnou, nevedoucí otázku a citlivou hloubku otevírá se svolením.",
    "Jedna otázka s jedním účelem",
    "Pozorovatelný důkaz: jedna účelná otázka",
    "Přesné použití dovednosti „Praktická laboratoř 4 — Banka 80 otázek s filtrem“ bez mechanické šablony",
    "Přesné použití dovednosti z části „Praktická laboratoř 4 — Banka 80 otázek s filtrem“",
    "Přesné použití obsahu části „Lekce 4.1 — Otevřené, uzavřené, škálovací a zpřesňující otázky“",
    "Přesné použití obsahu části „Lekce 4.2 — Otázky na cíl, význam, možnosti a důsledky“",
    "Přesné použití obsahu části „Lekce 4.3 — Probing, svolení a regulace hloubky“",
    "Přesné použití obsahu části „Praktická laboratoř 4 — Banka 80 otázek s filtrem“",
    "Přesné použití obsahu části „Profesní aplikace 4 — Jedna otázka, potom skutečně poslouchej“",
    "Přesné použití obsahu části „Test modulu 4“",
    "Přímé otázky na aktuální myšlenky, záměr, plán, dostupnost prostředků a bezpečí",
    "Přímé otázky na aktuální plán, prostředky a bezpečí",
    "Přímé otázky na myšlenky a záměr",
    "Přímé otázky na plán a prostředky",
    "Svolení před citlivější hloubkou",
    "Žádná rada ukrytá v otázce"
  ],
  "intervention_choice": [
    "Alternativa není převlečený stejný úkol",
    "Emoce mapovaná v systému více vlivů",
    "Mapování podpůrných dat i výjimek",
    "Mentoring není znovu nabídnut bez výslovného souhlasu",
    "Nabídka skutečně odlišných možností",
    "Pojmenování účelu a volba jiné intervence nebo práce bez rámce",
    "Pojmenování účelu bez obhajoby modelu",
    "Pozorovatelný důkaz: plynulý proces",
    "Pozorovatelný důkaz: respektované odmítnutí a opravená spolupráce bez návratu ke stejnému nástroji",
    "Přesné použití dovednosti „Lekce 11.1 — Growth mindset bez obviňování“ bez mechanické šablony",
    "Přesné použití dovednosti „Praktická laboratoř 7 — Tři nástroje na jeden případ“ bez mechanické šablony",
    "Přesné použití dovednosti „Profesní aplikace 12 — Meditace zhoršuje stav“ bez mechanické šablony",
    "Přesné použití dovednosti z části „Lekce 11.1 — Growth mindset bez obviňování“",
    "Přesné použití dovednosti z části „Praktická laboratoř 7 — Tři nástroje na jeden případ“",
    "Přesné použití dovednosti z části „Profesní aplikace 12 — Meditace zhoršuje stav“",
    "Přesné použití dovednosti z části „Profesní aplikace 7 — Elitea odmítá rámec“",
    "Přesné použití obsahu části „Lekce 11.1 — Growth mindset bez obviňování“",
    "Přesné použití obsahu části „Lekce 12.1 — Sebeuvědomění jako pozorovatelná mapa“",
    "Přesné použití obsahu části „Lekce 12.2 — Přítomný okamžik a mindfulness se souhlasem“",
    "Přesné použití obsahu části „Lekce 15.3 — Otázky a metoda nohou stolu“",
    "Přesné použití obsahu části „Lekce 7.1 — Kolo života bez falešné objektivity“",
    "Přesné použití obsahu části „Lekce 7.2 — GROW a HEART jako mapy, ne skripty“",
    "Přesné použití obsahu části „Lekce 7.3 — Brainstorming a journaling“",
    "Přesné použití obsahu části „Praktická laboratoř 12 — Menu pěti cest pozornosti“",
    "Přesné použití obsahu části „Praktická laboratoř 7 — Tři nástroje na jeden případ“",
    "Přesné použití obsahu části „Profesní aplikace 12 — Meditace zhoršuje stav“",
    "Přesné použití obsahu části „Profesní aplikace 7 — Elitea odmítá rámec“",
    "Přesné použití obsahu části „Test modulu 12“",
    "Přesné použití obsahu části „Test modulu 7“",
    "Úprava spouštěče, tření nebo prostředí",
    "Vnější orientace a otevřené oči",
    "Volba intervence: Volí metodu podle zakázky a reakce klientky, vysvětlí účel a umí rámec odložit.",
    "Volba intervence podle zakázky, vysvětlení účelu a souhlas klientky",
    "Volba metody podle reakce klientky, s vysvětleným účelem a možností rámec odložit"
  ],
  "refusal_autonomy": [
    "Autonomie rozhodnutí je vrácena klientce",
    "Autonomie rozhodnutí zůstává klientce",
    "Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání",
    "Cíl převážně v klientčině vlivu",
    "Journaling ani domácí úkol nejsou znovu nabídnuty",
    "Denník ani domáca úloha nie sú znovu ponúknuté",
    "Klientka dostává svobodnou volbu",
    "Klientka může směr ukončit",
    "Klientka určuje další postup",
    "Klientka volí další způsob práce",
    "Konečné rozhodnutí zůstává klientce",
    "Lidský tón bez odmítnutí klientky",
    "Možnost informovaně nekoupit",
    "Nepřebírání odpovědnosti za klientku",
    "Odmítnutá technika je ihned zastavena",
    "Odmítnutí není zpochybněno ani vykládáno",
    "Odmítnutí, volba a autonomie: Respektuje ne, tempo a volbu klientky a nepřebírá za ni rozhodnutí.",
    "Odpovědnost není skrytě převzata radou",
    "Okamžité zastavení při zhoršení",
    "Ověření aktuálního bezpečí a volby",
    "Pozorovatelný důkaz: autonomie klientky, práce s vratností a konkrétní získání času či odborných dat",
    "Pozorovatelný důkaz: odmítnutí klinické intervence, přiměřené předání a zachování vztahu",
    "Pozorovatelný důkaz: opravená aliance, obnovená autonomie a klientkou potvrzený nový postup",
    "Pozorovatelný důkaz: výslovné odmítnutí neoprávněného sdílení a datově úsporná alternativa",
    "Přizpůsobení tempa bez infantilizace",
    "Respekt k odmítnutí otázky a zachování autonomie klientky",
    "Respekt k odmítnutí otázky a zachování volby klientky",
    "Respekt k odmítnutí otázky",
    "Rozhodnutí nepokračovat stejnou technikou",
    "Schopnost otázku stáhnout, když nesedí",
    "Souhlas, tempo a respekt k hranicím klientky",
    "Technika je ihned zastavena",
    "Výslovné odmítnutí je respektováno a klientčina autonomie zůstává zachována",
    "Znovuvyjednání vlastnictví accountability",
    "Žádné ano/ne místo klientky",
    "Žádný tlak na jediný malý pokus",
    "Žádný tlak nebo falešná jistota"
  ],
  "alliance_repair": [
    "Dopad na alianci je uznán",
    "Klientka potvrzuje opravený další tah",
    "Koučka přesně pojmenuje vlastní chybu",
    "Krátké převzetí odpovědnosti za směr",
    "Navázání až po přijetí opravy klientkou",
    "Oprava omylu bez obhajování",
    "Pozorovatelný důkaz: úplná oprava ruptury pod tlakem bez obrany, opakování techniky nebo psychologizace",
    "Pozorovatelný důkaz: viditelné převzetí odpovědnosti, opravený význam a potvrzení klientky",
    "Převzetí odpovědnosti za nevyžádanou radu",
    "Přijetí opravy bez obhajování",
    "Přijetí opravy bez obhajování a převzetí odpovědnosti za chybný směr",
    "Přijetí opravy bez obhajování: Přijme korekci bez obrany, vezme odpovědnost za chybu a opraví další tah.",
    "Výslovná možnost opravy"
  ],
  "ethical_boundaries": [
    "Bezpečné uzavření bez otevření další hloubky",
    "Bezpečný experiment s podmínkou neprovedení",
    "Běžný koučink je okamžitě zastaven",
    "Důvěrnost a reporting vyjednané předem",
    "Důvěrnost je zachována: obsah ani poznámky nejsou vydány",
    "Etika a profesní hranice: Drží rozsah koučinku, bezpečí, důvěrnost, pravdivé sliby a vhodné předání.",
    "Externí rozhodnutí je výslovně oddělené",
    "Interní certifikát je přesně pojmenován",
    "Jasné odmítnutí léčebného slibu",
    "Jasné rozlišení koučinku, léčby a krizové péče",
    "Jasné vysvětlení předchozí dohody",
    "Klidný lidský tón bez diagnózy",
    "Klidný nesoudící tón bez diagnostiky a bez falešného uklidnění",
    "Klientka má kontrolu nad novým souhlasem",
    "Klinická nebo krizová hranice rozpoznaná pouze při skutečných signálech",
    "Klinická očekávání jsou předána odborníkovi",
    "Konkrétní doporučení zdravotní nebo terapeutické pomoci",
    "Konkrétní odborná návaznost",
    "Konkrétní propojení na 112 nebo 155 a dostupnou blízkou osobu",
    "Kulturní a neurodivergentní pokora",
    "Lidské předání s konkrétním dalším kontaktem",
    "Marketingový jazyk nezastírá hranici",
    "Minimalizace dat a transparentnost AI nebo záznamu",
    "Minimalizace sdílených dat",
    "Nabídka nové třístranné dohody do budoucna",
    "Nabídka samostatného neklinického cíle pouze tehdy, když je vhodná",
    "Nabídka společně schváleného výsledkového reportu",
    "Návrat ke koučování až po vyjasnění bezpečí",
    "Nejmenší bezpečný test nebo možnost získat čas",
    "Neklinický cíl oddělený od symptomů",
    "Není naznačena zdravotnická kvalifikace",
    "Nová třístranná dohoda pouze do budoucna",
    "Odborné předání bez opuštění klientky",
    "Oddělení bezpečného neklinického cíle",
    "Ochrana času a důvěrnosti",
    "Ochrana dat bez útočného tónu",
    "Ochrana důvěrnosti podle předchozí dohody",
    "Okamžité přerušení běžného koučování",
    "Ověření bezpečí a fungování",
    "Ověření bezprostředního bezpečí bez diagnostiky",
    "Ověření schopnosti zůstat v bezpečí",
    "Pasivní sdělení je rozpoznáno jako bezpečnostní signál",
    "Pojmenování hranice bez diagnostiky",
    "Použití techniky není vydáno za zdravotnickou kvalifikaci",
    "Pozorovatelný důkaz: jasná hranice role, bezpečnostní orientace a konkrétní předání bez opuštění klientky",
    "Pozorovatelný důkaz: jasné ne nepravdivé akreditaci a konkrétní pravdivá formulace pro klientský profil",
    "Pozorovatelný důkaz: jasný rozsah služby",
    "Pozorovatelný důkaz: ochrana důvěrnosti pod mocenským a časovým tlakem",
    "Pozorovatelný důkaz: pravdivá identita poskytovatelky a jasné rozlišení od regulované či klinické role",
    "Pozorovatelný důkaz: pravdivý, konkrétní příslib procesu bez garance příjmu",
    "Pozorovatelný důkaz: přímá bezpečnostní reakce, 112/155 a nezůstání o samotě bez slibu mlčenlivosti",
    "Pozorovatelný důkaz: úplné a citlivé ověření rizika před případným návratem ke koučování",
    "Pravdivé vysvětlení nabídky, ceny a interního certifikátu",
    "Právní a finanční otázky jsou předány odborníkům",
    "Právní či finanční otázka předaná odborníkovi",
    "Priorita neodkladné lidské pomoci před technikou nebo cílem",
    "Přesné použití dovednosti „Lekce 17.1 — Vášeň, hodnoty, smysl a životní příběh“ bez mechanické šablony",
    "Přesné použití dovednosti „Lekce 8.1 — Formulář musí sloužit rozhodnutí“ bez mechanické šablony",
    "Přesné použití dovednosti „Profesní aplikace 0 — Elitea žádá terapii pod názvem koučink“ bez mechanické šablony",
    "Přesné použití dovednosti „Profesní aplikace 9 — Klientka chce vymazat trauma“ bez mechanické šablony",
    "Přesné použití dovednosti z části „Lekce 0.1 — Co life coaching je a jaký výsledek může poctivě slíbit“",
    "Přesné použití dovednosti z části „Lekce 17.1 — Vášeň, hodnoty, smysl a životní příběh“",
    "Přesné použití dovednosti z části „Lekce 8.1 — Formulář musí sloužit rozhodnutí“",
    "Přesné použití dovednosti z části „Praktická laboratoř 0 — Mapa role a zakázaných slibů“",
    "Přesné použití dovednosti z části „Praktická laboratoř 17 — Kompletní nabídka a portfolio“",
    "Přesné použití dovednosti z části „Profesní aplikace 0 — Elitea žádá terapii pod názvem koučink“",
    "Přesné použití dovednosti z části „Profesní aplikace 8 — Sponzor chce celý obsah sezení“",
    "Přesné použití dovednosti z části „Profesní aplikace 9 — Klientka chce vymazat trauma“",
    "Přesné použití obsahu části „Lekce 0.1 — Co life coaching je a jaký výsledek může poctivě slíbit“",
    "Přesné použití obsahu části „Lekce 0.2 — Koučink, mentoring, konzultace a psychoterapie“",
    "Přesné použití obsahu části „Lekce 0.3 — Kvalifikace, označení a pravdivý certifikát“",
    "Přesné použití obsahu části „Lekce 1.3 — Hranice, vlastní strach a stav před sezením“",
    "Přesné použití obsahu části „Lekce 12.3 — Čtvercové dýchání a hranice dechu“",
    "Přesné použití obsahu části „Lekce 14.3 — Situační strach, klinická potíž a přijetí“",
    "Přesné použití obsahu části „Lekce 16.2 — Expozice pouze jako neklinický nácvik“",
    "Přesné použití obsahu části „Lekce 17.1 — Vášeň, hodnoty, smysl a životní příběh“",
    "Přesné použití obsahu části „Lekce 17.2 — Nabídka: název, struktura, hodnota, cena a niche“",
    "Přesné použití obsahu části „Lekce 17.3 — Magnet message, balíček, skupina a etický marketing“",
    "Přesné použití obsahu části „Lekce 8.1 — Formulář musí sloužit rozhodnutí“",
    "Přesné použití obsahu části „Lekce 8.3 — Výsledek, zpětná vazba a stížnost“",
    "Přesné použití obsahu části „Lekce 9.1 — Předpoklady NLP jako pracovní otázky“",
    "Přesné použití obsahu části „Lekce 9.2 — Práce s reprezentací vzpomínky a pocitu“",
    "Přesné použití obsahu části „Lekce 9.3 — Self-talk a kotva bez magických slibů“",
    "Přesné použití obsahu části „Praktická laboratoř 0 — Mapa role a zakázaných slibů“",
    "Přesné použití obsahu části „Praktická laboratoř 17 — Kompletní nabídka a portfolio“",
    "Přesné použití obsahu části „Praktická laboratoř 8 — Audit 12 formulářů“",
    "Přesné použití obsahu části „Profesní aplikace 0 — Elitea žádá terapii pod názvem koučink“",
    "Přesné použití obsahu části „Profesní aplikace 13 — Toxická pozitivita“",
    "Přesné použití obsahu části „Profesní aplikace 17 — Dvě celá sezení a obhajoba podnikání“",
    "Přesné použití obsahu části „Profesní aplikace 8 — Sponzor chce celý obsah sezení“",
    "Přesné použití obsahu části „Profesní aplikace 9 — Klientka chce vymazat trauma“",
    "Přesné použití obsahu části „Test modulu 0“",
    "Přesné použití obsahu části „Test modulu 17“",
    "Přesné použití obsahu části „Test modulu 8“",
    "Přesné použití obsahu části „Test modulu 9“",
    "Přímé a klidné ověření bezprostředního ohrožení",
    "Přímé ověření aktuálního bezpečí",
    "Přiměřená krizová, zdravotní a blízká podpora",
    "Přiměřené propojení s krizovou nebo zdravotní pomocí a blízkým člověkem podle zjištěného rizika",
    "Původní souhlas není zpětně rozšířen",
    "Respekt k hranicím a reálnému kontextu",
    "Respekt k možné systémové nebo právní nápravě",
    "Rozlišení koučinku, mentoringu a garance výsledku",
    "Rozlišení účasti, cíle a obsahu sezení",
    "Rozlišení vlivu klientky, koučky a trhu",
    "Rozlišení vztahového, zdravotního a koučovacího tématu",
    "Rozpoznání pasivního sebevražedného sdělení jako bezpečnostního signálu",
    "Rozsah ověřovaných dovedností je srozumitelný",
    "Skutečná role je popsána konkrétně",
    "Srozumitelná nabídka i bez výsledkové garance",
    "Srozumitelné vymezení koučovací role",
    "Transparentní komunikace ke klientce i sponzorovi",
    "Volitelný neklinický cíl až po oddělení témat",
    "Výslovná priorita 112 nebo 155 při bezprostředním riziku",
    "Vznikne použitelná pravdivá formulace",
    "Zapojení dostupné blízké osoby",
    "Žádná automatická licence",
    "Žádná diagnóza ani předstírání léčby",
    "Žádná expozice ani přepis traumatické vzpomínky",
    "Žádná falešná naléhavost ani nálepka strachu",
    "Žádná garance příjmu ani skrytý ekvivalent",
    "Žádná práce s traumatickou vzpomínkou",
    "Žádná toxická pozitivita",
    "Žádné obviňování mindsetu",
    "Žádné potvrzení konkrétního výroku nebo tématu",
    "Žádné předání zápisu",
    "Žádné tvrzení o ICF akreditaci bez doložení",
    "Žádné vysvětlení nepohody jako důkazu účinku",
    "Žádné zpětné rozšíření souhlasu",
    "Žádný léčebný slib",
    "Žádný návrat ke koučinku před vyjasněním bezpečí",
    "Žádný příslib přijetí nebo povýšení",
    "Žádný slib utajení ani ponechání o samotě",
    "Žádný slib utajení, diagnostika ani ponechání klientky samotné s rizikem",
    "Žádný titul psycholožky nebo terapeutky bez oprávnění"
  ],
  "outcome": [
    "Bod revize bez manipulace",
    "Klientka formuluje vlastní kritéria",
    "Klientkou ovlivnitelné kroky a metriky",
    "Klientkou vytvořená přesnější formulace pouze tam, kde je poctivá",
    "Klientkou zvolený a ověřitelný další krok",
    "Klientkou zvolený ověřitelný krok",
    "Konkrétní uzavření nebo další krok",
    "Konkrétne uzavretie alebo ďalší krok",
    "Kontrola kapacity a ceny cíle",
    "Kritérium revize experimentu",
    "Malý experiment vytvářející data",
    "Měřitelné procesní ukazatele",
    "Nalezení časného bodu volby",
    "Návratový protokol bez trestu",
    "Nejmenší bezpečný krok vytváří čas nebo data",
    "Oddělení obsahu, účasti a výsledkové metriky",
    "Oddělení výsledku, systému a experimentu",
    "Pozorovatelný důkaz: klientkou vlastněné rozhodnutí opřené o kritéria, čas a vratný mezikrok",
    "Pozorovatelný důkaz: klientkou zvolený krok",
    "Pozorovatelný důkaz: výslovné přijetí „ne“, žádné obcházení a klientkou zvolená alternativa",
    "Přesné použití dovednosti „Lekce 5.1 — Cíl, výsledek a systém“ bez mechanické šablony",
    "Přesné použití dovednosti „Praktická laboratoř 16 — Rozhodovací memo a fear setting“ bez mechanické šablony",
    "Přesné použití dovednosti „Profesní aplikace 6 — Accountability, která začala dusit“ bez mechanické šablony",
    "Přesné použití dovednosti z části „Lekce 16.1 — Rozhodnutí, autopilot a nevratnost“",
    "Přesné použití dovednosti z části „Lekce 5.1 — Cíl, výsledek a systém“",
    "Přesné použití dovednosti z části „Praktická laboratoř 16 — Rozhodovací memo a fear setting“",
    "Přesné použití dovednosti z části „Profesní aplikace 16 — Koučka nesmí tlačit do odvahy“",
    "Přesné použití dovednosti z části „Profesní aplikace 6 — Accountability, která začala dusit“",
    "Přesné použití obsahu části „Lekce 16.1 — Rozhodnutí, autopilot a nevratnost“",
    "Přesné použití obsahu části „Lekce 16.3 — Změna, bolest–potěšení, change résumé a fear setting“",
    "Přesné použití obsahu části „Lekce 5.1 — Cíl, výsledek a systém“",
    "Přesné použití obsahu části „Lekce 5.2 — COACH a rozvoj kompetence“",
    "Přesné použití obsahu části „Lekce 5.3 — Akční plán a dostatečně silný důvod“",
    "Přesné použití obsahu části „Lekce 6.1 — Accountability bez kontroly a studu“",
    "Přesné použití obsahu části „Lekce 6.3 — Odměna, oslava a návrat po výpadku“",
    "Přesné použití obsahu části „Praktická laboratoř 14 — Řetězec emoce a plán bodu volby“",
    "Přesné použití obsahu části „Praktická laboratoř 16 — Rozhodovací memo a fear setting“",
    "Přesné použití obsahu části „Praktická laboratoř 5 — Od přání k testovatelnému plánu“",
    "Přesné použití obsahu části „Praktická laboratoř 6 — Behaviorální mapa jednoho týdne“",
    "Přesné použití obsahu části „Praktická laboratoř 9 — Tři experimenty s předregistrací“",
    "Přesné použití obsahu části „Profesní aplikace 16 — Koučka nesmí tlačit do odvahy“",
    "Přesné použití obsahu části „Profesní aplikace 5 — Klientka chce výsledek druhého člověka“",
    "Přesné použití obsahu části „Profesní aplikace 6 — Accountability, která začala dusit“",
    "Přesné použití obsahu části „Test modulu 16“",
    "Přesné použití obsahu části „Test modulu 5“",
    "Přesné použití obsahu části „Test modulu 6“",
    "Výpadek použitý jako data",
    "Výsledek a klientčin krok: Převádí uvědomění do klientkou zvoleného, pozorovatelného kroku a revize.",
    "Vznikne vratný mezikrok nebo čas na rozhodnutí"
  ],
  "reflection": [
    "Aktuální konflikt není vydán za celý obraz",
    "Chybějící data jsou odlišena od strachu",
    "Jsou zmapovány důsledky a možnosti",
    "Nevratnost a časový tlak jsou pojmenované",
    "Práce s hypotézou místo prvního dojmu a konkrétní reflexe biasu",
    "Práce s hypotézou místo prvního dojmu",
    "Oddělení události, interpretace a předpovědi",
    "Oprava očekávání úplné kontroly bez zlehčení",
    "Pojmenování vhodné supervizní otázky",
    "Práce s hypotézou místo prvního dojmu",
    "Přesné použití dovednosti „Lekce 14.1 — Emoce vzniká v systému, ne pouze myšlenkou“ bez mechanické šablony",
    "Přesné použití dovednosti „Praktická laboratoř 1 — Deník spouštěčů a osobní kodex“ bez mechanické šablony",
    "Přesné použití dovednosti „Praktická laboratoř 13 — Dvacet přesných přepisů“ bez mechanické šablony",
    "Přesné použití dovednosti „Profesní aplikace 15 — Přesvědčení chrání klientku“ bez mechanické šablony",
    "Přesné použití dovednosti z části „Lekce 14.1 — Emoce vzniká v systému, ne pouze myšlenkou“",
    "Přesné použití dovednosti z části „Praktická laboratoř 1 — Deník spouštěčů a osobní kodex“",
    "Přesné použití dovednosti z části „Praktická laboratoř 13 — Dvacet přesných přepisů“",
    "Přesné použití dovednosti z části „Profesní aplikace 15 — Přesvědčení chrání klientku“",
    "Přesné použití obsahu části „Lekce 1.1 — Bias a hypotéza místo pravdy“",
    "Přesné použití obsahu části „Lekce 1.2 — Empatie versus projekce a pomoc versus závislost“",
    "Přesné použití obsahu části „Lekce 11.2 — Neuroplasticita není nekonečné přepsání mozku“",
    "Přesné použití obsahu části „Lekce 11.3 — Sebedůvěra jako kalibrovaná předpověď“",
    "Přesné použití obsahu části „Lekce 13.1 — Myšlenka, fakt, příběh a užitečnost“",
    "Přesné použití obsahu části „Lekce 13.2 — Self-talk ve dvou krocích“",
    "Přesné použití obsahu části „Lekce 13.3 — Reframing a „ale“ bez popírání překážky“",
    "Přesné použití obsahu části „Lekce 14.1 — Emoce vzniká v systému, ne pouze myšlenkou“",
    "Přesné použití obsahu části „Lekce 14.2 — Zastavení momenta dříve“",
    "Přesné použití obsahu části „Lekce 15.1 — Přesvědčení a schéma nejsou skrytá diagnóza“",
    "Přesné použití obsahu části „Lekce 15.2 — Podmíněná a skrytá pravidla“",
    "Přesné použití obsahu části „Lekce 6.2 — Spouštěče, tření a návrh prostředí“",
    "Přesné použití obsahu části „Praktická laboratoř 1 — Deník spouštěčů a osobní kodex“",
    "Přesné použití obsahu části „Praktická laboratoř 11 — Učební smyčka 14 dní“",
    "Přesné použití obsahu části „Praktická laboratoř 13 — Dvacet přesných přepisů“",
    "Přesné použití obsahu části „Praktická laboratoř 15 — Audit jednoho pravidla“",
    "Přesné použití obsahu části „Profesní aplikace 1 — Oblíbená klientka a dvojí metr“",
    "Přesné použití obsahu části „Profesní aplikace 11 — „Když chceš, dokážeš všechno““",
    "Přesné použití obsahu části „Profesní aplikace 14 — „Vezmi si zpět moc nad emocí““",
    "Přesné použití obsahu části „Profesní aplikace 15 — Přesvědčení chrání klientku“",
    "Přesné použití obsahu části „Test modulu 1“",
    "Přesné použití obsahu části „Test modulu 11“",
    "Přesné použití obsahu části „Test modulu 13“",
    "Přesné použití obsahu části „Test modulu 14“",
    "Přesné použití obsahu části „Test modulu 15“",
    "Přesvědčení označené jako hypotéza, ne diagnóza",
    "Reflexe pojmenuje konkrétní důkaz, mezeru a cíl dalšího pokusu",
    "Reflexe, bias a učení: Pracuje s hypotézou, reflektuje vlastní bias a stanoví konkrétní další pokus.",
    "Rozlišení dovednosti, motivace a podmínek",
    "Rozlišení emoce, impulsu a jednání",
    "Rozlišení empatie a projekce",
    "Rozlišení vratnosti a skutečného rizika",
    "Sebedůvěra opřená o důkaz a přípravu",
    "Stejný standard pro stejné chování",
    "Úzká a podmíněná alternativa",
    "Uznání ochranné funkce a reálného rizika",
    "Žádné hodnocení klientčiny korekce ani obrana původní hypotézy"
  ]
});

const MODULE_COMPETENCY = Object.freeze({
  0: 'ethical_boundaries',
  1: 'reflection',
  2: 'contract',
  3: 'active_listening',
  4: 'questions',
  5: 'outcome',
  6: 'outcome',
  7: 'intervention_choice',
  8: 'ethical_boundaries',
  9: 'ethical_boundaries',
  10: 'active_listening',
  11: 'reflection',
  12: 'intervention_choice',
  13: 'reflection',
  14: 'reflection',
  15: 'reflection',
  16: 'outcome',
  17: 'ethical_boundaries',
});

const GENERIC_CURRENT_LESSON_LABELS = new Set([
  normalizeCoachRubricLabel('Použití dovednosti z aktuální lekce'),
  normalizeCoachRubricLabel('Použitie zručnosti z aktuálnej lekcie'),
]);

const DYNAMIC_LESSON_CRITERION_PREFIXES = Object.freeze([
  'presne pouziti obsahu casti ',
  'presne pouzitie obsahu casti ',
  'presne pouziti dovednosti z casti ',
  'presne pouzitie zrucnosti z casti ',
  'presne pouziti dovednosti ',
  'presne pouzitie zrucnosti ',
]);

// These are exact, reviewed phrases used by the debrief quality layer when it
// refers to a registered criterion in explanatory prose.  They deliberately
// live beside the registry instead of reviving the old loose keyword mapper.
const AUDITED_REFERENCE_ALIASES = new Map([
  ['jasna zmluva', 'contract'],
  ['jasnu zmluvu', 'contract'],
  ['jasny kontrakt', 'contract'],
  ['kontrakt a zmluva', 'contract'],
]);

const EXACT_REGISTRY = buildExactRegistry();

/**
 * Exact, fail-closed criterion lookup. Unknown labels are never inferred from
 * loose keywords. The legacy "current lesson skill" placeholder is accepted
 * solely when canonical lesson metadata identifies its module and item.
 */
export function resolveCoachRubricCriterion(label, context = {}) {
  const normalizedLabel = normalizeCoachRubricLabel(label);
  if (!normalizedLabel) {
    return Object.freeze({ resolved: false, reason: 'empty_criterion', label: String(label || '') });
  }

  if (GENERIC_CURRENT_LESSON_LABELS.has(normalizedLabel)) {
    return resolveLessonBoundCriterion(label, context);
  }

  const exact = EXACT_REGISTRY.get(normalizedLabel);

  // Lesson-specific labels also occur in the audited catalogue. They must
  // nevertheless be resolved from the currently opened server-owned item;
  // returning the static registry entry first would silently discard the
  // course/item/module binding and make the lesson proof impossible to verify.
  if (DYNAMIC_LESSON_CRITERION_PREFIXES.some(prefix => normalizedLabel.startsWith(prefix))) {
    const hasLessonContext = canonicalModuleIndex(context) !== null
      && Boolean(String(context.itemTitle || context.item?.title || context.scenario?.itemTitle || '').trim())
      && Boolean(String(context.itemId || context.item?.id || context.scenario?.itemId || '').trim());
    // Context-free lookups are still used to map a known audited label to its
    // competency in passport/reporting code. They cannot prove evidence. The
    // evidence ledger always supplies the exact server-owned lesson context.
    if (!hasLessonContext && exact) return exact;
    return resolveLessonBoundCriterion(label, context, { requireTitleMatch: true });
  }

  if (exact) return exact;

  return Object.freeze({
    resolved: false,
    reason: 'unknown_criterion',
    label: String(label || '').trim(),
    normalizedLabel,
  });
}

/**
 * Resolve a criterion mentioned verbatim inside explanatory prose (for
 * example "Priorita: Jasný účel a výsledek nácviku").  This is still an
 * exact-registry operation: only a complete audited label is accepted, and an
 * ambiguous reference spanning multiple competencies fails closed.
 */
export function resolveCoachRubricCriterionReference(value, context = {}) {
  const direct = resolveCoachRubricCriterion(value, context);
  if (direct.resolved || direct.reason === 'lesson_metadata_required') return direct;

  const normalizedValue = normalizeCoachRubricLabel(value);
  if (!normalizedValue) return direct;
  const aliasMatches = [...AUDITED_REFERENCE_ALIASES.entries()]
    .filter(([alias]) => (` ${normalizedValue} `).includes(` ${alias} `));
  if (aliasMatches.length) {
    const competencyIds = new Set(aliasMatches.map(([, competencyId]) => competencyId));
    if (competencyIds.size !== 1) {
      return Object.freeze({
        resolved: false,
        reason: 'ambiguous_criterion_reference',
        label: String(value || '').trim(),
        normalizedLabel: normalizedValue,
      });
    }
    const [alias, competencyId] = aliasMatches.sort((left, right) => right[0].length - left[0].length)[0];
    return Object.freeze({
      resolved: true,
      label: alias,
      normalizedLabel: alias,
      competencyId,
      evidenceKind: 'reference_alias',
      evidenceRuleId: null,
      source: 'audited-reference-alias',
      referencedBy: String(value || '').trim(),
    });
  }
  const matches = [...EXACT_REGISTRY.values()]
    .filter(entry => entry.normalizedLabel.length >= 12
      && (` ${normalizedValue} `).includes(` ${entry.normalizedLabel} `))
    .sort((left, right) => right.normalizedLabel.length - left.normalizedLabel.length);
  if (!matches.length) return direct;

  const longestLength = matches[0].normalizedLabel.length;
  const strongest = matches.filter(entry => entry.normalizedLabel.length === longestLength);
  if (new Set(strongest.map(entry => entry.competencyId)).size !== 1) {
    return Object.freeze({
      resolved: false,
      reason: 'ambiguous_criterion_reference',
      label: String(value || '').trim(),
      normalizedLabel: normalizedValue,
    });
  }
  return Object.freeze({
    ...strongest[0],
    source: 'audited-runtime-reference',
    referencedBy: String(value || '').trim(),
  });
}

export function buildCoachRubricRegistry(records = []) {
  const entries = new Map();
  const unresolved = [];
  const conflicts = [];
  for (const [index, rawRecord] of (Array.isArray(records) ? records : []).entries()) {
    const record = typeof rawRecord === 'string' ? { label: rawRecord } : (rawRecord || {});
    const resolved = resolveCoachRubricCriterion(record.label, record);
    if (!resolved.resolved) {
      unresolved.push(Object.freeze({ index, ...record, resolution: resolved }));
      continue;
    }
    const existing = entries.get(resolved.normalizedLabel);
    if (existing && (
      existing.competencyId !== resolved.competencyId
      || existing.evidenceRuleId !== resolved.evidenceRuleId
    )) {
      conflicts.push(Object.freeze({ index, record, existing, incoming: resolved }));
      continue;
    }
    entries.set(resolved.normalizedLabel, resolved);
  }
  return Object.freeze({
    version: COACH_RUBRIC_REGISTRY_VERSION,
    entries,
    unresolved: Object.freeze(unresolved),
    conflicts: Object.freeze(conflicts),
    complete: unresolved.length === 0 && conflicts.length === 0,
  });
}

/**
 * Produces the same rubric universe that production can serve: every lesson
 * item at every difficulty, every authored Mastery Lab scenario, and both
 * finalExam.rubric and finalExam.criteria.
 */
export function collectProfessionalCoachRuntimeRubricRecords({
  course,
  createScenario,
  difficulties = ['guided', 'standard', 'advanced', 'expert'],
} = {}) {
  if (course?.id !== PROFESSIONAL_COACH_COURSE_ID) {
    throw new TypeError('A canonical professional life-coach course is required.');
  }
  if (typeof createScenario !== 'function') {
    throw new TypeError('createScenario must be the production createTrainingScenario function.');
  }

  const records = [];
  const seenScenarioKeys = new Set();
  const pushScenario = (scenario, source) => {
    if (!scenario || !Array.isArray(scenario.rubric)) return;
    const scenarioKey = [source, scenario.id, scenario.itemId, scenario.difficulty].join('|');
    if (seenScenarioKeys.has(scenarioKey)) return;
    seenScenarioKeys.add(scenarioKey);
    for (const [criterionIndex, label] of scenario.rubric.entries()) {
      records.push(Object.freeze({
        label,
        source,
        criterionIndex,
        courseId: course.id,
        moduleIndex: Number.isInteger(scenario.moduleIndex)
          ? scenario.moduleIndex
          : findModuleIndex(course, scenario.itemId),
        itemId: scenario.itemId || null,
        itemTitle: scenario.itemTitle || null,
        scenarioId: scenario.id || null,
        scenarioFamilyId: scenario.scenarioFamilyId || null,
        challengeId: scenario.challengeId || null,
        difficulty: scenario.difficulty || null,
      }));
    }
  };

  for (const module of course.modules || []) {
    for (const item of module.items || []) {
      for (const difficulty of difficulties) {
        pushScenario(createScenario(course, item, difficulty), 'lesson');
      }
    }
  }

  for (const authored of course.mastery?.scenarios || []) {
    const item = findCourseItem(course, authored.itemId);
    if (!item) {
      records.push(Object.freeze({
        label: '',
        source: 'mastery',
        scenarioId: authored.id,
        error: 'missing_mastery_item',
      }));
      continue;
    }
    pushScenario(
      createScenario(course, item, authored.difficulty || 'standard', authored.id),
      'mastery',
    );
  }

  for (const field of ['rubric', 'criteria']) {
    for (const [criterionIndex, label] of (course.mastery?.finalExam?.[field] || []).entries()) {
      records.push(Object.freeze({
        label,
        source: `finalExam.${field}`,
        criterionIndex,
        courseId: course.id,
        scenarioId: course.mastery.finalExam.id,
      }));
    }
  }

  return Object.freeze(records);
}

export function auditCoachRubricRegistry(records = []) {
  const registry = buildCoachRubricRegistry(records);
  const uniqueLabels = new Set(
    (Array.isArray(records) ? records : [])
      .map(record => normalizeCoachRubricLabel(typeof record === 'string' ? record : record?.label))
      .filter(Boolean),
  );
  return Object.freeze({
    version: registry.version,
    sourceRecordCount: Array.isArray(records) ? records.length : 0,
    uniqueCriterionCount: uniqueLabels.size,
    registeredCriterionCount: registry.entries.size,
    unresolved: registry.unresolved,
    conflicts: registry.conflicts,
    complete: registry.complete && registry.entries.size === uniqueLabels.size,
  });
}

export function knownCoachRubricCriteria() {
  return Object.freeze([...EXACT_REGISTRY.values()]);
}

export function normalizeCoachRubricLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function buildExactRegistry() {
  const map = new Map();
  for (const [competencyId, labels] of Object.entries(KNOWN_CRITERIA_BY_COMPETENCY)) {
    for (const label of labels) {
      const normalizedLabel = normalizeCoachRubricLabel(label);
      const evidenceKind = evidenceKindForExactCriterion(normalizedLabel, competencyId);
      const entry = freezeEntry({
        label,
        normalizedLabel,
        competencyId,
        evidenceKind,
        evidenceRuleId: `coach-rubric-v3:${evidenceKind}:${stableCriterionHash(normalizedLabel)}`,
        source: 'audited-runtime',
      });
      const existing = map.get(normalizedLabel);
      if (existing && existing.competencyId !== competencyId) {
        throw new Error(`Coach rubric registry collision for "${label}".`);
      }
      map.set(normalizedLabel, entry);
    }
  }
  return map;
}

function resolveLessonBoundCriterion(label, context, { requireTitleMatch = false } = {}) {
  const moduleIndex = canonicalModuleIndex(context);
  const competencyId = MODULE_COMPETENCY[moduleIndex] || null;
  const itemTitle = String(
    context.itemTitle || context.item?.title || context.scenario?.itemTitle || '',
  ).trim();
  const itemId = String(
    context.itemId || context.item?.id || context.scenario?.itemId || '',
  ).trim();
  if (!competencyId || (!itemTitle && !itemId)) {
    return Object.freeze({
      resolved: false,
      reason: 'lesson_metadata_required',
      label: String(label || '').trim(),
      normalizedLabel: normalizeCoachRubricLabel(label),
    });
  }
  const lessonIdentity = normalizeCoachRubricLabel(itemTitle || itemId);
  const normalizedLabel = normalizeCoachRubricLabel(label);
  if (requireTitleMatch && itemTitle && !(` ${normalizedLabel} `).includes(` ${normalizeCoachRubricLabel(itemTitle)} `)) {
    return Object.freeze({
      resolved: false,
      reason: 'lesson_metadata_mismatch',
      label: String(label || '').trim(),
      normalizedLabel,
    });
  }
  return freezeEntry({
    label: String(label || '').trim(),
    normalizedLabel,
    competencyId,
    evidenceKind: 'lesson_application',
    evidenceRuleId: `coach-rubric-v3:lesson_application:m${moduleIndex}:${stableCriterionHash(lessonIdentity)}`,
    source: 'lesson-metadata',
    moduleIndex,
    itemId: itemId || null,
    itemTitle: itemTitle || null,
    lessonIdentity,
  });
}

function canonicalModuleIndex(context) {
  for (const value of [context.moduleIndex, context.scenario?.moduleIndex, context.item?.moduleIndex]) {
    const number = Number(value);
    if (Number.isInteger(number) && number >= 0 && number <= 17) return number;
  }
  return null;
}

function findModuleIndex(course, itemId) {
  return (course.modules || []).findIndex(module => (
    (module.items || []).some(item => item.id === itemId)
  ));
}

function findCourseItem(course, itemId) {
  for (const module of course.modules || []) {
    const item = (module.items || []).find(candidate => candidate.id === itemId);
    if (item) return item;
  }
  return null;
}

function evidenceKindForExactCriterion(label, competencyId) {
  if (/^presne pouziti (?:obsahu casti|dovednosti z casti|dovednosti )/u.test(label)) {
    return 'lesson_application';
  }
  if (/(?:112|155|sebevraz|samovraz|bezprostredni|bezprostredne|krizov|zustat v bezpeci|zostat v bezpeci|pasivni sdeleni|pasivne vyjadrenie|prime otazky na (?:aktualni )?(?:myslenky|plan)|overeni schopnosti zustat)/u.test(label)) {
    return 'safety_response';
  }
  if (/(?:duvern|dovern|report|sdilenych dat|zdielanych dat|predani zapisu|odovzdanie zapisu|tristrann|trojstrann)/u.test(label)) {
    return 'confidentiality';
  }
  if (COACH_RUBRIC_COMPETENCY_IDS.includes(competencyId)) return competencyId;
  return 'unsupported';
}

function stableCriterionHash(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function freezeEntry(entry) {
  return Object.freeze({ resolved: true, ...entry });
}
