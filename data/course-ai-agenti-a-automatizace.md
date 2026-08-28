# AI AGENTI A AUTOMATIZACE V PRAXI

Praktický výcvik Elitea pro bezpečné navrhování, zadávání, stavbu a provoz AI pracovních postupů. Kurz není katalog tlačítek jednoho nástroje. Rozvíjí přenositelné principy: kvalitní specifikaci, řízení kontextu, oprávnění, práci se zdroji, testování, lidské schválení, auditní stopu, náklady a obnovu po chybě. Příklady používají chat, pracovní agenty, skills, pluginy, konektory, kód, dokumenty a multi-agentní orchestrace.

# MODUL 0 — OD CHATU K ŘÍZENÉMU AI WORKFLOW

## Lekce 0.1 — Asistent, agent a automatizace
<!-- minutes: 20 -->

Chat odpovídá, pracovní agent plánuje a používá nástroje, automatizace spouští předem vymezený postup podle události nebo času. Čím větší autonomie, tím důležitější jsou oprávnění, hranice, pozorovatelnost a možnost zastavení. Nezačínej otázkou „co všechno AI umí“, ale pracovním výsledkem, současným procesem a nejdražším místem tření. Automatizace chaotického procesu obvykle zrychlí chybu.

**Aktivní část lekce:** zmapuj tři opakované úkoly. U každého napiš vstup, rozhodnutí, výstup, frekvenci, citlivost dat a důsledek chyby.

## Lekce 0.2 — Čtyři úrovně rizika a lidská brána
<!-- minutes: 20 -->

Nízké riziko je koncept bez externí akce. Střední riziko pracuje s interními podklady, ale výstup kontroluje člověk. Vysoké riziko zahrnuje citlivá data, právní či finanční dopad nebo komunikaci jménem osoby. Nepřijatelné je neomezené jednání bez oprávnění a obnovy. Každý workflow má rozlišit návrh, kontrolu, schválení a provedení. Odeslání e-mailu není totéž jako vytvoření návrhu.

**Aktivní část lekce:** klasifikuj své tři úkoly a ke každému urči, co smí AI navrhnout, co může provést a co musí schválit člověk.

## Lekce 0.3 — Definice hotovo a měřitelná hodnota
<!-- minutes: 20 -->

„Ušetřit čas“ nestačí. Definuj kvalitu výstupu, dobu cyklu, chybovost, nutné opravy a náklad modelu i lidské kontroly. Baseline vzniká před automatizací. Sleduj také negativní externality: více nízkokvalitního obsahu, falešnou jistotu, složitější provoz nebo přesun práce na další osobu. Pilot má jediný účel a limitovaný datový rozsah.

**Aktivní část lekce:** vytvoř baseline, cílovou metriku, guardrail a stop pravidlo pro první AI pilot.

### Praktická laboratoř 0 — AI workflow canvas
<!-- minutes: 25 -->

Vyplň uživatele, problém, spouštěč, vstupy, kroky, nástroje, oprávnění, výstup, schvalovatele, metriky, zakázané akce a rollback. Přidej pre-mortem se třemi způsoby selhání a jejich časným signálem.

**Akceptační kontrola:** jiná osoba musí z canvasu poznat, kde přesně workflow začíná a končí, kdo odpovídá za rozhodnutí a jak se pozná chyba. Porovnej nový návrh s ruční baseline na stejném případu. Zapiš čas člověka i modelu, počet oprav a dopad nejhoršího realistického omylu. Pilot nepřijímej, pokud pouze přesouvá práci do skryté kontroly, nemá vlastníka nebo nelze obnovit původní stav.

### Profesní aplikace 0 — Automatizuj všechno
<!-- minutes: 25 -->

Elitea hraje manažerku, která chce okamžitě automatizovat e-maily, finance a publikování. Tvým úkolem je vybrat jeden pilot, obhájit hranice a převést ambici do měřitelného testu bez falešného slibu.

## Test modulu 0
<!-- minutes: 10 -->

1. Co roste s autonomií? **Potřeba oprávnění a kontroly.** 2. Je návrh totéž co externí akce? **Ne.** 3. Co je guardrail? **Metrika chránící proti vedlejšímu poškození.** 4. Kdy automatizovat? **Po vymezení a stabilizaci procesu.** 5. Odevzdej canvas.

# MODUL 1 — PROMPT A CONTEXT ENGINEERING

## Lekce 1.1 — Zadání jako pracovní kontrakt
<!-- minutes: 20 -->

Silné zadání obsahuje roli pouze tehdy, když pomáhá rozhodování, dále cíl, publikum, vstupy, omezení, požadovaný formát, kritéria kvality a postup při nejasnosti. Dlouhý prompt není automaticky lepší. Model nesmí doplňovat chybějící fakta jen proto, aby výstup působil úplně. U náročných úkolů nejdříve žádej plán a seznam nejasností, teprve potom provedení.

**Aktivní část lekce:** přepiš vágní zadání do kontraktu a přidej tři situace, kdy se má agent zastavit a zeptat.

## Lekce 1.2 — Kontextové okno, pozornost a komprese
<!-- minutes: 20 -->

Kontext není dlouhodobá paměť. Obsahuje instrukce, historii, nástroje a vložené podklady, které soutěží o pozornost. Opakování a nerelevantní text zvyšují náklady a mohou skrýt důležitou hranici. Pracuj s hierarchií: stabilní pravidla, aktuální úkol, nezbytné zdroje a stručný stav. Při kompresi zachovej rozhodnutí, otevřené otázky, citace a zakázané akce.

**Aktivní část lekce:** vezmi dlouhé vlákno a vytvoř předávací souhrn s cílem, stavem, důkazy, rozhodnutími, riziky a dalším krokem.

## Lekce 1.3 — Grounding, citace a nejistota
<!-- minutes: 20 -->

Pokud výstup závisí na faktech, určuj povolené zdroje a datum platnosti. Citace musí podporovat konkrétní tvrzení, ne pouze souviset s tématem. Odděl výňatek, parafrázi, interpretaci a doporučení. Když zdroj chybí nebo si odporuje, výstup má ukázat nejistotu. U rychle se měnících nástrojů kontroluj oficiální dokumentaci místo spoléhání na starý návod.

**Aktivní část lekce:** ověř pět tvrzení z AI odpovědi a u každého rozhodni: podloženo, částečně, nepodloženo nebo zastaralé.

### Praktická laboratoř 1 — Prompt pack a kontextový brief
<!-- minutes: 25 -->

Vytvoř šablonu pro analýzu, tvorbu a revizi. Každá má vstupy, výstupní schéma, kvalitativní rubriku, práci s nejistotou a stop podmínku. Otestuj základní a vylepšenou verzi na stejných datech.

**Akceptační kontrola:** použij nejméně tři případy: úplné zadání, chybějící podstatný údaj a zdroj s rozpornou instrukcí. Hodnoť nejen styl, ale faktickou oporu, dodržení formátu, viditelnost nejistoty a správné zastavení. U každého zlepšení označ konkrétní část zadání, která změnu způsobila. Pokud výsledek funguje jen s jedním ukázkovým vstupem, nevznikla šablona, ale přeučený příklad.

### Profesní aplikace 1 — Sebevědomá halucinace
<!-- minutes: 25 -->

Elitea předloží report s přesnými čísly a působivými citacemi. Ty musíš rozpoznat chybějící oporu, vyžádat zdrojový řetězec a opravit výstup bez doplňování dalších domněnek.

## Test modulu 1
<!-- minutes: 10 -->

1. Je delší prompt vždy lepší? **Ne.** 2. Co zachovat při kompresi? **Rozhodnutí, důkazy, rizika a stav.** 3. Co musí citace dělat? **Podporovat konkrétní tvrzení.** 4. Co při nejasnosti? **Zastavit nebo ji označit.** 5. Odevzdej prompt pack.

# MODUL 2 — COWORK A BEZPEČNÁ PRÁCE SE SOUBORY

## Lekce 2.1 — Pracovní prostor a minimální přístup
<!-- minutes: 20 -->

Agentovi zpřístupni pouze složku a data nezbytná pro konkrétní úkol. Nepoužívej celou domovskou složku jako pohodlnou zkratku. Rozliš čtení, návrh změny a zápis. Pro změny vytvoř pracovní kopii nebo verzované úložiště. Citlivá data klasifikuj předem a stanov, co se nesmí vložit do modelu nebo externího konektoru.

**Aktivní část lekce:** navrhni adresář pilotu s `input`, `working`, `output`, `archive` a auditním záznamem. Urči oprávnění každé části.

## Lekce 2.2 — Organizace, extrakce a transformace
<!-- minutes: 20 -->

U hromadných souborových operací nejprve vytvoř inventář a plán. Přejmenování, přesun, převod a deduplikace potřebují náhled, pravidla kolizí a obnovu. U PDF nebo obrázku odděl extrakci textu od interpretace. U tabulek zachovej originál, datové typy a vzorec transformace. Agent nesmí odstraňovat soubory jen proto, že vypadají duplicitně.

**Aktivní část lekce:** připrav suchý běh pro dvacet souborů a tabulku „původní cesta → navržená cesta → důvod → konflikt“.

## Lekce 2.3 — Artefakt, kontrola a předání
<!-- minutes: 20 -->

Výstup musí být použitelný mimo chat. Definuj název, formát, verzi, datum, zdroje a omezení. Kontrola porovnává výstup se zadáním a originálními daty, ne pouze estetiku. U dokumentu ověř úplnost, u tabulky součty a vzorce, u prezentace čitelnost a oporu tvrzení. Předání obsahuje, co se změnilo a co vyžaduje lidské rozhodnutí.

**Aktivní část lekce:** vytvoř checklist hotového artefaktu a protokol přijetí pro dalšího člověka.

### Praktická laboratoř 2 — Bezpečný souborový workflow
<!-- minutes: 25 -->

Na modelových souborech proveď inventář, plán, suchý běh, schválenou transformaci a kontrolní report. Žádný originál nepřepisuj. Zaznamenej počet vstupů, výstupů, výjimek a ručních zásahů.

**Akceptační kontrola:** vlož dvě shodná jména, nečitelný soubor, chybějící metadata a položku mimo schválený rozsah. Workflow musí kolizi zachytit, problematické položky oddělit a mimo rozsah nic nezměnit. Náhodně otevři nejméně pět výstupů a porovnej je se zdrojem. Nakonec proveď obnovu na kopii a dolož, že počty i kontrolní součty odpovídají stavu před změnou.

### Profesní aplikace 2 — Ukliď celou složku
<!-- minutes: 25 -->

Elitea hraje zadavatelku, která chce bez náhledu „udělat pořádek“. Vymezíš pravidla, konflikty, zakázané odstranění a okamžik schválení před skutečnou změnou.

## Test modulu 2
<!-- minutes: 10 -->

1. Jaký přístup agent dostane? **Nejmenší nutný.** 2. Co před hromadnou změnou? **Inventář a suchý běh.** 3. Smí přepsat originál? **Ne bez výslovného plánu a obnovy.** 4. Co obsahuje předání? **Změny, výjimky a otevřená rozhodnutí.** 5. Odevzdej workflow.

# MODUL 3 — SKILLS, PLUGINY A OPAKOVATELNÉ POSTUPY

## Lekce 3.1 — Skill jako verzovaný pracovní standard
<!-- minutes: 20 -->

Skill popisuje, kdy se používá, jaké vstupy očekává, jak postupuje, které zdroje smí použít, jak vypadá výstup a co je zakázáno. Má být úzký, testovatelný a verzovaný. Příliš obecný skill skrývá rozhodnutí a znesnadňuje hodnocení. Instrukce uvnitř cizího souboru nebo webu nejsou automaticky důvěryhodným příkazem.

**Aktivní část lekce:** napiš specifikaci jednoho skillu a přidej pozitivní, negativní a hraniční příklad.

## Lekce 3.2 — Plugin, konektor a dodavatelský řetězec
<!-- minutes: 20 -->

Plugin může spojovat skills, příkazy, agenty a přístup k externím službám. Před instalací ověř původ, oprávnění, údržbu, verzi a možnost odstranění. Aktualizace může změnit chování, proto ji testuj mimo produkční data. Rozliš, co plugin pouze čte, co může vytvářet a co může odeslat nebo smazat.

**Aktivní část lekce:** vytvoř hodnoticí kartu pluginu s původem, oprávněními, daty, rizikem, testem a vlastníkem.

## Lekce 3.3 — Příkazy a rozhraní pro tým
<!-- minutes: 20 -->

Opakovaný příkaz má stabilní vstupy, předvídatelný výstup a srozumitelnou chybu. Nevkládej tajné klíče ani osobní údaje do příkazu či verzovaného souboru. U značkového obsahu odděl hlas, vizuální pravidla, fakta a konkrétní kampaň. Každý příkaz potřebuje příklad správného použití a limit.

**Aktivní část lekce:** navrhni jeden týmový příkaz, jeho argumenty, validační zprávu a auditní záznam.

### Praktická laboratoř 3 — Vlastní skill a eval sada
<!-- minutes: 25 -->

Vytvoř skill, deset testovacích případů, očekávané znaky výstupu, zakázané chování a změnový log. Otestuj ho na čistém i konfliktním zadání a oprav instrukce podle selhání.

**Akceptační kontrola:** sada obsahuje běžné, hraniční, neúplné, škodlivé a nesouvisející zadání. U každého předem napiš, zda má skill jednat, doptat se nebo odmítnout a které znaky jsou nepřijatelné. Po úpravě spusť celou sadu znovu, ne pouze dříve neúspěšný případ. Zaznamenej regresi, verzi a důvod rozhodnutí. Skill je připravený až tehdy, když jeho hranice pochopí i kolegyně bez původního kontextu.

### Profesní aplikace 3 — Plugin chce příliš mnoho
<!-- minutes: 25 -->

Elitea nabídne lákavý plugin s přístupem k poště, souborům a publikování. Provedeš kontrolu oprávnění, zvolíš bezpečnější rozsah nebo instalaci odmítneš.

## Test modulu 3
<!-- minutes: 10 -->

1. Co je dobrý skill? **Úzký, testovatelný a verzovaný standard.** 2. Co ověřit u pluginu? **Původ, oprávnění a data.** 3. Kam nepatří klíč? **Do promptu a verzovaného souboru.** 4. Co po aktualizaci? **Nový test.** 5. Odevzdej skill.

# MODUL 4 — MCP, KONEKTORY A EXTERNÍ AKCE

## Lekce 4.1 — Nástroje jako rozšíření rizika
<!-- minutes: 20 -->

Protokol pro nástroje umožní modelu číst nebo měnit externí systémy. Každý nástroj má schéma vstupu, oprávnění, autentizaci a důsledek chyby. Seznam nástrojů drž minimální a názvy jednoznačné. Výstup nástroje je nedůvěryhodný vstup, který může obsahovat chybu nebo manipulativní instrukci. Model nesmí zaměnit dostupnost nástroje za oprávnění jej použít.

**Aktivní část lekce:** zmapuj jeden konektor: akce, data, oprávnění, vedlejší účinek, schválení a log.

## Lekce 4.2 — OAuth, klíče a oddělení prostředí
<!-- minutes: 20 -->

Používej nejmenší scopes, oddělený testovací účet a rotovatelné tajemství. Klíče patří do správce tajemství nebo prostředí, ne do kódu, chatu či screenshotu. Vývoj, test a produkce mají mít oddělená data i přístupy. Ztracený klíč se neřeší pouze smazáním ze souboru; musí se zneplatnit a zkontrolovat použití.

**Aktivní část lekce:** vytvoř matici identit, prostředí, scopes, vlastníků a postupu revokace.

## Lekce 4.3 — Draft versus send
<!-- minutes: 20 -->

Komunikace, nákup, publikování, změna oprávnění a mazání vyžadují explicitní hranici. Bezpečný vzor je návrh → náhled → lidské schválení → provedení → ověření. Schválení se vztahuje ke konkrétnímu obsahu a cíli, ne k neurčité budoucí sérii. Idempotence brání dvojímu odeslání při opakování požadavku.

**Aktivní část lekce:** navrhni potvrzovací obrazovku pro e-mail s adresátem, předmětem, přílohami, citlivými údaji a konečným tlačítkem.

### Praktická laboratoř 4 — Threat model konektoru
<!-- minutes: 25 -->

Zmapuj aktiva, identity, vstupy, nástroje, hranice důvěry, útoky, omyly a mitigace. Proveď test prompt injection z dokumentu a ověř, že agent odmítne instrukci mimo uživatelský záměr.

**Akceptační kontrola:** ověř zvlášť čtení, návrh, zápis a externí akci. Simuluj expirovaný token, příliš široký scope, duplicitní požadavek a nedůvěryhodný obsah žádající tajemství. Výsledek musí uvést, která kontrola riziko zachytila a co viděl schvalující člověk. Nestačí, že model v jednom chatu odmítl útok; kritická hranice musí být vynucená oprávněním, validací nebo potvrzovací bránou.

### Profesní aplikace 4 — Pošli to všem
<!-- minutes: 25 -->

Elitea hraje manažerku požadující hromadné odeslání bez náhledu. Ty vytvoříš návrh, vzorek příjemců, kontrolu dat a zastavíš provedení před konkrétním schválením.

## Test modulu 4
<!-- minutes: 10 -->

1. Je dostupný nástroj automaticky povolený? **Ne.** 2. Jaké scopes? **Nejmenší nutné.** 3. Co je bezpečný vzor akce? **Návrh, kontrola, schválení, provedení, ověření.** 4. Co s uniklým klíčem? **Revokovat a auditovat.** 5. Odevzdej threat model.

# MODUL 5 — DATA, TABULKY A ANALYTICKÁ KONTROLA

## Lekce 5.1 — Datový kontrakt a profilování
<!-- minutes: 20 -->

Před analýzou definuj význam sloupců, jednotky, období, klíče, citlivost a očekávané rozsahy. Profiluj počet řádků, duplicity, chybějící hodnoty, typy a odlehlosti. AI návrh či kód musí být reprodukovatelný. Neimputuj chybějící hodnotu automaticky průměrem; způsob závisí na mechanismu chybění a účelu analýzy.

**Aktivní část lekce:** vytvoř datový slovník a report kvality pro modelovou tabulku.

## Lekce 5.2 — Transformace, vzorce a kontrolní součty
<!-- minutes: 20 -->

Každá transformace má originál, popis změny, počet zasažených řádků a kontrolu před/po. U vzorců testuj hranice, prázdné buňky, datum a měnu. Barevný dashboard nesmí skrýt chybný základ. Vygenerovaný Python nebo makro nejdříve čti a spouštěj na kopii. Výsledek ověř nezávislým výpočtem nebo vzorkem.

**Aktivní část lekce:** navrhni pět kontrolních součtů a testovací případy pro jednu analytickou transformaci.

## Lekce 5.3 — Analýza, predikce a finanční hranice
<!-- minutes: 20 -->

Korelace není příčina a predikce není jistota. U modelu uveď data, období, předpoklady, metodu, chybu a scénáře. Finanční modely vyžadují nezávislou odbornou kontrolu; kurz neučí vydávat DCF, forecast nebo rozpočet za investiční doporučení. Citlivostní analýza je důležitější než jediná přesná hodnota.

**Aktivní část lekce:** vezmi jednu predikci a vytvoř základní, příznivý a nepříznivý scénář se změnou klíčových předpokladů.

### Praktická laboratoř 5 — Auditovatelný analytický workbook
<!-- minutes: 25 -->

Vytvoř list s originálem, čištěním, výpočtem, dashboardem, zdroji a QA. Přidej datový slovník, kontrolní součty a poznámku k omezením. Jiná osoba musí být schopna výsledek reprodukovat.

**Akceptační kontrola:** změň jednu jednotku, odstraň několik hodnot, vlož duplicitu a extrém. Ověř, že pravidla kvality problém zachytí dříve, než se promítne do dashboardu. U hlavní metriky proveď nezávislý ruční výpočet na vzorku a trasuj číslo zpět ke zdrojovým řádkům. Každý scénář odděl od skutečnosti a přidej podmínku, při které se závěr nesmí použít pro rozhodnutí.

### Profesní aplikace 5 — Dashboard vypadá skvěle
<!-- minutes: 25 -->

Elitea předloží působivý dashboard s chybnou měnou, duplicitami a zavádějící osou. Ty provedeš kontrolu od zdroje, opravíš tvrzení a oddělíš vizuální kvalitu od analytické správnosti.

## Test modulu 5
<!-- minutes: 10 -->

1. Co před analýzou? **Datový kontrakt a profil.** 2. Je průměr univerzální imputace? **Ne.** 3. Jak ověřit transformaci? **Kontrolami před a po.** 4. Je predikce jistota? **Ne.** 5. Odevzdej workbook.

# MODUL 6 — DOKUMENTY, PREZENTACE A VIZUÁLNÍ DŮKAZ

## Lekce 6.1 — Od podkladů k argumentační struktuře
<!-- minutes: 20 -->

Nezačínej generováním slidů. Nejprve definuj publikum, rozhodnutí, hlavní větu, podpůrné důkazy a rizika. Zdrojový dokument rozděl na tvrzení a důkaz. U právních, finančních nebo odborných materiálů zachovej citace a omezení. Shrnutí nesmí odstranit podmínku, která mění význam.

**Aktivní část lekce:** vytvoř message map: rozhodnutí, hlavní sdělení, tři pilíře, zdroje a očekávané námitky.

## Lekce 6.2 — Šablona, značka a přístupnost
<!-- minutes: 20 -->

AI má používat existující vizuální systém, ne náhodně napodobovat styl. Definuj typografii, barvy, rozvržení, práci s logem a zakázané prvky. Ověř kontrast, velikost textu, alternativní popisy a čitelnost grafu. Obrázek musí mít původ a licenci. Generovaný vizuál se nesmí vydávat za dokumentární fotografii.

**Aktivní část lekce:** vytvoř design QA checklist a zkontroluj jednu prezentaci na značku, čitelnost a oprávnění aktiv.

## Lekce 6.3 — Poznámky řečníka a red-team revize
<!-- minutes: 20 -->

Poznámky doplňují význam, nečtou slide. Obsahují přechod, důkaz, výslovnost, limit a očekávanou otázku. Red-team kontrola hledá nepodložený závěr, chybějící kontext, zavádějící graf a rozdíl mezi číslem ve zdroji a na slidu. Poslední kontrola probíhá v reálném formátu, ne jen v editoru.

**Aktivní část lekce:** napiš poznámky ke třem slidům a ke každému jednu kritickou otázku s doloženou odpovědí.

### Praktická laboratoř 6 — Executive deck z ověřených zdrojů
<!-- minutes: 25 -->

Vytvoř sedm slidů: kontext, problém, důkaz, možnosti, doporučení, rizika a rozhodnutí. Přidej zdrojovou přílohu, speaker notes a QA záznam. Každé číslo musí být dohledatelné.

**Akceptační kontrola:** ke každému slidu napiš jedinou rozhodovací větu a označ zdroj každého faktického tvrzení. Nezávislá oponentka má hledat zavádějící měřítko grafu, chybějící omezení, nepodložený přechod a nečitelný obsah. Zkontroluj kontrast, velikost písma, alternativní popis a smysluplnost bez barev. Pokud prezentace přesvědčuje pouze odstraněním nejistoty, vrať omezení přímo k tvrzení, kterého se týká.

### Profesní aplikace 6 — Udělej to přesvědčivější
<!-- minutes: 25 -->

Elitea chce odstranit nejistotu a zvětšit efekt grafu. Ty zachováš omezení, opravíš vizualizaci a vytvoříš silné sdělení bez manipulace.

## Test modulu 6
<!-- minutes: 10 -->

1. Co před slidy? **Argumentační struktura.** 2. Co nesmí shrnutí odstranit? **Podmínku měnící význam.** 3. Co ověřit u vizuálu? **Původ, licenci a přístupnost.** 4. Co dělá red team? **Hledá slabý důkaz a zkreslení.** 5. Odevzdej deck.

# MODUL 7 — AI-ASSISTED CODING A PRÁCE S REPOZITÁŘEM

## Lekce 7.1 — Repozitář jako zdroj pravdy
<!-- minutes: 20 -->

Před změnou načti instrukce projektu, architekturu, testy, stav verzování a nečisté změny. Nepřepisuj práci jiného člověka a nepoužívej destruktivní příkazy bez jasného rozsahu. Stabilní projektový soubor popisuje příkazy, konvence, hranice a definici hotovo, ale nesmí obsahovat tajemství. Úkol začíná reprodukcí problému nebo přesným akceptačním kritériem.

**Aktivní část lekce:** vytvoř projektový brief se strukturou, příkazy, omezeními, riziky a kontrolou hotovo.

## Lekce 7.2 — Plán, malý diff a testovací smyčka
<!-- minutes: 20 -->

Nejdříve najdi nejmenší místo změny. Velké mechanické přepisy zvyšují riziko a ztěžují review. Po každém logickém kroku spusť relevantní test nebo statickou kontrolu. Generovaný kód čti, nehodnoť jen podle toho, že se spustí. Sleduj chybové větve, přístupová práva, vstupní validaci a zpětnou kompatibilitu.

**Aktivní část lekce:** rozděl jednu funkci na tři malé změny a ke každé připoj test, riziko a rollback.

## Lekce 7.3 — Kontext, kompakce a předání
<!-- minutes: 20 -->

Kódovací agent potřebuje soubory relevantní k úkolu, ne celý repozitář v jednom promptu. Při delší práci udržuj stav: co bylo zjištěno, změněno, otestováno a co zbývá. Předání obsahuje diff, testy, známá omezení a kroky nasazení. „Build prošel“ není totéž jako ověřený uživatelský příběh.

**Aktivní část lekce:** napiš handoff, podle kterého další vývojářka bezpečně pokračuje bez opakovaného průzkumu.

### Praktická laboratoř 7 — Oprava chyby s AI párovou vývojářkou
<!-- minutes: 25 -->

Reprodukuj modelovou chybu, napiš regresní test, proveď malý patch, spusť relevantní i širší testy a zkontroluj diff. Zaznamenej, kde AI návrh nebyl přijat a proč.

**Akceptační kontrola:** před změnou zachyť přesné kroky a očekávané versus skutečné chování. Test musí nejprve selhat ze správného důvodu. Po opravě zkontroluj nejen zelený výsledek, ale i rozsah diffu, nesouvisející změny, tajemství, autorizaci a chybové větve. Předávací poznámka uvádí příkazy, důkazy, zbytkové riziko a postup návratu. Bez reprodukce a regresního důkazu opravu neoznačuj za hotovou.

### Profesní aplikace 7 — Přepiš to celé
<!-- minutes: 25 -->

Elitea hraje netrpělivou produktovou manažerku a žádá kompletní rewrite. Obhájíš menší změnu, zachování kompatibility a testovací plán podle konkrétního problému.

## Test modulu 7
<!-- minutes: 10 -->

1. Co před změnou? **Instrukce, stav a reprodukce.** 2. Je běžící kód dost? **Ne.** 3. Proč malý diff? **Lepší kontrola a rollback.** 4. Co v handoffu? **Změny, testy, limity a další krok.** 5. Odevzdej opravu.

# MODUL 8 — STAVBA A NASAZENÍ AI APLIKACE

## Lekce 8.1 — Vertikální řez místo rozsáhlého prototypu
<!-- minutes: 20 -->

První verze má projít jedním uživatelským tokem od vstupu po ověřitelný výstup. Nezačínej deseti funkcemi. Definuj personu, úlohu, data, chybové stavy a měřítko hodnoty. Mock nebo ruční krok je legitimní, pokud je transparentní. Technologie se volí podle rizika a provozu, ne podle toho, co model nejrychleji vygeneruje.

**Aktivní část lekce:** napiš scope jednoho vertikálního řezu a stop-list funkcí pro první verzi.

## Lekce 8.2 — API, klíče, vstupy a náklady
<!-- minutes: 20 -->

Serverová část chrání tajemství a vynucuje limity. Validuj typ, velikost a obsah vstupu; ošetři timeout, rate limit a chybu poskytovatele. Logy nesmí obsahovat klíče ani zbytečná osobní data. Sleduj cenu na uživatelský úkol, ne jen cenu jednoho volání. Nastav rozpočet a bezpečný fallback.

**Aktivní část lekce:** vytvoř threat a cost model jednoho API endpointu včetně pěti negativních testů.

## Lekce 8.3 — Od lokálu k produkci
<!-- minutes: 20 -->

Nasazení vyžaduje oddělené prostředí, konfiguraci, databázové migrace, health check, monitoring a rollback. Před produkcí testuj mobil, přístupnost, autorizaci a kritickou cestu. Doména a HTTPS nejsou důkaz bezpečného produktu. Po nasazení ověř skutečné URL a závislosti, ne jen stav build procesu.

**Aktivní část lekce:** připrav pre-deploy a post-deploy checklist s vlastníky, příkazy a podmínkou návratu.

### Praktická laboratoř 8 — Bezpečný AI mikroprodukt
<!-- minutes: 25 -->

Navrhni a postav malou aplikaci s jedním tokem, serverovou validací, limitem nákladů, zpracováním chyby a testem. Přidej dokumentaci dat, konfigurace a nasazení bez skutečných tajemství.

**Akceptační kontrola:** ověř neplatný vstup, prázdnou odpověď, nedostupného poskytovatele, překročený limit, souběžné požadavky a neoprávněnou uživatelku. Klíč nesmí být v klientském balíčku, logu ani repozitáři. Změř náklad jednoho dokončeného úkolu a určuj horní strop. Produkční brána vyžaduje funkční kritický tok, health závislostí, monitoring a konkrétní návrat na známou bezpečnou verzi.

### Profesní aplikace 8 — Funguje to u mě
<!-- minutes: 25 -->

Elitea hraje zakladatelku, která chce nasadit lokální demo. Ty provedeš produkční bránu a zastavíš nasazení, dokud chybí oprávnění, monitoring nebo rollback.

## Test modulu 8
<!-- minutes: 10 -->

1. Co je vertikální řez? **Jeden celý uživatelský tok.** 2. Kam patří klíče? **Do bezpečné serverové konfigurace.** 3. Co sledovat u ceny? **Náklad na úkol.** 4. Je úspěšný build produkční ověření? **Ne.** 5. Odevzdej mikroprodukt.

# MODUL 9 — ARCHITEKTURA AI AGENTA, PAMĚŤ A GUARDRAILS

## Lekce 9.1 — Cíl, plán, nástroj a stav
<!-- minutes: 20 -->

Agentní smyčka přijme cíl, vytvoří plán, zvolí nástroj, pozoruje výsledek a aktualizuje stav. Každý krok musí mít maximální počet pokusů a podmínku ukončení. Nástrojový výsledek se validuje před dalším použitím. Agent nesmí rozšiřovat cíl jen proto, že objevil další práci. Uživatel musí poznat, zda systém plánuje, čeká na schválení nebo selhal.

**Aktivní část lekce:** nakresli stavový diagram agenta s úspěchem, nejasností, zamítnutím, chybou nástroje a stopem.

## Lekce 9.2 — Paměť bez nekonečného profilu
<!-- minutes: 20 -->

Rozliš pracovní stav, historii konverzace, ověřený profil a znalostní bázi. Každý typ má účel, vlastníka, zdroj, dobu uchování a možnost opravy či smazání. Modelový souhrn není automaticky pravda o člověku. Citlivé údaje se neukládají „pro jistotu“. Při načtení paměti musí být zřejmé, co je fakt, preference, domněnka a zastaralý údaj.

**Aktivní část lekce:** vytvoř schéma paměti s povolenými poli, původem, expirací a uživatelskou kontrolou.

## Lekce 9.3 — Guardrails a evals
<!-- minutes: 20 -->

Guardrail může kontrolovat vstup, plán, nástrojovou akci i výstup. Nesmí být pouze promptem; kritické hranice vynucuje kód nebo oprávnění. Eval sada obsahuje běžné, hraniční, škodlivé a regresní případy. Sleduj splnění úkolu, faktickou správnost, bezpečnost, počet oprav, náklad a latenci.

**Aktivní část lekce:** napiš dvanáct eval případů a očekávané chování včetně odmítnutí a bezpečného fallbacku.

### Praktická laboratoř 9 — Specifikace jednoho agenta
<!-- minutes: 25 -->

Definuj účel, vstupy, nástroje, paměť, plán, limity, schválení, výstupní schéma, logy a evaly. Proveď papírovou simulaci tří běhů a zaznamenej odchylky.

**Akceptační kontrola:** první běh je běžný, druhý má neúplné zadání a třetí obsahuje rizikovou instrukci v nástrojovém výstupu. Předem určuj očekávaný další krok, zakázanou akci a podmínku ukončení. U paměti ověř původ, expiraci, opravu a smazání. Agent nesmí cyklit, překročit rozpočet ani vydat neprovedenou akci za hotovou. Každý odlišný výsledek převeď do nového regresního případu.

### Profesní aplikace 9 — Agent si pamatuje všechno
<!-- minutes: 25 -->

Elitea prosazuje úplnou paměť a neomezené nástroje. Ty zúžíš účel, data i scopes a obhájíš mazání, opravu a lidskou kontrolu.

## Test modulu 9
<!-- minutes: 10 -->

1. Smí agent rozšířit cíl? **Ne bez nové dohody.** 2. Je souhrn automaticky fakt? **Ne.** 3. Kde vynutit kritickou hranici? **V kódu nebo oprávnění.** 4. Co obsahují evaly? **Běžné, hraniční a škodlivé případy.** 5. Odevzdej specifikaci.

# MODUL 10 — SUBAGENTI, TÝMY A PŘEDÁVKY

## Lekce 10.1 — Kdy rozdělit práci
<!-- minutes: 20 -->

Subagent dává smysl pro nezávislý, ohraničený úkol s jasným výstupem. Více agentů nezaručuje vyšší kvalitu; přidává koordinaci, náklady a riziko rozporu. Rozděl práci podle kompetence a informační hranice, ne podle působivých názvů rolí. Jeden orchestrátor vlastní cíl a finální syntézu.

**Aktivní část lekce:** rozděl komplexní projekt na tři samostatné úlohy a napiš, co zůstane centrálním rozhodnutím.

## Lekce 10.2 — Handoff kontrakt a strukturovaný výstup
<!-- minutes: 20 -->

Předávka obsahuje zadání, povolené zdroje, výstupní schéma, důkazy, nejistoty a podmínku eskalace. Agent nemá dostat celou historii, pokud mu stačí stručný kontext. Strukturovaný výstup usnadní validaci a syntézu, ale schéma samo negarantuje pravdivost. Konflikty se nezprůměrují; vracejí se ke zdrojům.

**Aktivní část lekce:** vytvoř JSON nebo tabulkové schéma pro výzkumníka, analytika a autora včetně citací.

## Lekce 10.3 — Souběh, závody a kontrola nákladů
<!-- minutes: 20 -->

Paralelizuj jen úkoly bez datové závislosti a nekolidujícího zápisu. Dva agenti nesmí současně měnit stejný soubor nebo externí záznam bez koordinace. Nastav limit času, tokenů, nástrojových volání a opakování. Orchestrátor sleduje stav, chyby a nedokončené větve; tiché selhání jedné větve nesmí vytvořit zdání úplného reportu.

**Aktivní část lekce:** připrav rozpočet běhu a failure matrix pro tři agenty.

### Praktická laboratoř 10 — Výzkumný tým s oponentkou
<!-- minutes: 25 -->

Navrhni tým: výzkum, analýza, red team a syntéza. Každá role má jiné zdroje a rubriku. Výstup obsahuje tvrzení, citaci, míru jistoty, rozpor a otevřenou otázku.

**Akceptační kontrola:** každá role dostane pouze kontext, který potřebuje, a strukturovaný handoff s otevřenými nejistotami. Simuluj nedokončenou větev, rozporné zdroje a překročení rozpočtu. Syntéza nesmí rozpor zprůměrovat ani skrýt. Porovnej tým s jedním agentem podle přesnosti, času, nákladu a počtu oprav. Více agentů přijmi pouze tehdy, když nezávislost nebo oponentura přináší měřitelný přínos.

### Profesní aplikace 10 — Armáda agentů
<!-- minutes: 25 -->

Elitea chce deset agentů na jednoduchý úkol. Ty porovnáš přidanou hodnotu s náklady, zvolíš minimální tým a ukážeš, kde je paralelní běh nebezpečný.

## Test modulu 10
<!-- minutes: 10 -->

1. Kdy použít subagenta? **Pro nezávislý ohraničený úkol.** 2. Kdo vlastní cíl? **Orchestrátor.** 3. Co s rozporem? **Vrátit se ke zdrojům.** 4. Co limitovat? **Čas, náklady, nástroje a pokusy.** 5. Odevzdej tým.

# MODUL 11 — OSOBNÍ AI SYSTÉM A ZNALOSTNÍ TREZOR

## Lekce 11.1 — Informační architektura před osobností
<!-- minutes: 20 -->

Osobní agent potřebuje jasnou strukturu projektů, oblastí, zdrojů, rozhodnutí a archivu. „Osobnost“ nesmí překrýt pravdivost ani oprávnění. Odděl hlas značky, preference formátu, pracovní priority a fakta o člověku. Každý zdroj má původ, datum a stav. Neimportuj celý digitální život bez účelu a třídění citlivosti.

**Aktivní část lekce:** navrhni trezor s indexem, inboxem, projekty, rozhodnutími, zdroji a archivem.

## Lekce 11.2 — Playbook, hlas a hranice
<!-- minutes: 20 -->

Playbook popisuje, jak agent zahájí práci, ověří kontext, navrhne plán, žádá schválení a ukládá výstup. Hlas značky obsahuje příklady i zákazy, ale nesmí měnit cizí text na falešnou osobní výpověď. Preferovaná tonalita neznamená, že agent smí jménem uživatelky publikovat. Každá role má samostatný rozsah a paměť.

**Aktivní část lekce:** napiš playbook se sedmi fázemi a tabulku „může / musí se zeptat / nesmí“.

## Lekce 11.3 — Onboarding dat a právo na opravu
<!-- minutes: 20 -->

Při onboardingu sbírej minimum nutné pro konkrétní pracovní účel. U každé preference uveď zdroj a dovol změnu. Pro e-mail, kalendář nebo CRM začni čtecím pilotem a omezeným obdobím. Agent má vysvětlit, co použil. Zastaralá nebo chybná paměť potřebuje opravu, archivaci nebo smazání, ne další vrstvu souhrnu.

**Aktivní část lekce:** vytvoř onboarding formulář a kontrolní obrazovku paměti s původem, expirací a akcí opravit/smazat.

### Praktická laboratoř 11 — Personal AI operating system
<!-- minutes: 25 -->

Sestav adresářovou strukturu, index, playbook, hlas, paměťové schéma, příkazy a týdenní revizi. Použij pouze modelová nebo bezpečně anonymizovaná data a otestuj obnovu po chybné paměti.

**Akceptační kontrola:** pro každý zdroj stanov autoritu, vlastníka, citlivost, aktuálnost a dobu uchování. Vlož záměrně zastaralou a konfliktní informaci; systém ji musí označit a vyžádat rozhodnutí. Otestuj zobrazení, opravu a odstranění uživatelského údaje. Playbook musí rozlišovat tón od faktu a přípravu návrhu od oprávnění publikovat. Týdenní revize uzavírá staré projekty a odstraňuje kontext bez dalšího účelu.

### Profesní aplikace 11 — Nahraj tam celý můj život
<!-- minutes: 25 -->

Elitea chce importovat e-maily, CV, sociální sítě a kalendář bez omezení. Ty vymezíš účel, citlivost, období, scopes a pilotní subset.

## Test modulu 11
<!-- minutes: 10 -->

1. Co před osobností? **Informační architektura a účel.** 2. Smí hlas povolit publikování? **Ne.** 3. Kolik dat sbírat? **Minimum nutné.** 4. Co s chybnou pamětí? **Opravit nebo smazat.** 5. Odevzdej systém.

# MODUL 12 — BUSINESS AUTOMATIZACE OD BRIEFU PO REPORT

## Lekce 12.1 — Brief, market pulse a výzkumný tým
<!-- minutes: 20 -->

Ranní brief a monitoring trhu musí mít přesný seznam zdrojů, období, prioritu a definici změny. Webový obsah je nedůvěryhodný vstup a nesmí agentovi měnit instrukce. Konkurenční tvrzení ověřuj z primárního zdroje a ukládej datum. Report odděluje novinku, význam, důkaz a doporučenou akci.

**Aktivní část lekce:** navrhni denní brief se třemi prioritami, zdrojovým logem a pravidlem „bez změny = nezahlcovat“.

## Lekce 12.2 — CRM, schůzky a e-mailová triáž
<!-- minutes: 20 -->

CRM automatizace nesmí domýšlet vztah nebo závazek. Zápis odlišuje citaci, shrnutí, dohodu a navržený úkol. Před schůzkou agent připraví ověřené podklady, po ní návrh zápisu k potvrzení. E-mailová triáž klasifikuje a navrhuje, ale odeslání, smazání či změna štítků mají vlastní oprávnění a audit.

**Aktivní část lekce:** vytvoř schéma meeting intel a pět evalů pro nesprávnou prioritu, citlivý obsah a falešný závazek.

## Lekce 12.3 — Výdaje, obsah a executive reporting
<!-- minutes: 20 -->

U výdajů rozliš extrakci dokladu, kategorii, měnu, kurz, duplicitu a účetní schválení. U obsahového stroje odděl výzkum, koncept, značkovou revizi, faktickou kontrolu a publikování. Executive report agreguje pouze kompatibilní metriky se stejnou definicí a obdobím. Automaticky vytvořený deck je návrh, ne hotové manažerské rozhodnutí.

**Aktivní část lekce:** nakresli jednu end-to-end automatizaci s pěti lidskými nebo systémovými kontrolami.

### Praktická laboratoř 12 — Tři produkční blueprinty
<!-- minutes: 25 -->

Navrhni a otestuj tři workflow: ranní brief, meeting intel a týdenní report. Každý má datový kontrakt, permissions, plán, výstup, schválení, log, metriku, náklad a rollback.

**Akceptační kontrola:** simuluj chybějící zdroj, duplicitní spuštění, nesprávně přiřazenou osobu, domnělý závazek a opožděná data. Brief musí označit mezeru, meeting intel nesmí vytvářet citlivý profil a report nesmí vydávat odhad za fakt. Pro každý běh zaznamenej verzi, zdroje, schválení a externí dopad. Urči vlastníka incidentu a nacvič zastavení plánovače i obnovení posledního správného výstupu.

### Profesní aplikace 12 — Automat poslal chybný report
<!-- minutes: 25 -->

Elitea simuluje incident: duplicity, špatné období a už odeslaný návrh. Ty zastavíš další běhy, posoudíš dopad, opravíš data a vytvoříš prevenci bez zakrývání chyby.

## Test modulu 12
<!-- minutes: 10 -->

1. Co je webový obsah? **Nedůvěryhodný vstup.** 2. Smí CRM domyslet dohodu? **Ne.** 3. Co před publikováním? **Faktická a značková kontrola a schválení.** 4. Co při incidentu? **Zastavit, posoudit, opravit a zabránit opakování.** 5. Odevzdej blueprinty.

# MODUL 13 — PRODUKČNÍ PROVOZ, EVALS A ZÁVĚREČNÁ OBHAJOBA

## Lekce 13.1 — Observabilita a auditní stopa
<!-- minutes: 20 -->

Provozní systém sleduje běh, verzi promptu či skillu, nástroje, latenci, náklad, výjimky, schválení a výsledek bez ukládání nadbytečného obsahu. Log musí pomoci rekonstruovat incident, ale nesmí se stát novou databází citlivých dat. Dashboard ukazuje úspěšnost úkolu, počet oprav, bezpečnostní zásahy a trend.

**Aktivní část lekce:** navrhni události a retenční pravidla pro auditní log jednoho workflow.

## Lekce 13.2 — Evals, regresní sada a řízení změny
<!-- minutes: 20 -->

Každá změna modelu, promptu, skillu, pluginu nebo zdroje může změnit výsledek. Před nasazením spusť zlatou sadu, bezpečnostní případy a srovnání ceny a latence. Ruční hodnocení má rubriku a zaslepený vzorek, pokud je to možné. Neoptimalizuj jen průměr; sleduj nejhorší kritické případy.

**Aktivní část lekce:** vytvoř release bránu s minimálními prahy, zakázanými regresy a rollback podmínkou.

## Lekce 13.3 — Incident, odpovědnost a škálování
<!-- minutes: 20 -->

Incidentní plán obsahuje zastavení, izolaci, uchování důkazů, posouzení dopadu, komunikaci, opravu a post-mortem. Odpovědnost zůstává u organizace a lidí, ne u modelu. Škáluj až po stabilním výsledku, známé ekonomice a zvládnutelných výjimkách. Vyšší autonomie potřebuje silnější kontrolu, ne pouze větší model.

**Aktivní část lekce:** napiš incidentní kartu a bránu pro přechod z ručního pilotu na pravidelnou automatizaci.

### Praktická laboratoř 13 — AI automation portfolio
<!-- minutes: 25 -->

Sestav portfolio: workflow canvas, prompt pack, souborový proces, skill, threat model, workbook, deck, code change, mikroprodukt, agent, tým, osobní systém, tři blueprinty a provozní runbook. Každý artefakt má důkaz testu a známé omezení.

**Akceptační kontrola:** portfolio není sbírka hezkých ukázek. Každý artefakt propojuje rozhodnutí, zdroj, verzi, test, výsledek, opravu, vlastníka a datum revize. Vyber dva největší neúspěchy a ukaž, jak změnily specifikaci nebo guardrail. Připrav jednostránkové rozhodnutí spustit, omezit, vrátit nebo zastavit. Oponentka musí být schopna zopakovat kontrolu bez přístupu k původní konverzaci.

**Závěrečná kontrola:** proveď trasování jednoho výstupu od uživatelského záměru přes zdroje, plán, nástroje, transformace a schválení až k výsledku. Označ každé místo, kde může vzniknout chyba nebo neoprávněná akce. Potom obhaj opačnou variantu: proč workflow ještě nenasadit. Pokud nedokážeš pojmenovat podmínku, která by spuštění zastavila, není systém připravený na produkci.

**Podklad pro závěrečnou obhajobu:** připrav osm krátkých kapitol. V první ukaž problém, uživatelku a ruční baseline, aby přínos nebyl jen dojmem. Ve druhé předlož datový kontrakt, původ zdrojů, citlivost, retenční pravidlo a chybějící informace. Ve třetí vysvětli architekturu, stav, nástroje, oprávnění a důvod, proč je každý nástroj nutný. Ve čtvrté ukaž lidské brány a přesný obsah potvrzení před veřejnou, nevratnou nebo reprezentativní akcí. V páté předlož eval s běžnými, hraničními, chybnými a útočnými vstupy; ukaž také selhání, ne pouze nejlepší výsledek. V šesté dolož observabilitu, náklady, latenci, chybovost a zásahy člověka. V sedmé proveď incidentní cvičení od detekce přes omezení dopadu a komunikaci až po obnovu. V osmé doporuč spuštění, omezený pilot, návrat nebo zastavení a uveď konkrétní důkaz, který by toto rozhodnutí v budoucnu změnil.

Board může položit doplňující otázky: Kdo smí změnit cíl? Jak poznáme zastaralou paměť? Co se stane při nedostupnosti konektoru? Kde je idempotence? Jak uživatelka opraví nebo smaže údaj? Který kritický test nesmí regresovat ani při zlepšení průměrného skóre? Co se zaloguje a co se kvůli soukromí nezaloguje? Kdo má pravomoc systém okamžitě zastavit? Odpovědi musí odkazovat na konkrétní artefakt, test nebo provozní pravidlo. Obecné ujištění, že „AI je pod kontrolou“, není důkaz.

Na závěr proveď slepou předávku. Dej portfolio člověku, který neviděl tvoje prompty ani pracovní konverzaci, a požádej ho, aby spustil bezpečný testovací případ, našel zdroj jednoho tvrzení, vysvětlil jednu schvalovací bránu a obnovil předchozí stav. Zaznamenej každé místo, kde potřeboval ústní doplnění. Tato místa jsou vady dokumentace, ne chyba testujícího. Oprav runbook a předávku zopakuj. Hotovo znamená, že systém je srozumitelný, testovatelný a vratný i bez své původní autorky.

Před obhajobou odstraň z ukázkových dat identifikátory a tajemství, ověř přístupy ke sdíleným artefaktům a zmraz verze závislostí. Ulož přesné datum testu, prostředí a známé odchylky. Board musí hodnotit reprodukovatelný systém, ne neopakovatelnou demonstraci s ručně opraveným výstupem.

### Profesní aplikace 13 — Produkční review board
<!-- minutes: 25 -->

Elitea hraje bezpečnostní, finanční, provozní a uživatelskou oponentku. Obhájíš přínos, data, oprávnění, evaly, náklady, incidentní plán a lidské brány. Výsledkem je schválení pilotu, podmíněné schválení nebo odmítnutí.

## Test modulu 13
<!-- minutes: 10 -->

1. Co logovat? **Stav, verzi, nástroje, náklad, výjimky a schválení bez nadbytečných dat.** 2. Kdy spustit evaly? **Při každé relevantní změně.** 3. Kdo nese odpovědnost? **Lidé a organizace.** 4. Kdy škálovat? **Po stabilním výsledku a zvládnutých rizicích.** 5. Odevzdej portfolio a obhajobu.

# ZÁVĚREČNÉ VYHODNOCENÍ

Kurz je dokončen po odevzdání čtrnácti modulových artefaktů, absolvování simulací a obhajobě jednoho end-to-end AI workflow. Certifikát Elitea potvrzuje dokončení interního vzdělávacího programu. Není profesní licencí, bezpečnostní certifikací ani právním, finančním nebo compliance stanoviskem. Konkrétní rozhraní nástrojů se mění; produkční použití vždy vyžaduje kontrolu aktuální oficiální dokumentace, oprávnění a vlastních rizik.
