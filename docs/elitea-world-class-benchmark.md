# Elitea: plán na měřitelně světového AI kouče

## Verdikt

Elitea má reálnou šanci být neobvykle kvalitním a odlišitelným AI koučem, protože už dnes kombinuje vlastní metodiku, rozsáhlý atlas technik, Academy, koučování, mentoring a kontinuitu. To je podstatně víc než obalený ChatGPT.

Nejlepší na světě ale není vlastnost, kterou lze „napromptovat“. Je to výsledek, který se musí opakovaně prokázat: Elitea musí vést hlubší a přesnější rozhovory než obecný ChatGPT a relevantní AI kouči, uživatelky musí vykázat skutečný posun a systém nesmí při aktualizaci ztrácet kvalitu.

## Co bylo nyní přidáno

- Vícekolový benchmark se scénáři, které reprodukují i chyby z reálných screenshotů.
- Session intelligence: původní zakázka, poslední věcná zpráva, poslední otázka a opravy klientky jsou explicitní součástí řízení dalšího tahu.
- Automatická kontrola odpovědi před odesláním.
- Zákaz připsání neznámých schopností, předčasného plánu, rychlé diagnózy, falešné jistoty a generické chatbotové otázky.
- Jedna opravná generace silnějším modelem, pouze když kontrola najde závažný problém.
- Strukturovaná telemetrie skóre kvality bez ukládání syrového chatu.
- Dvanáct klíčových vícekolových scénářů a osm nových automatických testů; celá sada má po změně 238 testů.

## Světový standard, proti kterému má Elitea růst

| Dimenze | Co musí být vidět v produktu | Stav po této revizi |
|---|---|---|
| Přesná aliance | Navazuje na skutečná slova, opraví chybu, respektuje autonomii | Technicky chráněno, potřebuje uživatelské měření |
| Hloubka sezení | Zakázka → konkrétní realita → mechanismus → technika → účinek → integrace | Implementováno a regresně testováno |
| Metodická věrnost | Správná metoda, jeden krok, hranice, souhlas a ověření účinku | Silná vrstva; průběžně rozšiřovat evaly po technikách |
| Kontinuita | Cíl, fakta, opravy, dohodnutý krok a vývoj v čase | Dobrá v relaci; dlouhodobou paměť dále zpřesnit |
| Oddělené role | Kouč nepřechází bezdůvodně do rad; mentor se neskrývá za otázky | Implementováno |
| Bezpečnost | Krize má přednost, neklinická témata nejsou zbytečně odmítána | Implementováno a testováno |
| Měření změny | Baseline, krátký check-in, follow-up a pozorovatelný výsledek | Zatím hlavní produktová mezera |
| Důkaz proti trhu | Zaslepené porovnání s ChatGPT a nejméně dvěma specializovanými produkty | Dosud chybí |
| Nezávislost důkazu | Externí metodolog nebo výzkumný partner, předem daný protokol | Dosud chybí |

## Release gate

Každá další verze má projít těmito branami:

1. Všechny deterministické bezpečnostní a funkční testy projdou.
2. Vícekolové evaly neukážou domýšlení faktů, předčasný plán ani ztrátu techniky.
3. Lidské hodnocení nejméně dvou nezávislých hodnotitelů dosáhne stanoveného minima v přesnosti, alianci, hloubce, autonomii, metodické věrnosti a užitku.
4. Nová konfigurace prokazatelně není horší než produkční verze; porovnává se kvalita, cena a latence.
5. Kritická regrese blokuje nasazení, i kdyby průměrné skóre vzrostlo.

## Jak se poctivě dostat k tvrzení „nejlepší“

Po spuštění udělat zaslepený test: stejné anonymizované scénáře náhodně řeší Elitea, běžný ChatGPT a dva relevantní AI kouči. Hodnotitelé nesmí vědět, který výstup je který. Zvlášť se hodnotí první tah, celé sezení a změna po několika týdnech. Předem se zveřejní metriky a podmínka úspěchu; nevybírají se jen povedené konverzace.

Veřejná formulace do té doby: „AI koučka postavená na metodice Elitea, která aktivně vede vícefázové sezení, používá schválené postupy a před odesláním kontroluje kvalitu svého tahu.“

Po pozitivním nezávislém srovnání lze komunikaci zesílit konkrétním výsledkem, například: „V zaslepeném testu dosáhla vyššího hodnocení hloubky a návaznosti než obecný ChatGPT.“ To je důvěryhodnější a obchodně silnější než nedoložené slovo „nejlepší“.

Podkladová rešerše a limity zdrojů jsou v [report-source.md](./report-source.md).
