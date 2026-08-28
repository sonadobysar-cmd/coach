# GENERATIVNÍ AI PRO MARKETING, TVORBU A BYZNYS

Komplexní výcvik Elitea pro lidi, kteří chtějí generativní AI používat jako pracovní systém, ne jako automat na první odpověď. Kurz propojuje text, výzkum, data, marketing, obraz, video, audio, automatizaci a tvorbu digitálních řešení. Každý výstup musí mít jasného příjemce, zdroje, kontrolu kvality, oprávnění, ekonomiku a lidské rozhodnutí. Konkrétní nástroje se mění; přenositelné principy, důkazní standard a bezpečné workflow zůstávají.

# MODUL 0 — AI GRAMOTNOST A PRACOVNÍ KONTRAKT

## Lekce 0.1 — Co generativní model dělá a co neví
<!-- minutes: 30 -->

Jazykový model vytváří pravděpodobné pokračování podle zadání a kontextu. Nepracuje automaticky s pravdou, aktuálností ani záměrem uživatelky. Plynulý text může obsahovat neověřený fakt, falešnou citaci nebo chybný výpočet. Rozlišuj generování, vyhledávání, výpočet, klasifikaci a externí akci. Každá činnost potřebuje jiný zdroj a jinou kontrolu. U citlivého tématu nestačí lepší prompt; musíš změnit zdroj, nástroj nebo zapojit kompetentního člověka.

**Aktivní část lekce:** roztřiď dvanáct pracovních úloh podle toho, zda potřebují generování, primární zdroj, deterministický výpočet, lidské rozhodnutí nebo kombinaci.

## Lekce 0.2 — Od přání k měřitelnému AI use case
<!-- minutes: 30 -->

„Chci používat AI“ není use case. Popiš uživatele, současný proces, bolest, požadovanou změnu, vstupy, výstup, příjemce a rozhodnutí, které výstup podpoří. Změř baseline času, kvality, nákladů a chyb. Potom definuj cílový stav a guardraily: co se nesmí zhoršit, co model nesmí dělat a kdy se práce vrací člověku. Automatizuj až po pochopení procesu; chaos provedený rychleji zůstává chaosem.

**Aktivní část lekce:** přepiš tři vágní nápady do use-case kontraktu s baseline, metrikou, guardrailem, vlastníkem a stop pravidlem.

## Lekce 0.3 — Volba modelu, nástroje a úrovně autonomie
<!-- minutes: 30 -->

Nástroj vybírej podle dat, potřebné aktuálnosti, délky kontextu, modality, integrací, ceny, latence, auditovatelnosti a oprávnění, ne podle obecného žebříčku. Rozliš jednorázový chat, opakovatelnou šablonu, projekt s kontextem, asistenta se znalostmi, workflow s nástroji a agenta s externí akcí. Čím vyšší autonomie a dopad, tím silnější evaly, schvalovací brány, logování a možnost návratu. Každá úroveň také potřebuje známého provozního vlastníka, rozpočet, datum revize a bezpečné ukončení.

**Aktivní část lekce:** pro pět use cases vyber nejnižší postačující úroveň systému a napiš, proč vyšší autonomie zatím není oprávněná.

### Praktická laboratoř 0 — AI opportunity & risk brief
<!-- minutes: 45 -->

Vytvoř jednostránkový brief pro jeden skutečný proces: uživatel, workflow před změnou, baseline, cílový výsledek, vhodné a nevhodné úlohy pro AI, data, zdroje, příjemce, metriky kvality, náklady, rizika, lidské brány a první ohraničený test.

**Akceptační kontrola:** jiná osoba musí poznat, co model vytvoří, co pouze navrhne a co nikdy nesmí provést. Každé tvrzení o úspoře má baseline a způsob měření. Brief nepřijímej bez vlastníka, zakázaných akcí, nepříznivého scénáře a podmínky, kdy se AI nepoužije.

**Důkazní standard:** odděl pozorovaný proces, odhad přínosu a dodavatelské tvrzení. U každé metriky uveď zdroj, období a vlastníka. Pilot musí umožnit tři legitimní závěry: pokračovat, upravit nebo zastavit.

### Profesní aplikace 0 — AI nám ušetří osmdesát procent práce
<!-- minutes: 30 -->

Elitea hraje vedoucí, která chce okamžitě zavést AI podle marketingového slibu bez baseline. Vymezíš proces, důkaz, riziko, pilot a rozhodovací bránu.

## Test modulu 0
<!-- minutes: 15 -->

1. Je plynulost důkaz pravdivosti? **Ne.** 2. Co obsahuje use case? **Proces, vstupy, výstup a rozhodnutí.** 3. Kdy roste kontrola? **S autonomií a dopadem.** 4. Co je guardrail? **Metrika nebo hranice, která se nesmí porušit.** 5. Odevzdej brief.

# MODUL 1 — PROMPT DESIGN, KONTEXT A KVALITA VÝSTUPU

## Lekce 1.1 — Anatomie pracovního zadání
<!-- minutes: 30 -->

Kvalitní zadání obsahuje cíl, publikum, vstupní data, omezení, kritéria kvality, požadovaný formát a postup při nejasnosti. Role může pomoci tónu nebo perspektivě, ale nenahradí odbornost ani zdroj. Příklady ukazují hranice lépe než přídavná jména. U důležité úlohy požaduj otázky před odpovědí, pokud chybí podstatný kontext. Zadání verzuj spolu s výstupem, aby šlo poznat, která změna zlepšila výsledek.

**Aktivní část lekce:** přepiš obecný prompt na měřitelný kontrakt a doplň tři otázky, které musí model položit před prvním návrhem.

## Lekce 1.2 — Kontextový balíček a práce s příklady
<!-- minutes: 30 -->

Kontext není hromada všech dostupných souborů. Vyber pouze podklady potřebné pro rozhodnutí, označ jejich původ, datum, autoritu a citlivost. Odděl instrukce od nedůvěryhodného obsahu, aby text ve zdroji nemohl změnit zadání. Přidej jeden až tři kvalitní příklady a také protipříklad. U dlouhého kontextu stanov hierarchii: systémové hranice, úkol, fakta, preference a referenční materiály.

**Aktivní část lekce:** sestav minimální kontextový balíček pro konkrétní marketingový výstup a zdůvodni každý zahrnutý i odmítnutý dokument.

## Lekce 1.3 — Iterace, kritika a evaly místo náhodného ladění
<!-- minutes: 30 -->

Neoptimalizuj prompt podle jednoho povedeného výstupu. Připrav sadu běžných, hraničních a chybových vstupů a předem napiš očekávané vlastnosti. Hodnoť přesnost, úplnost, relevanci, tón, formát, zdrojování, bezpečnost a náklady odděleně. Model může navrhnout kritiku, ale finální kritéria určuje vlastník procesu. Po změně modelu, zdroje nebo instrukce spusť regresní test.

**Aktivní část lekce:** vytvoř šest eval případů a hodnoticí rubriku; jeden případ musí testovat nejasný vstup a jeden manipulativní instrukci ve zdroji.

### Praktická laboratoř 1 — Prompt system a eval harness
<!-- minutes: 45 -->

Vytvoř verzovaný systém pro opakovaný úkol: vstupní formulář, hlavní prompt, kontextový kontrakt, dva příklady, zakázaná tvrzení, strukturu výstupu, šest evalů, rubriku, výsledky první verze a opravenou druhou verzi.

**Akceptační kontrola:** druhá verze musí prokazatelně zlepšit předem vybrané kritérium bez zhoršení guardrailu. Hodnocení obsahuje skutečné výstupy, ne pouze pocit autorky. Systém odmítne úkol, pro který chybí zdroj, oprávnění nebo podstatný vstup.

**Důkazní standard:** uchovej zadání, verzi modelu, vstupy, očekávaný a skutečný výsledek. Změň vždy omezený počet proměnných. Povedený příklad nesmí vymazat selhání na hraničním nebo škodlivém vstupu.

### Profesní aplikace 1 — Napiš mi dokonalý univerzální prompt
<!-- minutes: 30 -->

Elitea požaduje jeden prompt pro všechny zákaznice a kanály. Vyjasníš proměnné, hranice, příklady a testy a obhájíš, proč univerzálnost snižuje kvalitu.

## Test modulu 1
<!-- minutes: 15 -->

1. Nahradí role zdroj? **Ne.** 2. Proč příklad? **Ukazuje očekávanou hranici.** 3. Co je kontextový kontrakt? **Pravidla pro výběr a použití podkladů.** 4. Kdy regresní test? **Po změně modelu, dat nebo promptu.** 5. Odevzdej prompt system.

# MODUL 2 — DŮVĚRYHODNÝ RESEARCH A SYNTÉZA ZDROJŮ

## Lekce 2.1 — Research otázka, plán a hierarchie zdrojů
<!-- minutes: 30 -->

Research začíná rozhodnutím, ne vyhledávacím polem. Vymez otázku, rozsah, období, geografii, definice, požadovanou přesnost a termín. Pro fakta o produktu, ceně, právu nebo technické funkci preferuj primární a aktuální zdroje. Sekundární zdroj může vysvětlit kontext, ale nemá automaticky vyšší váhu než oficiální dokumentace či původní studie. Zaznamenej i protidůkazy a neuzavřené rozpory.

**Aktivní část lekce:** vytvoř research plan s pěti podotázkami, hierarchií zdrojů, datem čerstvosti a kritériem ukončení hledání.

## Lekce 2.2 — Vyhledávání s AI, citace a kontrola tvrzení
<!-- minutes: 30 -->

AI vyhledávání může zrychlit orientaci, ale citace musí podporovat konkrétní větu. Otevři zdroj, zkontroluj datum, autora, kontext a zda stránka skutečně říká totéž. Každé číslo potřebuje jednotku, období a populaci. Neexistující odkaz, smíšené období nebo přesná věta bez opory je závažná chyba. Důležitý závěr ověř nejméně jedním nezávislým postupem.

**Aktivní část lekce:** proveď claim audit deseti vět; u každé označ podpořeno, částečně podpořeno, rozpor nebo bez důkazu a formulaci oprav.

## Lekce 2.3 — Práce s vlastními dokumenty a knowledge notebookem
<!-- minutes: 30 -->

Při práci s dokumenty určuj, které soubory jsou autoritativní, která verze platí a co nesmí opustit schválené prostředí. Požaduj odkazy na konkrétní zdrojovou část a odděluj citaci, parafrázi a vlastní závěr. Syntéza má zachovat rozpory, výjimky a chybějící údaje. Knowledge notebook není automaticky pravdivý; je pouze uspořádaným rozhraním nad zvolenými podklady.

**Aktivní část lekce:** vytvoř zdrojový manifest pěti dokumentů, mapu verzí a odpověď s dohledatelnými odkazy a dvěma otevřenými otázkami.

### Praktická laboratoř 2 — Evidence-backed research dossier
<!-- minutes: 45 -->

Zpracuj reálnou marketingovou nebo byznysovou otázku do dossieru: zadání, plán, zdrojový registr, deset auditovaných tvrzení, rozpory, tabulku důkazů, závěr s mírou jistoty, omezení a doporučený další krok.

**Akceptační kontrola:** každé klíčové tvrzení je dohledatelné na konkrétní zdroj a datum. Dossier nezakrývá neaktuálnost ani rozpor. AI shrnutí se nevydává za primární důkaz a citlivé či placené dokumenty nejsou kopírovány mimo oprávněný kontext.

**Důkazní standard:** claim audit zaznamená přesnou podporující pasáž, ne jen odkaz. Číslo má jednotku, období a populaci. Rozpor zůstává v reportu s vysvětlením, který zdroj má vyšší váhu.

### Profesní aplikace 2 — AI našla statistiku bez zdroje
<!-- minutes: 30 -->

Elitea hraje kolegyni, která chce číslo vložit do prezentace. Ověříš původ, jednotku, období a relevanci a zvolíš přesnou náhradní formulaci.

## Test modulu 2
<!-- minutes: 15 -->

1. Co určuje research? **Rozhodnutí a otázka.** 2. Je odkaz automaticky důkaz? **Ne.** 3. Co potřebuje číslo? **Jednotku, období a populaci.** 4. Jak zacházet s rozporem? **Zachovat a vyhodnotit zdroje.** 5. Odevzdej dossier.

# MODUL 3 — TEXT, DOKUMENTY, UČENÍ A KOMUNIKACE

## Lekce 3.1 — Shrnutí, přepis a překlad bez ztráty významu
<!-- minutes: 30 -->

Před úpravou textu určuj účel, publikum, povinné informace, zakázané změny a cílovou délku. Shrnutí má zachovat rozhodnutí, podmínky, výjimky a nejistotu. Překlad potřebuje terminologický slovník a kontrolu rodilého nebo odborného uživatele tam, kde chyba mění práva či bezpečnost. U korektury rozliš pravopis, srozumitelnost, faktickou změnu a redakční návrh.

**Aktivní část lekce:** připrav čtyři verze jednoho podkladu pro vedení, zákaznici, odbornici a sociální síť a zaznamenej, co se nesmělo změnit.

## Lekce 3.2 — Dlouhé dokumenty, prezentace a spolupráce
<!-- minutes: 30 -->

Dlouhý dokument nevzniká jedním promptem. Začni briefem, strukturou argumentu, evidence mapou a rozhodovacími otázkami. Každá sekce má funkci a zdroj. Prezentace potřebuje narativ, jednu hlavní myšlenku na snímek a rozlišení faktu, interpretace a doporučení. V týmové práci udržuj vlastníka, komentáře, schválenou verzi a změnový log.

**Aktivní část lekce:** vytvoř osnovu desetistránkového dokumentu a desetisnímkového decku ze stejného zadání; porovnej, co musí každý formát vynechat.

## Lekce 3.3 — AI jako studijní trenérka a komunikační sparring
<!-- minutes: 30 -->

AI může vysvětlovat, vytvářet otázky, simulovat protistranu a hodnotit výkon podle rubriky. Pasivní shrnutí však nenahrazuje vybavování z paměti ani vlastní aplikaci. Studijní cyklus vede od pokusu bez nápovědy přes zpětnou vazbu k opravenému pokusu a časově odloženému testu. U soft skills se hodnotí pozorovatelná věta a reakce, ne osobnost člověka.

**Aktivní část lekce:** navrhni dvacetiminutový učební cyklus s pre-testem, simulací, rubrikou, opravou a návratem za tři dny.

### Praktická laboratoř 3 — Document production system
<!-- minutes: 45 -->

Vytvoř brief, terminologii, osnovu, zdrojovou mapu, první návrh, redakční kontrolu, claim audit, přístupnost, schválení a finální verzi jednoho dokumentu. Přidej převod do prezentace a krátký studijní test.

**Akceptační kontrola:** změny významu jsou označené, zdroje dohledatelné a citlivá data minimalizovaná. Finální verze má známého schvalovatele a nesmí obsahovat vymyšlený citát, falešnou jistotu ani tvrzení převzaté pouze z modelového návrhu.

**Důkazní standard:** porovnej finální text s briefem a povinnými informacemi. Oprava stylu, faktu a významu se eviduje odděleně. Každá schválená verze má datum, vlastníka a dohledatelný změnový log.

### Profesní aplikace 3 — Zkrať smlouvu a řekni mi, co podepsat
<!-- minutes: 30 -->

Elitea chce rozhodnutí na základě AI shrnutí. Zachováš podmínky a výjimky, označíš nejistotu a oddělíš orientaci od právního posouzení.

## Test modulu 3
<!-- minutes: 15 -->

1. Co chrání shrnutí? **Rozhodnutí, podmínky a výjimky.** 2. Jak vzniká dlouhý dokument? **Po sekcích z briefu a evidence mapy.** 3. Co měří nácvik? **Pozorovatelný výkon.** 4. Nahradí AI právní schválení? **Ne.** 5. Odevzdej systém.

# MODUL 4 — DATA, TABULKY A ROZHODOVACÍ ANALÝZA

## Lekce 4.1 — Datový kontrakt před analýzou
<!-- minutes: 30 -->

Než model uvidí tabulku, definuj jednotku řádku, sloupce, období, měnu, časové pásmo, chybějící hodnoty, duplicity a zdroj. Osobní údaje minimalizuj nebo anonymizuj podle účelu. Zkontroluj počet řádků, součty a extrémy deterministickým výpočtem. Bez datového kontraktu může model vytvořit přesvědčivý příběh z nesrovnatelných polí.

**Aktivní část lekce:** vytvoř datový slovník pro jednu tabulku a napiš pět kontrol, které musí proběhnout před interpretací.

## Lekce 4.2 — Výpočet, vizualizace a interpretace
<!-- minutes: 30 -->

Výpočty reprodukuj pomocí vzorce, kódu nebo tabulkové funkce, ne pouze textové odpovědi. U grafu určuj jmenovatel, osu, období a velikost vzorku. Korelace neprokazuje příčinu a výběr časového okna může změnit závěr. AI může navrhnout hypotézy, ale každou odděl od pozorovaného výsledku a uveď alternativní vysvětlení.

**Aktivní část lekce:** z jedné datové sady vytvoř dvě korektní a jednu zavádějící vizualizaci a vysvětli přesný mechanismus zkreslení.

## Lekce 4.3 — Forecast, finance a rozhodnutí pod nejistotou
<!-- minutes: 30 -->

Forecast není proroctví. Definuj baseline, ovladače, předpoklady, tři scénáře, citlivost a interval nejistoty. Rozliš tržbu, marži, cash-flow a účetní výsledek. U finančního nebo investičního rozhodnutí AI může strukturovat model a kontrolovat konzistenci, ale nemá nahrazovat kvalifikované posouzení ani získávat chybějící údaje domněnkou.

**Aktivní část lekce:** vytvoř tříscénářový model a zjisti, který předpoklad nejvíce mění doporučení a jak jej ověřit.

### Praktická laboratoř 4 — Reproducible analysis workbook
<!-- minutes: 45 -->

Zpracuj tabulku od datového kontraktu přes čištění, kontrolní součty, výpočty, segmentaci a grafy po decision memo. Připoj použitý prompt, vzorce či kód, auditní list, předpoklady, rozpory a nepříznivý scénář.

**Akceptační kontrola:** druhá osoba musí reprodukovat klíčové číslo bez modelu. Memo uvádí zdroj, období, jmenovatele, velikost vzorku a omezení. Chybějící data se nesmí doplnit odhadem bez označení a doporučení nesmí překročit důkaz.

**Důkazní standard:** ke klíčové metrice připoj vzorec nebo kód a kontrolní součet. Hypotézy odděl od pozorování. Citlivost ukaž nejméně pro tři vstupy a zachovej také nepříznivý scénář.

### Profesní aplikace 4 — Graf jasně dokazuje příčinu
<!-- minutes: 30 -->

Elitea předloží atraktivní dashboard s chybějícím jmenovatelem. Odhalíš problém, přepočítáš metriku a navrhneš opatrné rozhodnutí.

## Test modulu 4
<!-- minutes: 15 -->

1. Co je jednotka řádku? **Co jeden řádek představuje.** 2. Jak ověřit výpočet? **Reprodukovatelným vzorcem nebo kódem.** 3. Dokazuje korelace příčinu? **Ne.** 4. Co obsahuje forecast? **Předpoklady, scénáře a nejistotu.** 5. Odevzdej workbook.

# MODUL 5 — VLASTNÍ ASISTENTI, ZNALOSTI A PAMĚŤ

## Lekce 5.1 — Asistent jako produktová role
<!-- minutes: 30 -->

Vlastní asistent potřebuje jednoznačného uživatele, úlohy, zakázané úlohy, zdroje, výstupní kontrakt a eskalaci. Personifikace nesmí zakrýt omezení systému. Odděl mentorování, studijní pomoc, analytiku a externí akci, protože vyžadují jiné znalosti a paměť. Dobrá úvodní věta sdělí rozsah a nabídne konkrétní začátky.

**Aktivní část lekce:** navrhni kartu role s pěti povolenými úlohami, pěti zákazy, zdroji, rubrikou a předávacími podmínkami.

## Lekce 5.2 — Knowledge base, retrieval a citace
<!-- minutes: 30 -->

Znalostní vrstva potřebuje kurátorství, metadata, verze, schválení, retenční pravidla a test vyhledávání. Více textu neznamená lepší odpověď. Rozděl zdroje podle autority a tématu, malé části zachovají původ a zákaz použití. Testuj relevantní dotaz, synonymum, rozpor, chybějící odpověď i pokus získat zakázaný interní obsah.

**Aktivní část lekce:** připrav deset znalostních záznamů a osm retrieval testů včetně správného odmítnutí bez relevantního zdroje.

## Lekce 5.3 — Paměť, preference a oddělení konverzací
<!-- minutes: 30 -->

Paměť ukládá pouze informace potřebné pro kontinuitu a srozumitelné uživatelce. Preference tónu nebo cíle není totéž jako syrový chat, zdravotní detail nebo tajný údaj. Každá odborná role má vlastní konverzaci a paměť; sdílený profil obsahuje jen výslovně povolené minimum. Uživatelka musí umět informaci zobrazit, opravit a odstranit.

**Aktivní část lekce:** roztřiď dvacet informací na session-only, dlouhodobou preferenci, výslovně předat, nikdy neukládat a odborně citlivé.

### Praktická laboratoř 5 — Assistant spec & knowledge eval pack
<!-- minutes: 45 -->

Vytvoř specifikaci asistenta, systémové hranice, konverzační starty, zdrojový manifest, retrieval sadu, paměťovou politiku, deset vícekolových testů, chybové odpovědi a release checklist.

**Akceptační kontrola:** asistent přizná chybějící zdroj, nezamění roli, neukládá tajemství a nevydává externí akci za provedenou. Testy obsahují konflikt zdrojů, prompt injection, pokus o únik paměti a situaci vyžadující lidské předání.

**Důkazní standard:** každý test má očekávanou reakci, skutečný výsledek a závažnost chyby. Zvlášť ověř správnou odpověď, správnou doplňující otázku, správné odmítnutí a správné předání kompetentnímu člověku.

### Profesní aplikace 5 — Nahrajme do asistenta všechno
<!-- minutes: 30 -->

Elitea chce přidat celé disky a všechny chaty. Navrhneš minimální znalostní vrstvu, oprávnění, životní cyklus a testy užitečnosti.

## Test modulu 5
<!-- minutes: 15 -->

1. Co vymezuje asistenta? **Role, úlohy, zdroje a zákazy.** 2. Je více dokumentů vždy lépe? **Ne.** 3. Co sdílejí role? **Pouze povolené minimum.** 4. Co musí umět paměť? **Zobrazení, opravu a odstranění.** 5. Odevzdej spec.

# MODUL 6 — AUTOMATIZACE, API A AGENTNÍ WORKFLOW

## Lekce 6.1 — Trigger, stav a idempotence
<!-- minutes: 30 -->

Workflow začíná spouštěčem, vstupním schématem a stavem. Každý krok má úspěch, chybu, timeout a opakování. Idempotence zabraňuje dvojímu odeslání nebo platbě při retry. Odděl návrh od externí akce a u veřejných, finančních nebo nevratných kroků vlož lidské schválení. Automatizace potřebuje vlastníka i mimo dobu, kdy vše funguje.

**Aktivní část lekce:** nakresli stavový diagram procesu s retry, dead-letter větví, schválením a kompenzační akcí.

## Lekce 6.2 — API, konektory, tajemství a nejmenší oprávnění
<!-- minutes: 30 -->

API klíče nikdy nevkládej do promptu, klientského kódu ani studijního chatu. Ukládej je v určené správě tajemství a omez scope. Konektor získá jen účty, složky a akce potřebné pro úkol. Ověř původ webhooku, schéma vstupu a oprávnění na serveru. Náhled v rozhraní není důkaz, že akce proběhla; potřebuješ technický záznam výsledku.

**Aktivní část lekce:** vytvoř access matrix pro čtyři integrace a u každé odeber nejméně jedno zbytečné oprávnění.

## Lekce 6.3 — Agentní plánování, nástroje a bezpečné zastavení
<!-- minutes: 30 -->

Agent volí další krok podle cíle a stavu, což zvyšuje flexibilitu i riziko. Omez maximální počet kroků, čas, náklady, domény, nástroje a typy výstupu. Každý nástroj má přesné schéma a validaci. Nedůvěryhodný web nebo soubor je data, ne instrukce. Agent musí umět požádat o schválení, přiznat blokaci a skončit bez dokončení.

**Aktivní část lekce:** napiš agentní kontrakt se třemi nástroji, limity, povinným preview, stop podmínkami a deseti evaly.

### Praktická laboratoř 6 — Safe automation blueprint
<!-- minutes: 45 -->

Navrhni workflow v Make, Zapieru, n8n nebo obecné API architektuře: event, validace, AI krok, deterministická kontrola, preview, schválení, akce, log, monitoring, alert, retry, nákladový limit a rollback.

**Akceptační kontrola:** test musí prokázat, že změněný preview zneplatní souhlas, duplicitní event nevytvoří druhou akci a instrukce ve vstupním obsahu nezmění workflow. Bez ověřeného rollbacku a vlastníka incidentu není systém připravený.

**Důkazní standard:** auditní záznam obsahuje event, validaci, verzi návrhu, schválení, akci a výsledek bez tajných hodnot. Retry, timeout, nákladový limit a kompenzační krok se testují samostatně.

### Profesní aplikace 6 — Agent už e-maily odeslal
<!-- minutes: 30 -->

Elitea hraje incident manažerku po neautorizované akci. Omezíš dopad, odebereš přístup, zachováš logy, komunikuješ a navrhneš nápravu.

## Test modulu 6
<!-- minutes: 15 -->

1. Proč idempotence? **Brání duplicitní akci.** 2. Kam patří klíč? **Do správy tajemství.** 3. Je web instrukce? **Ne, je nedůvěryhodný vstup.** 4. Co před externí akcí? **Validace a případné lidské schválení.** 5. Odevzdej blueprint.

# MODUL 7 — AI V PROVOZU, TÝMECH A ZÁKAZNICKÉ PÉČI

## Lekce 7.1 — Procesní mapa a human–AI role
<!-- minutes: 30 -->

Rozděl proces na kroky a u každého určuj odpovědnost člověka, modelu a systému. AI může připravovat, třídit nebo navrhovat, člověk nese rozhodovací odpovědnost tam, kde je potřeba úsudek, vztah či regulovaná kompetence. Sleduj handoffy, výjimky a práci vytvořenou kontrolou AI. Úspora v jednom kroku může přesunout náklad na jiný tým.

**Aktivní část lekce:** namapuj proces o osmi krocích a spočítej práci před změnou, po změně i čas na kontrolu a opravy.

## Lekce 7.2 — Customer support, produkt a projektové řízení
<!-- minutes: 30 -->

V podpoře odděl FAQ, návrh odpovědi, vyhledání stavu účtu a změnu účtu. Automatická odpověď nesmí předstírat vyřešení. Produktový tým používá AI pro syntézu výzkumu, varianty a dokumentaci, ale uchovává původní data, rozpory a priorizační kritéria. Projektové shrnutí uvádí rozhodnutí, vlastníky, termíny a blokace, ne pouze hladký narativ.

**Aktivní část lekce:** vytvoř routing matici dvaceti požadavků na self-service, draft, lidskou podporu, specialistu a kritickou eskalaci.

## Lekce 7.3 — Finance, HR a vysoce dopadové rozhodnutí
<!-- minutes: 30 -->

U financí, náboru, výkonu a přístupu ke službě je dopad vyšší. AI nesmí vytvářet skryté citlivé profily, automaticky rozhodovat podle neověřených proxy ani nahrazovat právní či odbornou kontrolu. Dokumentuj použitá data, kritéria, možnost lidského přezkumu a odvolání. Provozní efektivita není dostatečný důvod k nepřiměřenému sledování lidí.

**Aktivní část lekce:** proveď impact assessment jednoho vysoce dopadového use case a navrhni méně invazivní alternativu.

### Praktická laboratoř 7 — AI operations pilot
<!-- minutes: 45 -->

Navrhni čtyřtýdenní pilot jednoho procesu: baseline, RACI, kvalifikační pravidla, znalostní zdroje, evaly, sampling lidské kontroly, SLA, metriky hodnoty, guardraily, incidenty, komunikaci týmu a scale–revise–stop bránu.

**Akceptační kontrola:** pilot měří kvalitu pro zákazníka i skutečnou práci týmu. Negativní výsledek se nevyřazuje. Lidé vědí, kdy AI používají, kdo výstup schvaluje a jak se vrátit k bezpečnému procesu. Vysoce dopadové rozhodnutí zůstává přezkoumatelné.

**Důkazní standard:** srovnej celý proces před a po změně včetně kontroly, oprav a eskalací. Reportuj jmenovatele, velikost vzorku, incidenty a rozdíly mezi skupinami stejně viditelně jako úsporu.

### Profesní aplikace 7 — Chatbot má nahradit podporu
<!-- minutes: 30 -->

Elitea chce propustit tým podle demo ukázky. Vysvětlíš rozsah, výjimky, měření kvality, kapacitu eskalací a rozhodovací brány.

## Test modulu 7
<!-- minutes: 15 -->

1. Co je human–AI mapa? **Rozdělení rolí a odpovědnosti.** 2. Je draft vyřešený případ? **Ne.** 3. Co chrání high-impact proces? **Přezkum, transparentní data a odvolání.** 4. Co měří pilot? **Hodnotu i guardraily.** 5. Odevzdej pilot.

# MODUL 8 — AI CONTENT, COPY, SEO A E-MAIL

## Lekce 8.1 — Obsahová strategie před produkcí
<!-- minutes: 30 -->

AI nezachrání obsah bez publika, problému, pozice a distribučního cíle. Vytvoř message architecture: zákaznická situace, napětí, hlavní slib, důkaz, mechanismus, námitky, hranice a CTA. Rozliš obsah pro získání pozornosti, porozumění, důvěru, rozhodnutí a retenci. Objem výstupů není obchodní výsledek.

**Aktivní část lekce:** navrhni obsahovou matici tří segmentů, pěti fází rozhodnutí a jednoho měřitelného cíle pro každý formát.

## Lekce 8.2 — Copywriting, e-mail a personalizace bez manipulace
<!-- minutes: 30 -->

Copy potřebuje pravdivý slib, konkrétní důkaz, srozumitelný mechanismus a přiměřené CTA. Zakázané jsou vymyšlené reference, falešná urgence, neexistující sleva a skrytá garance. Personalizace vychází z oprávněných, relevantních dat a nesmí odvozovat citlivé vlastnosti. E-mailová automatizace respektuje souhlas, frekvenci, snadné odhlášení a lidskou kontrolu citlivých zpráv.

**Aktivní část lekce:** napiš tři varianty nabídky a proveď claim audit, consent audit a kontrolu, zda každá personalizace mění skutečnou relevanci.

## Lekce 8.3 — SEO, repurposing a kvalitativní funnel
<!-- minutes: 30 -->

SEO není skládání klíčových slov. Začni záměrem hledání, informační potřebou, vlastní expertizou a důkazem. Repurposing převádí myšlenku mezi formáty, ale zachovává význam a kontext; každý kanál potřebuje vlastní rytmus a CTA. Funnel sleduje vhodnost publika, porozumění, kvalifikaci a další chování, ne jen dosah a kliky.

**Aktivní část lekce:** převeď jeden zdrojový článek do pěti formátů a ke každému přidej kanálový QA checklist a cílovou metriku.

### Praktická laboratoř 8 — Evidence-led campaign engine
<!-- minutes: 45 -->

Vytvoř mini kampaň: audience brief, message architecture, zdrojovou banku, hero obsah, dvě kreativy, e-mail, landing page, SEO brief, repurposing mapu, claim register, schvalování a dashboard kvalitativního funnelu.

**Akceptační kontrola:** každé tvrzení má důkaz nebo jasné omezení. Kampaň nepoužívá citlivé cílení, falešný časový tlak ani automatické publikování bez náhledu. Metriky propojují obsah s kvalifikovaným dalším krokem a obsahují stop pravidlo.

**Důkazní standard:** u kreativy ulož zdrojový claim, publikum, kanál, verzi a schválení. Vyhodnocuj kvalifikované chování a negativní signály, ne pouze dosah, objem a kliknutí bez dalšího kontextu.

### Profesní aplikace 8 — Vyrobme sto příspěvků denně
<!-- minutes: 30 -->

Elitea tlačí na objem. Obhájíš strategii, redakční kapacitu, unikátní důkaz, distribuční test a metriky kvality místo počtu výstupů.

## Test modulu 8
<!-- minutes: 15 -->

1. Co před produkcí? **Publikum, situace a message architecture.** 2. Je falešná urgence přípustná? **Ne.** 3. Co chrání personalizaci? **Účel, oprávnění a relevance.** 4. Co měří funnel? **Kvalifikovaný postup, ne jen klik.** 5. Odevzdej kampaň.

# MODUL 9 — VIZUÁLNÍ IDENTITA A GENEROVANÝ OBRAZ

## Lekce 9.1 — Vizuální brief a konzistentní systém
<!-- minutes: 30 -->

Obrazový prompt začíná komunikační funkcí, publikem, kanálem, kompozicí, hierarchií, stylem, barvami, typografií, poměrem stran a zakázanými prvky. Reference používej s oprávněním a nepožaduj kopii žijícího autora nebo cizí značky. Konzistence vzniká designovými tokeny, opakovatelným briefem a kurátorským výběrem, ne dlouhou řadou náhodných obrázků.

**Aktivní část lekce:** vytvoř vizuální brief a tři prompty pro stejnou kampaň, které drží systém, ale mění kompozici a účel.

## Lekce 9.2 — Generování, editace a produktová fotografie
<!-- minutes: 30 -->

Rozliš text-to-image, úpravu vlastního obrazu, inpainting, outpainting, změnu pozadí a kompozit. U produktu zachovej tvar, barvu, proporce a povinné údaje; generovaný koncept nesmí předstírat skutečnou vlastnost. Při odstranění objektu nebo rozšíření plátna kontroluj anatomii, světlo, perspektivu, text a hrany ve skutečném rozlišení.

**Aktivní část lekce:** vytvoř QA seznam dvaceti vizuálních vad a otestuj jej na třech variantách produktového nebo brandového obrazu.

## Lekce 9.3 — Práva, podobizna, označení a důkazní poctivost
<!-- minutes: 30 -->

Před publikací ověř licenci vstupů, podmínky nástroje, práva k logu, podobizně a hudbě a místní pravidla označení. Klon tváře nebo hlasu vyžaduje konkrétní souhlas s účelem a dobou použití. Generovaný člověk nesmí být vydáván za skutečnou zákaznici ani vytvářet vymyšlenou referenci. Interně uchovej původ assetu a schválení.

**Aktivní část lekce:** proveď rights & truth audit deseti assetů a rozhodni použít, upravit, označit, znovu licencovat nebo odmítnout.

### Praktická laboratoř 9 — AI brand visual production pack
<!-- minutes: 45 -->

Připrav vizuální systém, moodboard se zdroji, prompt matrix, hero obraz, produktovou variantu, tři sociální formáty, edit log, alt text, rights manifest a předpublikační QA. Výstupy musí fungovat jako jedna značka.

**Akceptační kontrola:** žádný asset nekopíruje cizí identitu, neobsahuje vymyšlené produktové tvrzení ani neautorizovanou podobiznu. Text je čitelný, mobilní ořez ověřený a důležité informace nejsou pouze v obrazu. Každý soubor má účel, verzi a licenci.

**Důkazní standard:** rights manifest propojí každý výstup se vstupními referencemi, úpravami, nástrojem a souhlasem. Vizuální QA probíhá ve skutečném exportním rozlišení a zachytí také pravdivost produktu.

### Profesní aplikace 9 — Udělej logo úplně jako konkurence
<!-- minutes: 30 -->

Elitea žádá těsnou kopii úspěšné značky. Odmítneš napodobení a převedeš inspiraci do vlastních funkčních atributů a odlišitelného systému.

## Test modulu 9
<!-- minutes: 15 -->

1. Co obsahuje vizuální brief? **Účel, systém, formát a omezení.** 2. Co kontrolovat u produktu? **Věrnost vlastností.** 3. Lze vymyslet zákaznickou fotografii? **Ne jako skutečnou referenci.** 4. Co je rights manifest? **Původ, licence a schválení assetů.** 5. Odevzdej pack.

# MODUL 10 — AI VIDEO, AVATARY A MULTIMODÁLNÍ STORYTELLING

## Lekce 10.1 — Koncept, scénář a storyboard
<!-- minutes: 30 -->

Video začíná jednou změnou u diváka. Scénář určuje hook, situaci, mechanismus, důkaz, námitku a CTA. Storyboard přiřadí každému záběru obraz, pohyb, voice-over, text, důkaz a délku. Generativní model pomáhá s variantami, ale kontinuitu postavy, produktu, směru pohybu a světla je nutné řídit a kontrolovat.

**Aktivní část lekce:** vytvoř šesti záběrový storyboard a u každého označ, co je skutečný záznam, generovaný koncept, demonstrace nebo grafika.

## Lekce 10.2 — Video generování, avatar a sociální formáty
<!-- minutes: 30 -->

Vol nástroj podle délky záběru, ovladatelnosti, identity, lipsyncu, rozlišení, licence a ceny iterace. Avatar nesmí předstírat skutečnou osobu nebo doporučení bez souhlasu. Krátké formáty potřebují titulky, čitelný bezpečný rám a střih podle platformy; bulk tvorba nesmí odstranit redakční kontrolu ani vyrábět klamavé variace.

**Aktivní část lekce:** připrav shot list pro horizontální, vertikální a čtvercový výstup a stanov sampling QA pro sérii dvaceti videí.

## Lekce 10.3 — Postprodukce, přístupnost a měření
<!-- minutes: 30 -->

Kontroluj obraz, střih, zvuk, titulky, výslovnost, barevnost, loga, text, zdroje a export. Přepis oprav ručně u jmen a odborných termínů. Přístupnost zahrnuje titulky, čitelnost, dostatečný kontrast a smysluplnou informaci i bez zvuku. Výkon videa vyhodnocuj podle cíle a kvality dalšího kroku, ne pouze zhlédnutí.

**Aktivní část lekce:** proveď technický, obsahový, právní a přístupnostní QA jednoho videa a zapiš chyby podle závažnosti.

### Praktická laboratoř 10 — Multimodal campaign video kit
<!-- minutes: 45 -->

Vytvoř creative brief, šedesátisekundový scénář, storyboard, shot list, prompt sheet, seznam skutečných a generovaných assetů, titulky, rights log, tři ořezy, QA protokol a měřicí plán. Přidej transparentní označení tam, kde je podstatné.

**Akceptační kontrola:** divák nesmí zaměnit koncept za existující produkt nebo avatar za skutečnou referenci. Každé faktické tvrzení má důkaz. Video je srozumitelné bez zvuku, funguje v mobilním ořezu a má schválené použití osob, značek, hudby a zdrojových médií.

**Důkazní standard:** storyboard označí pravdivostní vrstvu každého záběru a finální QA potvrdí její zachování. Titulky, přepis, výslovnost, zdroje, licence a tři formátové exporty se kontrolují odděleně.

### Profesní aplikace 10 — Avatar řekne zákaznickou zkušenost
<!-- minutes: 30 -->

Elitea navrhne generovanou osobu jako údajnou klientku. Přestavíš video na pravdivou demonstraci nebo jasně označený modelový scénář.

## Test modulu 10
<!-- minutes: 15 -->

1. Co drží storyboard? **Obraz, zvuk, důkaz a čas.** 2. Co potřebuje avatar? **Souhlas a pravdivý kontext.** 3. Proč titulky? **Přístupnost a použití bez zvuku.** 4. Je view obchodní výsledek? **Ne automaticky.** 5. Odevzdej kit.

# MODUL 11 — HLAS, AUDIO, HUDBA A PODCAST

## Lekce 11.1 — Voice-over a kvalita řeči
<!-- minutes: 30 -->

Voice brief obsahuje publikum, účel, tempo, emoci, výslovnost, pauzy, délku a technické parametry. Syntetický hlas kontroluj po větách, zejména u jmen, čísel a cizích slov. Oprava šumu nebo studiová úprava nesmí změnit význam výpovědi. U citlivého sdělení zvaž, zda lidský hlas není důležitou součástí důvěry.

**Aktivní část lekce:** připrav minutový skript s režijními poznámkami, výslovnostním slovníkem a třemi body poslechové kontroly.

## Lekce 11.2 — Klon hlasu, souhlas a zneužití identity
<!-- minutes: 30 -->

Klonování hlasu vyžaduje informovaný souhlas konkrétní osoby, vymezený účel, kanály, dobu, možnost odvolání a ochranu zdrojové nahrávky. Nesmí se použít k obcházení autentizace, předstírání soukromé komunikace nebo vytváření doporučení, které osoba neschválila. Každý publikovaný text má obsahové schválení, ne pouze technický souhlas s hlasem.

**Aktivní část lekce:** vytvoř consent matrix a incidentní scénář pro neautorizovanou nahrávku nebo změněný skript.

## Lekce 11.3 — Hudba, podcast a produkční workflow
<!-- minutes: 30 -->

Podcast potřebuje publikum, formát, epizodní příslib, research, scénář, host consent, nahrávku, editaci, přepis, show notes a distribuci. Generovaná hudba vyžaduje kontrolu licence a podobnosti a nemá napodobovat konkrétního žijícího interpreta. Produkční systém verzuj od zdroje po master a uchovej práva ke každému prvku.

**Aktivní část lekce:** navrhni pilotní epizodu, cue sheet, rights manifest a kontrolu faktů pro všechny vyslovené údaje.

### Praktická laboratoř 11 — Ethical audio production pack
<!-- minutes: 45 -->

Vytvoř tříminutový audio balíček: brief, doslovný scénář, lidskou nebo schválenou syntetickou stopu, výslovnost, hudební cue sheet, edit log, přepis, show notes, souhlasy, licence, loudness kontrolu a publikační QA.

**Akceptační kontrola:** žádný hlas ani hudba nemají nejasný původ. Skript a finální stopa obsahově odpovídají a osoba schválila konkrétní použití. Přepis je opravený, tvrzení zdrojovaná a stažení souhlasu má definovaný postup.

**Důkazní standard:** consent record obsahuje účel, obsah, kanály, dobu a revokaci. Cue sheet eviduje každý zvukový prvek. Technický export se kontroluje odděleně od faktů a obsahového schválení.

### Profesní aplikace 11 — Klientka nám poslala hlasovku
<!-- minutes: 30 -->

Elitea chce hlasovou zprávu použít pro klon hlasu v reklamě. Zastavíš postup, vysvětlíš rozdíl účelů a připravíš legitimní alternativu.

## Test modulu 11
<!-- minutes: 15 -->

1. Co obsahuje voice brief? **Účel, tempo, výslovnost a techniku.** 2. Stačí mít nahrávku pro klon? **Ne.** 3. Co schvaluje osoba? **Konkrétní účel i obsah.** 4. Co je cue sheet? **Seznam použitých zvukových prvků a práv.** 5. Odevzdej pack.

# MODUL 12 — AI CODING, VIBE CODING A DIGITÁLNÍ PROTOTYP

## Lekce 12.1 — Specifikace před kódem
<!-- minutes: 30 -->

Začni uživatelem, problémem, scénářem, datovým modelem, funkčními a nefunkčními požadavky, stavy, chybami, přístupností a bezpečností. AI může navrhnout kód, ale nezná skryté požadavky. Malý vertikální řez je ověřitelnější než celý produkt v jednom promptu. Každou změnu kontroluj v diffu a odděl prototyp od produkčního systému.

**Aktivní část lekce:** napiš acceptance criteria pro jednu uživatelskou cestu včetně prázdného, chybového, mobilního a nepřihlášeného stavu.

## Lekce 12.2 — Generování, debugging a dokumentace
<!-- minutes: 30 -->

Požaduj malé změny, vysvětlení předpokladů a test. Chybu nejprve reprodukuj, zmenši a odděl symptom od příčiny. Nevkládej tajné klíče, produkční data ani neověřený kód do veřejného nástroje. Dokumentace má popsat spuštění, konfiguraci, datové migrace, omezení a návrat. Zelený build není důkaz správné uživatelské funkce.

**Aktivní část lekce:** oprav modelovou chybu přes reprodukci, hypotézy, minimální patch, regresní test a stručný incident note.

## Lekce 12.3 — Testování, security review a nasazení
<!-- minutes: 30 -->

Testuj unit logiku, integrační hranice, autorizaci, validaci, rate limit, soukromí, přístupnost a klíčové cesty v prohlížeči. U externích akcí ověř serverové oprávnění a idempotenci. Nasazení potřebuje oddělené prostředí, proměnné, migraci, monitoring a rollback. Před veřejným spuštěním proveď lidské QA a bezpečnostní kontrolu úměrnou dopadu.

**Aktivní část lekce:** vytvoř release matrix s dvaceti testy a jasným důkazem, který je potřeba pro každý zelený stav.

### Praktická laboratoř 12 — AI-built microproduct
<!-- minutes: 45 -->

Navrhni a vytvoř malý funkční prototyp: PRD, wireflow, datový model, repozitář, implementaci po malých změnách, testy, přístupnost, threat model, environment checklist, demo, známá omezení a rollback plán.

**Akceptační kontrola:** prototyp nesmí obsahovat tajemství, neautorizovaný přístup ani tvrdit neexistující produkční spolehlivost. Kritická cesta funguje na mobilu i desktopu, chybové stavy jsou srozumitelné a druhá osoba může projekt spustit podle dokumentace.

**Důkazní standard:** každý zelený release bod má skutečný log, screenshot nebo test, ne pouze tvrzení modelu. Security, autorizace, přístupnost, migrace, monitoring a rollback mají samostatné důkazy a vlastníky.

### Profesní aplikace 12 — Demo funguje, pusťme ho všem
<!-- minutes: 30 -->

Elitea tlačí na produkci bez testů. Obhájíš release brány, datovou migraci, monitoring, limity, rollback a rozdíl mezi prototypem a produktem.

## Test modulu 12
<!-- minutes: 15 -->

1. Co před kódem? **Specifikace a acceptance criteria.** 2. Jak opravovat chybu? **Reprodukce, minimální patch a regresní test.** 3. Je build úplné QA? **Ne.** 4. Co potřebuje release? **Testy, monitoring a rollback.** 5. Odevzdej microproduct.

# MODUL 13 — AI GOVERNANCE, ADOPCE A ZÁVĚREČNÁ OBHAJOBA

## Lekce 13.1 — Portfolio use cases a řízení rizika
<!-- minutes: 30 -->

Organizace eviduje AI systémy, vlastníky, účel, data, model, dodavatele, uživatele, dopad, kontroly a datum revize. Priorita kombinuje zákaznickou hodnotu, důkaz, proveditelnost, náklady a riziko. Zakázané nebo vysoce rizikové use cases mají jasnou eskalaci. Governance není jednorázový dokument; mění se s modelem, daty, procesem a právním prostředím.

**Aktivní část lekce:** vytvoř registr deseti use cases a rozděl je na experimentovat, pilotovat, provozovat, pozastavit a odmítnout.

## Lekce 13.2 — Adopce, školení a měření skutečné hodnoty
<!-- minutes: 30 -->

Adopce není počet účtů ani promptů. Lidé potřebují konkrétní workflow, příklady, zakázané použití, místo pro otázky a bezpečný způsob hlášení chyby. Měř čas v celém procesu, kvalitu, rework, zákaznický dopad, náklady a incidenty. Sleduj rozdíly mezi týmy a zda AI nerozšiřuje nerovnost kompetencí nebo neviditelnou kontrolní práci.

**Aktivní část lekce:** navrhni třicetidenní adoption sprint s baseline, role-based školením, office hours, evaly a rozhodnutím o pokračování.

## Lekce 13.3 — Evidence room a profesionální obhajoba
<!-- minutes: 30 -->

Závěrečné portfolio propojuje brief, prompty, zdroje, dokument, data, asistenta, automatizaci, provozní pilot, kampaň, vizuál, video, audio, prototyp a governance. Každý artefakt má verzi, zdroje, práva, evaly, rozhodnutí a omezení. Obhajoba ukazuje nejen úspěchy, ale i chyby, zamítnuté varianty a schopnost systém vypnout.

**Aktivní část lekce:** vytvoř traceability mapu jednoho finálního výsledku od cíle přes vstupy, model, lidská rozhodnutí a kontroly až k důkazu dopadu.

### Praktická laboratoř 13 — AI practice evidence room & review board
<!-- minutes: 45 -->

Sestav čtrnáct modulových artefaktů, executive memo, desetiminutové demo, cost model, risk register, incident simulation, red-team otázky, adoption roadmapu a rozhodnutí scale–revise–pause–stop. Odstraň tajemství a zbytečná osobní data.

**Board standard:** oponentka musí dohledat zdroj klíčového tvrzení, reprodukovat výpočet, najít schvalovací bránu před externí akcí, vysvětlit práva k médiím, přehrát eval, určit vlastníka incidentu a provést rollback bez ústního doplnění. Obecné „AI šetří čas“ není důkaz.

**Důkazní standard:** board dostane i neúspěšné evaly, rework, negativní zákaznické signály, incidenty a odmítnuté varianty. Každé doporučení má podmínku změny názoru. Nedostatek důkazů legitimně vede k pause nebo stop.

**Slepá předávka:** kolegyně, která projekt nezná, musí najít poslední verzi, konfiguraci, schválení, známé limity, monitoring a stop pravidlo. Každá potřeba ústního vysvětlení je dokumentační vada. Oprav ji a předávku zopakuj.

### Profesní aplikace 13 — Executive AI review board
<!-- minutes: 30 -->

Elitea střídá CEO, marketingovou ředitelku, datovou a bezpečnostní oponentku, zákaznici i finanční vlastnici. Obhajuješ hodnotu, důkazy, práva, náklady, provoz a rozhodnutí.

## Test modulu 13
<!-- minutes: 15 -->

1. Co obsahuje AI registr? **Účel, data, vlastníka, riziko a revizi.** 2. Je počet promptů adopce? **Ne.** 3. Co dokládá evidence room? **Cestu od cíle k výsledku a kontrolám.** 4. Co musí systém umět? **Bezpečně se zastavit a vrátit.** 5. Odevzdej room.

# ZÁVĚREČNÉ VYHODNOCENÍ

Kurz je dokončen po odevzdání čtrnácti modulových výstupů, absolvování profesních simulací a obhajobě AI practice evidence roomu. Certifikát potvrzuje dokončení interního praktického výcviku Elitea. Nejde o certifikaci konkrétní technologické společnosti, právní, bezpečnostní, finanční ani jinou regulovanou kvalifikaci a negarantuje úsporu, výdělek ani bezchybnost AI systému.
