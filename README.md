# Elitea — AI koučink, byznys mentoring a vzdělávací ekosystém v0.21

Ověřený preview prototyp členské AI koučky a mentorky pro podnikatelky. Obsahuje:

- produkční systémový prompt;
- produktový standard hlavní dlouhodobé AI koučky a byznys mentorky, která vede celý proces a nepředává běžné obtížné situace člověku;
- quiet-luxury rozhraní, viditelné prvky důvěry a intuitivní mobilní navigaci;
- schválenou znalostní vrstvu Nii a úplnou kurzovou vrstvu Elitea Academy;
- produkční knižní vrstvu z 135 dokončených Everand zdrojů a 993 kriticky revidovaných praktických nástrojů; čekající governance výroky, politické názory a rozpracované zdroje se do odpovědí nenačítají;
- kurátorovaný registr 23 koučovacích metod s pravidly použití, hranicemi a kontrolami kvality;
- Master Technique Atlas se 194 koučovacími, psychologicky informovanými, komunikačními a byznysovými postupy;
- licenční blokaci zdrojů, jejichž podmínky zakazují komerční AI využití; kurz Transformation Life Coach je veden pouze v osobním studijním auditu mimo produkční znalostní vrstvu;
- bezpečnostní router, který modelu nabízí nejvýše dvě vhodné techniky a nikdy mu neposkytne klinické `human_only` postupy;
- odborný registr zdrojů s úrovní autority, omezeními a vazbou na jednotlivé metody;
- automatickou kontrolu, že žádná metoda není bez dohledatelného zdroje a důkazního profilu;
- evaluační sadu náročných scénářů pro koučink, byznys, NLP hranice, meditaci, depresi, úzkost, vyhoření, trauma, nemoc, etiku, soukromí a krizi;
- vedené meditace na míru s bezpečnostními podmínkami a snadným ukončením;
- podpůrnou stabilizaci při úzkosti a trauma-informovaný režim bez zpracování traumatické vzpomínky;
- aktivní koučovací podporu každodenního a pracovního fungování při depresi, úzkosti a vyhoření bez preventivního podsouvání lékaře, terapeuta nebo krize;
- koučovací podporu neklinických dopadů nemoci s předáním zdravotních rozhodnutí odborníkovi;
- deterministický metodický router, který volí pracovní postup podle aktuálního tématu;
- jednoduchý retrieval relevantní metodiky;
- dvě nezávislé bezpečnostní vrstvy před použitím koučovací techniky;
- upravitelnou a smazatelnou pracovní paměť;
- kontinuitu bezpečných pracovních témat bez dlouhodobého ukládání syrového chatu;
- automatickou redakci e-mailů, telefonů, rodných čísel, platebních údajů a přístupových klíčů z pracovní paměti;
- oddělení citlivých psychických a zdravotních témat od automatické dlouhodobé paměti;
- Content Security Policy a další ochranné HTTP hlavičky;
- přirozené úvodní poznávání přímo v chatu, vždy jednou relevantní otázkou místo formuláře před rozhovorem;
- volitelně upravitelný profil pro cíle, překážky, kapacitu, hranice a preferovaný styl podpory;
- návaznost rozhovorů, milníky, úkoly a základ handoffu Nii;
- soukromé předání Nii bez automatického přístupu k chatu: volitelný upravitelný podklad, samostatný souhlas před přiložením a možnost rezervovat bez podkladu;
- serverový rezervační tok s preferovaným termínem, konečným souhlasem, jednorázovým ID proti dvojímu odeslání a volitelným podkladem jako textovou přílohou přes Resend;
- počítadlo „Dny spolu“, kde libovolný počet zpráv a návratů během jednoho kalendářního dne znamená jediný aktivní den;
- samostatně posuvnou historii konverzace na počítači i mobilu, uchovávající až 200 zpráv v aktuální relaci;
- programový limit jediné otázky v prvním koučovacím kroku;
- session intelligence, která drží původní zakázku, poslední věcnou odpověď, poslední otázku a výslovné opravy členky;
- automatickou bránu koučovací kvality s jednou případnou opravou slabého tahu hlubokým modelem;
- pět vědomě volitelných formátů: Koučovací hodina, Mentoringová konzultace, NLP konzultace, Behaviorální konzultace a Somatická konzultace;
- závazný konzultační rámec, který brání nechtěnému přepínání z koučinku do rozdávání rad, a výslovné uzavření konzultace se shrnutím;
- responzivní chatové rozhraní;
- samostatnou Free knihovnu pro byznys, meditace, jógu, aromaterapii, dechová cvičení a další rady;
- vyhledávání, filtrování kategorií a lokální oblíbené položky;
- publikační stavy koncept / připravujeme / zveřejněno / archiv;
- povinné bezpečnostní poznámky u wellbeing obsahu;
- demo režim bez API klíče;
- připojení k Vercel AI Gateway pouze na serveru.

## Spuštění

Požadavky: Node.js 22 nebo novější.

```bash
npm install
npm start
```

Potom otevřete:

```text
http://127.0.0.1:4173
```

Bez API klíče aplikace běží v bezpečném demo režimu: načte profil, vyhledá relevantní záznamy Nii a ukáže, že je potřeba připojit model.

## Připojení AI

Vytvořte Vercel AI Gateway klíč a nastavte jej pouze jako serverovou proměnnou:

```bash
AI_GATEWAY_API_KEY="váš-klíč" npm start
```

Výchozí model pro běžné tahy je `openai/gpt-5.6-luna`; hluboké fáze vedené techniky a výslovné konzultační režimy používají `openai/gpt-5.6-terra`. Starší pilotní hodnoty `openai/gpt-5.4-mini` a `openai/gpt-5.4` se automaticky převedou na dostupný základní model. Obě vrstvy lze změnit:

```bash
AI_GATEWAY_API_KEY="váš-klíč" ELITEA_MODEL="základní/model" ELITEA_DEEP_MODEL="hluboký/model" npm start
```

Klíč nikdy nevkládejte do `public/app.js`, prohlížeče ani chatu.

## Brána koučovací kvality

- Každý koučovací tah po vygenerování prochází kontrolou domyšlených schopností, předčasné rady, rychlé diagnózy, generické šablony, falešné jistoty, návaznosti a počtu otázek.
- Závažně slabá odpověď se nejvýše jednou přepracuje hlubokým modelem. Selhání volitelné opravné generace nezpůsobí výpadek chatu.
- API vrací `qualityGate` a server loguje pouze skóre a kódy problémů, nikoli syrový obsah konverzace.
- Vícekolový regresní dataset je v `data/world-class-coaching-evals.json`; benchmark a důkazní plán jsou v `docs/elitea-world-class-benchmark.md`.

## Připojení rezervací s Niou

Rezervační formulář neposílá chat. Přes Resend odešle pouze údaje z formuláře a případně dokument, který členka předem viděla, upravila a samostatně schválila.

Nastavte na Vercelu serverové proměnné podle `.env.example`:

```text
RESEND_API_KEY
NIA_BOOKING_EMAIL
ELITEA_FROM_EMAIL
```

Bez prvních dvou proměnných aplikace pravdivě oznámí, že doručení zatím není připojené, a nic neodešle.

## Struktura

```text
config/system-prompt.md       behaviorální vrstva Elitey
data/nia-knowledge.jsonl      Nia vrstva z dotazníku
data/everand-knowledge.jsonl  bezpečné knižní syntézy a praktické nástroje pro runtime
data/everand-knowledge-manifest.json ověřený checkpoint 135 zdrojů / 993 nástrojů
data/coaching-methods.json    kurátorovaný registr metod
data/expert-sources.json      odborné zdroje, jejich autorita, použití a limity
data/evaluation-scenarios.json první odborná a bezpečnostní evaluační sada
data/wellbeing-protocols.json bezpečné scénáře zklidnění a vedených meditací
data/master-technique-atlas.json 194 technik s vhodností, omezeními a úrovní přístupu
data/world-class-coaching-evals.json vícekolový benchmark koučovací kvality
data/community-content.json  katalog komunitní Free knihovny
data/expert-expansion-backlog.json další odborné schopnosti v pořadí výzkumu
data/member-memory.json       lokální paměť jedné testovací členky
public/                       chatové rozhraní
src/coaching.js               výběr metody a její bezpečné instrukce
src/knowledge.js              retrieval
scripts/build-everand-knowledge.mjs řízený převod výzkumného korpusu do runtime vrstvy
src/safety.js                 krizový předfiltr
src/memory.js                 bezpečný výběr paměťových polí
src/wellbeing.js              výběr a validace wellbeing protokolu
src/technique-atlas.js        validace a situační router Master Technique Atlasu
src/elitea.js                  sestavení kontextu a volání modelu
src/coaching-quality.js       session intelligence a předodesílací brána kvality
src/server.js                 lokální HTTP server a API
test/                         automatické testy
```

## Důležitá omezení prototypu

- Aktuální nová verze je určená pro uzavřené preview testování, ne pro volný veřejný provoz.
- Používá jednu lokální paměť bez přihlášení a databáze.
- Lokální preview neumožňuje bezpečnou mezizařízení paměť; tu lze zapnout až po doplnění autentizace a databázového oddělení členek.
- Krizový filtr je základní obranná vrstva, nikoli hotový klinický nebo právní systém.
- Před pilotem je nutné doplnit autentizaci, databázi, souhlasy, audit, rate limiting, privacy a lokalizované krizové kontakty.
- Profesní kvalita se musí ověřovat evaluační sadou a lidskou revizí; prompt sám ji negarantuje.
