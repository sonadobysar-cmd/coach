# Elitea — AI koučink, mentoring a vzdělávací ekosystém v0.37.x

Elitea je český členský prostor, který propojuje AI koučku a mentorku, odborné programy Elitea Academy, praktický nácvik a pracovní nástroje pro podnikatelky.

Aktuální řada `0.37.x` je produkčně připojená implementace určená pro **řízenou betu**. Automatické testy a technické kontroly samy o sobě nedokazují bezchybnost koučování ani převahu nad jinými produkty. Komerční launch zůstává záměrně uzamčený, dokud nebudou doložené požadované lidské kontroly a výsledkové metriky.

## Co je implementované

### Coach & Mentor

- oddělené role koučky, byznys mentorky a Brand & Growth mentorky se skrytým odborným routingem;
- 24 registrovaných metod a Master Technique Atlas se 180 postupy: 140 pro AI koučování, 32 pouze pro podpůrné použití a 8 vyhrazených člověku;
- znalostní vrstva Nii, kurzová vrstva Academy a checkpoint 135 dokončených knižních zdrojů / 993 praktických nástrojů;
- session intelligence, která drží původní zakázku, věcná fakta, opravy klientky, poslední otázku a stav rozehrané techniky;
- předodesílací brána kvality s jednou případnou opravnou generací;
- bezpečnostní a krizový router, oddělení neklinické podpory od zdravotní nebo psychoterapeutické péče;
- upravitelná schválená paměť bez ukládání syrového chatu do dlouhodobého profilu;
- možnost začít nový rozhovor, oddělené relace a serverové limity AI použití.

### Elitea Academy

Aktuální kurzový audit eviduje:

- 27 programů;
- 423 modulů a 2 561 studijních částí;
- 864 praktických cvičení a aplikací;
- 421 interaktivních testů hodnocených serverem;
- 2 178 generovaných tréninkových situací, nejméně 60 pro každý kurz;
- 900 deklarovaných hodin rozdělených do konkrétních lekcí, praxí, simulací a portfoliových aktivit;
- minimálně 160 slov v každé odborné lekci;
- 100% pokrytí studijních částí automaticky sestavenou vizuální mapou.

Vizuální pokrytí znamená obsahově odvozené mapy vykreslené z textu. Neznamená 2 561 ručně vytvořených animací; v aktuálním datasetu mají vlastní autorskou vizuální definici dvě části.

Testy nezveřejňují klíč před odevzdáním a pokusy ukládá server. Ověřují především rozpoznání a porozumění správnému postupu. Praktickou schopnost ověřují odděleně simulace, portfolio a závěrečná AI zkouška.

Každý kurz má vlastní kontext trenérky, studijní režim, simulaci s modelovou klientkou a debrief. Poslední uložená evaluační sada obsahuje 81 lokálních AI běhů — jeden výklad, jednu simulaci a jeden debrief pro každý z 27 kurzů — s výsledkem 81/81. Jde o automatickou lokální kontrolu konfigurací, nikoli o důkaz bezchybnosti všech budoucích produkčních rozhovorů.

### Certifikáty

- způsobilost kontroluje server podle dokončených částí, serverově uznaných testů, portfolia a závěrečné AI zkoušky;
- vydání se ukládá do databáze a PDF se generuje se jménem, názvem programu a skutečným datem dokončení;
- dokument používá podpis integrity bez viditelného QR kódu nebo čísla;
- certifikát potvrzuje dokončení interního programu; konkrétní poznámka kurzu vymezuje, že nejde o státní, zdravotnickou, psychoterapeutickou ani externí platformní kvalifikaci.

Implementace a automatické testy certifikačního toku existují. Úplný živý průchod způsobilého produkčního QA účtu — od postupu přes zkoušku až po vydání a stažení PDF — ještě musí být doložen uloženým QA reportem.

### Členská a provozní vrstva

- Neon Auth a Neon Data API pro účty a oddělený členský stav;
- synchronizace schválené paměti, kurzového postupu, poznámek, pracovních listů, portfolia a oblíbených položek;
- Stripe checkout se sedmidenním trialem, uložením platební metody, webhooky a zákaznickým portálem;
- Resend pro rezervace, provozní a lifecycle e-maily;
- serverové řízení přístupu, AI limitů, původu mutací a bezpečnostních HTTP hlaviček;
- měření sezení před/po, následná kontrola domluveného kroku a anonymní CSV export;
- serverová provozní telemetrie bez ukládání syrového textu chatu do AI metrik.

Přítomnost konfigurace v `/api/health` není živý end-to-end test dodavatele. Kritické členské toky se před komerčním launchem ověřují samostatně.

### Elitea Workspace

Workspace používá Browserbase a Stagehand pro izolovanou vzdálenou relaci v Canvě nebo Meta Ads:

- členka se přihlašuje sama přímo ve vzdáleném prohlížeči;
- Elitea může navrhnout a po potvrzení provést jeden nízkorizikový atomický krok;
- relace a návrhy akcí jsou vázané na konkrétní účet;
- hesla, 2FA, platby, publikace, aktivace kampaně, změny rozpočtu a destruktivní akce musí členka dokončit sama.

Oficiální Meta OAuth/API integrace není součástí aktuálně doložené produkční funkce. Před veřejným slibem tvorby kampaní je nutné živě ověřit Canva export a Meta koncept ve stavu `PAUSED`.

## Obsah, který zatím není vydaný

Samostatná knihovna obsahuje 14 katalogových položek se stavem `planned`. E-booky, profesionální audio nahrávky a videa proto zatím nelze komunikovat jako hotový dostupný obsah.

Kurzové soubory obsahují textové audio scénáře. Aplikace je může přečíst syntetickým hlasem prohlížeče, ale v repozitáři nejsou profesionálně natočené zvukové ani video nahrávky.

Community je v produktu informační a přihlašovací vrstva; vlastní komunitní provoz probíhá mimo aplikaci přes ručně vedený program, WhatsApp a živé cally. Jeho skutečný provoz nelze ověřit pouze ze zdrojového kódu.

## Modely a spuštění

Požadavky: Node.js 24.x.

```bash
npm install
npm start
```

Lokální adresa:

```text
http://127.0.0.1:4173
```

Výchozí modely:

- běžné aplikační tahy: `openai/gpt-5.6-luna`;
- koučovací hodina: `openai/gpt-5.6-sol`;
- hluboké techniky, trenérky a Brand & Growth: `openai/gpt-5.6-terra`.

Nastavení lze změnit serverovými proměnnými:

```bash
AI_GATEWAY_API_KEY="váš-klíč" \
ELITEA_MODEL="základní/model" \
ELITEA_COACH_MODEL="koučovací/model" \
ELITEA_DEEP_MODEL="hluboký/model" \
npm start
```

Úplný seznam proměnných je v `.env.example`. Tajné klíče nikdy nepatří do klientského balíčku, prohlížeče ani chatu.

## Ověření

```bash
npm test
npm run audit:courses
npm run build
```

Živé evaly a produkční QA vyžadují připojený model a odpovídající oprávnění:

```bash
npm run eval:roles
npm run eval:academy-trainers
npm run eval:public-coach
npm run qa:academy-production
npm run qa:certificate-production
```

Přihlášené profesní nácviky používají serverem podepsanou relaci. V produkci nastavte náhodný `ELITEA_TRAINING_SECRET` o délce nejméně 32 bajtů; `CERTIFICATE_SIGNING_SECRET` zůstává odděleným klíčem pro podepsané PDF certifikáty. Ani jeden klíč nepatří do prohlížeče.

Release baseline všech 27 Academy trenérek vznikne pouze jedním čerstvým během všech 81 případů. U vzdáleného běhu je povinná neměnná identita konkrétního deploymentu; `resume` slouží jen k diagnostice a baseline z něj zapsat nelze:

```bash
ELITEA_TRAINER_EVAL_URL="https://konkretni-preview.vercel.app" \
ELITEA_TRAINER_EVAL_JWT="..." \
ELITEA_TRAINER_EVAL_DEPLOYMENT_ID="vercel-deployment-id-nebo-immutable-url" \
npm run eval:academy-trainers -- --write-baseline
```

Baseline ukládá verzi aplikace, commit, přesné modely skutečně pozorované v odpovědích, otisk promptů a evaluačního plánu, identitu deploymentu a počet čerstvých/recyklovaných případů. Zápis se odmítne při špinavém pracovním stromu, odlišném modelu, chybějící provenance nebo jediném recyklovaném výsledku.

`/api/status` je zdroj aktuálních runtime počtů, připojených schopností a launch gate. Pole `ready` znamená, že server sestavil runtime; samostatné `commercialLaunchReady` určuje, zda byly splněné důkazní podmínky komerčního spuštění.

## Aktuální launch fáze

Elitea je v režimu **controlled beta**. Pro `commercial_launch` musí podle `src/launch-readiness.js` současně platit:

- nejméně 500 automatických případů;
- nejméně 81 Academy trainer evalů se 100% úspěšností;
- nejméně 100 lidsky zkontrolovaných sezení;
- žádné kritické selhání;
- grounded pass rate nejméně 98 %;
- integrita rolí nejméně 99 %;
- integrita debriefu nejméně 98 %.

Nevyplňujte výsledkové hodnoty ručně jen kvůli odemčení statusu. Musí vzniknout z dohledatelných QA záznamů. Podrobný aktuální checklist je v `docs/LAUNCH-FOCUS.md`.

Do dokončení tohoto důkazu produkt nekomunikuje tvrzení „nejlepší na světě“, „bezchybný“ ani garantovaný osobní či podnikatelský výsledek.

## Hlavní struktura

```text
config/system-prompt.md                 behaviorální a metodická vrstva Elitey
config/academy-trainer-release.json    poslední uložený Academy eval baseline
data/nia-knowledge.jsonl               znalostní vrstva Nii
data/everand-knowledge.jsonl           knižní syntézy a praktické nástroje
data/everand-knowledge-manifest.json   checkpoint 135 zdrojů / 993 nástrojů
data/coaching-methods.json             registr 24 metod
data/master-technique-atlas.json       180 technik a úrovně přístupu
data/course-*.md                       obsah 27 programů
data/community-content.json            plánovaný katalog knihovny
public/                                klientské rozhraní a právní stránky
src/browser-cloud.js                   přihlášení a synchronizace členského stavu
src/coaching-quality.js                kvalita a návaznost koučovacích tahů
src/training.js                        kurzové trenérky, simulace a debrief
src/certificate-service.js             serverový certifikační tok
src/browser-operator.js                Browserbase / Stagehand Workspace
src/server.js                          HTTP API a runtime status
test/                                  automatické testy
reports/                               uložené evaluační reporty
```
