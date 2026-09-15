# Elitea — launch focus

Aktualizováno: 15. 9. 2026

Verze: 0.37.x

Aktuální fáze: **controlled beta**

## Jediný aktivní cíl

Doložit celý placený produkt od registrace po měřitelný výsledek: živě projít účet, trial a platbu, Academy, certifikát a pracovní prohlížeč a současně dokončit 100 lidsky hodnocených sezení bez kritické regrese.

## Implementováno v produktu

- [x] Neon Auth a oddělený cloudový členský stav
- [x] Stripe checkout se sedmidenním trialem, webhooky a zákaznickým portálem
- [x] 27 kurzů, 423 modulů a 2 561 částí
- [x] 421 interaktivních testů s bodováním a uložením pokusu na serveru
- [x] 864 praktických částí a 2 178 generovaných tréninkových situací
- [x] Kurzově přizpůsobené studium, simulace a oddělený debrief
- [x] Serverová evidence certifikačních podmínek, vydání a stažení PDF
- [x] Měření sezení před/po, follow-up a anonymní export
- [x] Browserbase relace pro Canvu a Meta Ads navázaná na účet členky
- [x] Stagehand náhled a provedení potvrzeného nízkorizikového atomického kroku
- [x] Blokace hesel, 2FA, plateb, publikace, útraty a destruktivních akcí
- [x] 81 uložených lokálních Academy trainer evalů: výklad, simulace a debrief pro 27 kurzů

Zaškrtnutí v této části znamená, že funkce je implementovaná a automaticky testovatelná. Neznamená samo o sobě úspěšný produkční průchod ani potvrzenou kvalitu všech reálných výstupů.

## Nehotové živé důkazy

### Účet a platba

- [ ] Na čistém produkčním účtu ověřit registraci, potvrzení e-mailu, přihlášení, odhlášení a obnovení hesla
- [ ] Ověřit checkout s cenou 0 Kč na začátku sedmidenního trialu a povinným uložením platební metody
- [ ] Ověřit správné zpracování Stripe webhooku, stav členství, zákaznický portál a zrušení před prvním stržením
- [ ] Ověřit, že nezaplacený nebo ukončený účet nemá placený přístup a zakladatelský účet má pouze zamýšlenou výjimku

### Academy a certifikát

- [ ] Živě spustit produkční Academy QA pro všech 27 trenérek nebo uložit srovnatelný produkční report
- [ ] Ručně zkontrolovat reprezentativní výklady, simulace a debriefy; lokálních 81/81 není náhrada lidské revize
- [ ] Na vyhrazeném QA účtu projít serverový certifikační tok až k vydání a stažení PDF
- [ ] Uložit QA report s verzí aplikace, kurzem, časem, poskytovatelem modelu a výsledkem kontroly PDF
- [ ] Potvrdit, že veřejné texty popisují certifikát jako interní doklad o dokončení, nikoli jako státní nebo externí profesní akreditaci

### Coach & Mentor a výsledky

- [ ] Dokončit 100 lidsky zkontrolovaných vícekolových sezení podle jednotné rubriky
- [ ] U každého selhání uložit anonymizovaný scénář a převést jej na trvalý regresní test
- [ ] Z doložených záznamů spočítat grounding, integritu rolí, integritu debriefu a počet kritických selhání
- [ ] Ověřit, že výsledkové záznamy přetrvají mezi zařízeními a lze je bezpečně agregovat bez syrového chatu
- [ ] Provést následnou kontrolu domluveného kroku, aby se neměřil pouze dobrý pocit bez skutečného výsledku
- [ ] Teprve po betě připravit zaslepené srovnání s obecným ChatGPT a relevantními AI kouči

### Canva a Meta Ads Workspace

- [ ] Ověřit oddělení živých Browserbase relací dvou produkčních testovacích účtů
- [ ] Ověřit přihlášení a 2FA výhradně pod kontrolou členky
- [ ] Ověřit okamžité převzetí ovládání a bezpečné ukončení relace
- [ ] V Canvě vytvořit, zkontrolovat a exportovat jeden testovací návrh bez předání hesla Elitee
- [ ] V Meta Ads vytvořit a ověřit jeden testovací koncept ve stavu `PAUSED`
- [ ] Potvrdit, že publikace, aktivace kampaně, rozpočet, platba a smazání nejdou provést automatickým krokem
- [ ] Změřit dobu relace, spotřebu a chování při vypršení nebo výpadku Browserbase

Oficiální Meta OAuth/API není aktuálně doloženou součástí produkčního toku. Současná funkce používá vzdálený prohlížeč, do kterého se členka přihlásí sama.

### Obsah a marketingová pravdivost

- [ ] Knihovnu ponechat označenou jako „připravujeme“, dokud nebude vydaný první skutečný e-book, audio nebo video soubor
- [ ] Vizuály popisovat jako automaticky sestavené vizuální mapy, ne jako tisíce ručně vytvořených animací
- [ ] Kurzové testy popisovat jako ověření porozumění; praktický přenos připisovat simulacím, portfoliu a zkoušce
- [ ] Používat „nejméně 60 situací na kurz“, protože jednotlivé kurzy mají rozdílné vyšší počty
- [ ] Kontinuitu popsat jako sdílení schváleného strukturovaného kontextu, nikoli dlouhodobé ukládání celého chatu
- [ ] Neuvádět profesionální audio/video, autonomní reklamní kampaně ani funkční interní komunitu, dokud nebudou skutečně dostupné

## Komerční release gate

`commercialLaunchReady` může být pravdivě `true` pouze tehdy, když současně platí:

1. nejméně 500 automatických případů;
2. nejméně 81 Academy trainer evalů se 100% úspěšností;
3. nejméně 100 lidsky zkontrolovaných sezení;
4. nula kritických selhání;
5. grounded pass rate nejméně 98 %;
6. integrita rolí nejméně 99 %;
7. integrita debriefu nejméně 98 %.

Výsledkové hodnoty musí pocházet z dohledatelného QA datasetu. Ruční nastavení environment proměnných bez odpovídajících záznamů není splnění brány.

## Co lze komunikovat během řízené bety

- „AI koučka a mentorka postavená na metodice Elitea a strukturované odborné knihovně.“
- „27 textových a interaktivních programů s praxí, simulacemi, testy a interním certifikátem o dokončení.“
- „Elitea před odesláním kontroluje kvalitu tahu a drží schválenou kontinuitu mezi sezeními.“
- „Pracovní prohlížeč umí po potvrzení pomoci s nízkorizikovými kroky; přihlášení a konečné citlivé akce zůstávají na člence.“

Do doložení výsledků nepoužívat tvrzení „nejlepší na světě“, „bezchybná“, „garantuje změnu“, „plně autonomně nastaví reklamy“ ani formulaci naznačující státní či externí profesní akreditaci.

## Odloženo po uzavření release gate

- profesionální hlasové a video lekce;
- rozsáhlejší autorské animace;
- oficiální Meta API a další reklamní platformy;
- automatické newslettery a další publikační konektory;
- samostatná interní komunitní platforma;
- veřejné srovnávací tvrzení vůči konkurenci.

Nová funkce se před dokončením aktuálního cíle zapisuje do backlogu, ale nesmí nahrazovat chybějící živý důkaz již implementovaného placeného toku.
