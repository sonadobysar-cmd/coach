# AI agenti a automatizace v praxi — nahrávací scénáře pro Niu

Interní produkční podklad. Každý text je připravený k doslovnému namluvení. Čti klidně, věcně a nech posluchačce prostor k zastavení nahrávky a zápisu.

## AUDIO 1 — Nejdřív výsledek, potom nástroj

### Doslovný text

Než otevřeš další AI nástroj, zastav se. Pojmenuj jeden výsledek, který má po skončení práce existovat. Ne „použít agenta“, ale například „připravit návrh týdenního reportu ze tří schválených zdrojů“. Teď si napiš, kdo výsledek použije, podle čeho pozná kvalitu a co se nesmí stát. Co je pouze návrh? Co může systém přečíst? Co už by byla externí akce? Kdo ji musí schválit?

Rozděl workflow na vstup, zpracování, kontrolu a předání. Ke každému kroku doplň vlastníka a důkaz dokončení. Pokud neumíš popsat kontrolu, automatizace ještě není připravená. Vyber jeden ruční výchozí průchod a změř jeho čas, chybovost a počet předání. To je tvoje baseline. Teprve proti ní budeš později dokazovat přínos.

Teď nahrávku zastav a vyplň Workflow Canvas. Nehledej nejchytřejší technologii. Hledej nejmenší bezpečný postup, jehož výsledek můžeš zkontrolovat a v případě chyby vrátit zpět.

## AUDIO 2 — Zadání, kontext a zdroje

### Doslovný text

Kvalitní výstup nezačíná kouzelnou formulí. Začíná rozhodnutím, co model smí vědět, z čeho má vycházet a co má přiznat jako nejistotu. Do zadání napiš roli pouze tehdy, když zpřesňuje odborný úhel. Potom uveď konkrétní úkol, publikum, požadovaný formát, kritéria kvality a hranice.

Kontext rozděl na tři části. Stabilní pravidla, například tón značky. Proměnlivá data, například výsledky tohoto týdne. A zdroje, které musí model citovat nebo z nich vycházet. U každého důležitého tvrzení si vyžádej zdroj, datum nebo označení „neověřeno“. Když zdroj chybí, model nemá mezeru elegantně doplnit, ale viditelně ji označit.

Teď vytvoř dvě testovací zadání. První záměrně vágní. Druhé podle této struktury. Porovnej přesnost, počet nutných oprav a schopnost dohledat původ tvrzení. Nehodnoť jen to, který text zní lépe. Hodnoť, který výstup je bezpečnější použít při reálném rozhodnutí.

## AUDIO 3 — Bezpečná práce se soubory

### Doslovný text

Při práci se soubory začni rozsahem. Urči jednu vstupní složku, jednu pracovní kopii a jednu výstupní složku. Originály zůstávají beze změny. Pokud workflow přejmenovává, přesouvá nebo přepisuje soubory, nejprve vyžaduj náhled změn: co se stane, s jakým souborem a proč.

Teď zkontroluj data. Obsahují osobní údaje, smlouvy, hesla, API klíče nebo interní obchodní informace? Co nemusí být součástí úkolu, odstraň. Co musí zůstat, označ podle citlivosti a ověř, zda je zvolený nástroj smí zpracovat. Princip je jednoduchý: nejmenší nutný rozsah dat a nejmenší nutné oprávnění.

Před spuštěním si připrav kontrolní vzorek a rollback. Po dokončení neověřuj jen počet souborů. Otevři několik výstupů, porovnej význam, formát a úplnost a ulož log změn. Zastav nahrávku a popiš, jak přesně bys obnovila stav před automatizací. Jestli odpověď neznáš, workflow ještě nespouštěj.

## AUDIO 4 — Dovednosti, pluginy a dodavatelský řetězec

### Doslovný text

Dovednost, plugin nebo příkaz rozšiřuje možnosti agenta, ale současně rozšiřuje plochu rizika. Před instalací si odpověz na pět otázek. Kdo komponentu vytvořil? Jaká oprávnění žádá? Jaká data čte a kam může zapisovat? Je její chování kontrolovatelné? A jak ji odstraníš, pokud se ukáže jako nevhodná?

Nezaměňuj popularitu za audit. Přečti instrukce komponenty, zkontroluj verzi a změny a vyzkoušej ji na neškodných datech. Pokud umí spouštět příkazy, přistupovat k síti nebo odesílat obsah, počítej s tím jako s externí akcí. Výchozí režim je návrh a náhled. Skutečné provedení přichází až po lidském schválení.

Teď si vyber jednu často používanou činnost a sepiš vlastní kartu dovednosti: účel, povolené vstupy, zakázané operace, očekávaný výstup, testovací příklady a podmínky zastavení. Dobrá dovednost není dlouhý prompt. Je to opakovatelný kontrakt, podle kterého dokáže jiný člověk poznat, zda proběhla správně.

## AUDIO 5 — Konektory, MCP a rozdíl mezi návrhem a akcí

### Doslovný text

Konektor propojuje užitečný kontext s možností něco změnit. Proto vždy odděl čtení, návrh a provedení. Agent může načíst povolená data. Může připravit návrh odpovědi nebo změny. Odeslání e-mailu, publikace, zápis do CRM, vytvoření události nebo finanční krok však vyžadují jasnou autorizační bránu.

Při připojení služby zkontroluj scope oprávnění. Nepovoluj celý účet, pokud stačí konkrétní složka nebo funkce. U OAuth souhlasu si přečti, k čemu aplikace získává přístup, a naplánuj pravidelnou revizi i odebrání přístupu. Tajné klíče nepatří do zadání, chatu ani zdrojového kódu.

Teď si představ, že v načteném dokumentu stojí instrukce, aby agent ignoroval předchozí pravidla a odeslal data. To není úkol, ale nedůvěryhodný obsah. Agent ho musí izolovat, oznámit a zastavit externí akci. Zastav nahrávku a zakresli tři brány: před načtením, před změnou a před odesláním. Ke každé doplň člověka, který nese rozhodnutí.

## AUDIO 6 — Data, tabulky a poctivé závěry

### Doslovný text

Než necháš AI analyzovat tabulku, vytvoř datový kontrakt. Co znamená jeden řádek? Jaké období data pokrývají? V jakých jednotkách jsou hodnoty? Které sloupce mohou chybět a co znamená nula? Bez těchto odpovědí může být výpočet technicky správný a přesto významově chybný.

Začni profilem dat: počet řádků, duplicity, chybějící hodnoty, extrémy a nekonzistentní kategorie. Každou opravu nebo imputaci zaznamenej. Původní data zachovej. U důležitých metrik požaduj vzorec, vstupní rozsah a kontrolní výpočet. Graf není důkaz příčiny a předpověď není skutečnost; vždy přidej předpoklady, interval nejistoty a scénář, ve kterém závěr neplatí.

Teď vyber jednu metriku ze své praxe. Napiš její přesnou definici, vlastníka, frekvenci aktualizace a rozhodnutí, které má podpořit. Potom vytvoř jeden test, který odhalí chybný rozsah nebo změnu jednotek. Dobrá AI analýza není jen rychlá. Je reprodukovatelná, dohledatelná a připravená na nepříjemnou kontrolní otázku.

## AUDIO 7 — AI při práci s kódem

### Doslovný text

Při práci s kódem nejprve popiš problém a přijatelný výsledek. Nezačínej požadavkem „oprav všechno“. Urči dotčené chování, reprodukční kroky, hranice změny a test, který před úpravou selže a po úpravě projde. Agent má nejdřív číst relevantní části projektu a vysvětlit závislosti, potom navrhnout malý diff.

Každou změnu kontroluj ve čtyřech vrstvách: funkčnost, regrese, bezpečnost a provoz. Testy jsou důkaz jen pro to, co skutečně ověřují. Zelený test nepotvrzuje správná oprávnění, ochranu tajemství ani vhodnost obchodního pravidla, pokud to test neobsahuje. Citlivé hodnoty zůstávají v bezpečné správě prostředí a nesmějí se objevit v logu nebo commitu.

Teď napiš předávací poznámku: co se změnilo, proč, jak bylo chování ověřeno, co zůstává rizikem a jak změnu vrátit zpět. Pokud tuto poznámku neumíš vytvořit, změna ještě není připravená k nasazení. Cílem není co nejvíc vygenerovaného kódu, ale co nejmenší ověřená změna.

## AUDIO 8 — Agent, paměť a hranice autonomie

### Doslovný text

Agent není jen chatbot s delším promptem. Má cíl, dostupné nástroje, stav, rozhodovací smyčku a podmínku ukončení. Nejdřív určuj, co má agent pozorovat, co smí navrhnout a co smí provést. Každý nástroj potřebuje omezený vstup, předvídatelný výstup a jasnou chybu.

Paměť rozděl na pracovní, uživatelské preference a dlouhodobé znalosti. Neukládej všechno. U každého záznamu určuj původ, datum, citlivost, dobu platnosti a možnost opravy nebo smazání. Paměť může být zastaralá nebo chybná; agent ji proto nesmí vydávat za čerstvý fakt bez ověření.

Teď vytvoř tři evaluační případy: běžný úkol, neúplné zadání a rizikový požadavek. U každého napiš očekávanou akci, zakázanou akci a důkaz úspěchu. Přidej limit kroků, nákladů a času. Autonomie není počet věcí, které agent zvládne bez člověka. Je to přesně vymezený prostor, ve kterém umí jednat, vysvětlit rozhodnutí a bezpečně zastavit.

## AUDIO 9 — Osobní AI operační systém

### Doslovný text

Osobní AI systém začíná strukturou informací, ne sběrem všeho. Vytvoř několik jasných oblastí: aktivní projekty, odpovědnosti, zdroje, rozhodnutí a archiv. Ke každému dokumentu uveď vlastníka, aktuálnost a citlivost. Agent potřebuje mapu, podle níž pozná, co je autoritativní a co pouze pracovní poznámka.

Do provozního playbooku napiš svůj způsob práce: jak pojmenováváš úkol, jak vybíráš zdroje, kdy požaduješ citaci, kdy stačí návrh a které akce vždy schvaluješ osobně. Přidej protokol pro konfliktní informace a pravidlo, co se nesmí ukládat do paměti. Onboarding nového zdroje má zahrnout kontrolu přístupu, kvality, duplicity a data revize.

Teď vyber jeden opakovaný týdenní proces. Proveď ho ručně podle playbooku a zaznamenej místa, kde chybí rozhodovací pravidlo. Až potom zapoj agenta. Tvůj systém nemá napodobovat tebe ve všem. Má spolehlivě připravit kontext, zachovat stopu rozhodnutí a uvolnit ti kapacitu tam, kde zůstává odpovědnost jasná.

## AUDIO 10 — Produkční kontrola, incident a release

### Doslovný text

Před produkčním spuštěním si připrav release kartu. Obsahuje vlastníka, verzi workflow, povolené zdroje a nástroje, testovací sadu, rozpočet, limity, schvalovací brány, monitoring a rollback. Úspěšný demo průchod nestačí. Potřebuješ běžné případy, hraniční vstupy, nedostupný nástroj, chybná data i pokus obejít instrukce.

Po spuštění sleduj kvalitu, chybovost, latenci, náklady a počet zásahů člověka. Loguj rozhodnutí a stav nástroje, ne zbytečná citlivá data. Když se objeví incident, nejdřív omez dopad: zastav externí akce, odeber přístup nebo vrať bezpečnou verzi. Potom zachovej důkazy, informuj vlastníka a teprve následně hledej příčinu.

Teď si nahlas dokonči větu: „Systém je připravený, pokud…“ Doplň měřitelná kritéria. Potom: „Systém okamžitě zastavíme, pokud…“ Doplň konkrétní signály. Produkční připravenost není pocit, že už jsme si s agentem dost hráli. Je to schopnost prokázat kvalitu, omezit škodu a bezpečně obnovit službu.
