# Release eval trenérky Profesionální Life Coach

Tato samostatná brána ověřuje, že Academy není pouze katalog výkladů, ale umí vést a přesně vyhodnotit profesní nácvik koučky. Používá 12 živých vícetahových případů v češtině a slovenštině, celkem 58 replik modelové klientky a 12 následných evidence-only debriefů. Součástí jsou tři sekvenční kalibrační dvojice: nejprve záměrně slabý výkon, potom předem definovaný kvalitní výkon v jiném případu stejné rodiny.

Pokrývá kontrakt, aktivní naslouchání, jednu přesnou otázku, volbu intervence a souhlas, respekt odmítnutí, opravu aliance, etické hranice včetně pasivního sebevražedného sdělení, pozorovatelný výsledek a reflexi. Bezpečnostní případ úmyslně obsahuje chybný návrat k běžnému koučování; trenérka projde pouze tehdy, když debrief tuto konkrétní chybu označí jako kritickou a doloží ji správným studentským tahem.

## Dva různé výsledky

- `diagnosticComplete: true` znamená, že právě spuštěný report má 12/12 úspěšných případů, 58/58 replik, 12/12 debriefů a 3/3 kalibračních dvojic. Je to užitečná diagnostika, nikoli oprávnění tvrdit, že je verze připravená k release.
- `releaseEligible: true` navíc vyžaduje jeden čerstvý běh všech 12 unikátních případů, přesná ID standardu, běhu a výsledků, čistý git, úplné otisky aplikace/promptů/eval kódu/plánu, shodu nakonfigurovaných a skutečně použitých modelů, neměnnou identitu testovaného deploymentu a izolaci všech 12 scénářů i všech 70 AI odpovědí.

JWT běh může dosáhnout `diagnosticComplete: true`, ale úmyslně nikdy `releaseEligible: true`. Release eval používá oddělenou serverovou identitu, nečerpá členské limity a nezapisuje passport ani certifikační důkazy.

## Diagnostické spuštění

Nejprve spusť aplikaci s reálným AI providerem, potom v druhém terminálu:

```bash
ELITEA_COACH_READINESS_EVAL_URL=http://127.0.0.1:4173 npm run eval:coach-readiness
```

Pro přihlášený členský tok lze přidat testovací JWT. Tento běh je vždy pouze diagnostický:

```bash
ELITEA_COACH_READINESS_EVAL_URL=http://127.0.0.1:4173 \
ELITEA_COACH_READINESS_EVAL_JWT='testovaci-token' \
npm run eval:coach-readiness
```

Jednotlivý případ lze při diagnostice spustit přes `--case=cs-refusal-and-alliance-repair`. Takový dílčí běh je diagnostický a záměrně nemůže mít stav kompletní release brány.

## Zápis release artefaktu

Server musí mít nastavené dvě různé hodnoty o délce nejméně 32 bajtů:

- `ELITEA_RELEASE_EVAL_SECRET` autentizuje runner a podepisuje runtime claim. Runner dostane stejnou hodnotu přes `ELITEA_COACH_READINESS_EVAL_TOKEN` (nebo `--eval-token`) a posílá ji pouze v hlavičce `x-elitea-release-eval-token`.
- `ELITEA_RELEASE_ATTESTATION_SECRET` zůstává pouze na serveru. Podepisuje každý krok, celý transcript chain a závěrečnou atestaci; runner tuto hodnotu nikdy nedostane.

Obě hodnoty vygeneruj nezávisle. Pokud jsou stejné, health check, release endpointy i validace release artefaktu záměrně selžou zavřeně; jinak by runner znal i klíč určený výhradně pro serverovou atestaci.

Release běh dále vyžaduje `DATABASE_URL` a připravené runtime schéma. Databázový ledger dovolí každý `run/case/phase/step` rezervovat právě jednou, takže nelze větvit stejný krok a do reportu vybrat jen příznivější odpověď.

Pro vzdálený release používej přímo neměnnou deployment-specific Vercel URL, ne `elitea.cz`, produkční alias ani branch alias. Současně nastav skutečné Vercel deployment ID `dpl_…`:

```bash
ELITEA_COACH_READINESS_EVAL_URL='https://elitea-DEPLOYMENT_HASH-team.vercel.app' \
ELITEA_COACH_READINESS_EVAL_TOKEN='stejna-hodnota-jako-server-secret' \
ELITEA_COACH_READINESS_DEPLOYMENT_ID='dpl_SKUTECNE_DEPLOYMENT_ID' \
npm run eval:coach-readiness -- --write-release
```

Při úspěchu vznikne vedle soukromého diagnostického reportu také `config/professional-coach-trainer-release.json`. Vlastní cestu lze zvolit přes `--release-artifact=SOUBOR` nebo `ELITEA_COACH_READINESS_RELEASE_ARTIFACT`.

Preflight běh zastaví ještě před první AI žádostí, pokud je pracovní strom špinavý, chybí release token nebo deployment provenance, jde jen o dílčí případ nebo je zároveň použit členský JWT. Pokud selže některý live případ, modelová shoda či izolace, diagnostický report se uloží, ale release artefakt se nezapíše.

Vercel dodává `VERCEL_GIT_COMMIT_SHA` automaticky pro Git deploymenty. Mimo Git deployment musí server dostat přesný commit v `ELITEA_RELEASE_GIT_COMMIT_SHA`. Lokální release kontrola používá identitu `local:<git SHA>`, ale server stále potřebuje `ELITEA_RELEASE_GIT_COMMIT_SHA`, oba podpisové secrets, databázi, čistý git a izolovaný eval token.

Volitelné proměnné:

- `ELITEA_COACH_READINESS_EVAL_TIMEOUT_MS` — limit jednoho AI volání, výchozí 180 000 ms;
- `ELITEA_COACH_READINESS_EVAL_CONCURRENCY` — souběžné případy, 1 až 3, výchozí 2;
- `ELITEA_COACH_READINESS_EVAL_REPORT` — vlastní cesta reportu;
- `ELITEA_COACH_READINESS_EVAL_TOKEN` — tajemství izolovaného release eval účtu; nesmí se ukládat do reportu;
- `ELITEA_COACH_READINESS_DEPLOYMENT_ID` — neměnné `dpl_…` ID testovaného deploymentu;
- `ELITEA_COACH_READINESS_RELEASE_ARTIFACT` — vlastní cesta release artefaktu.

Bez argumentu se report uloží do `reports/professional-coach-readiness/`. Samotný report se zapisuje pro diagnostiku i při neúspěchu; release artefakt pouze při všech splněných podmínkách.

## Soukromí a význam výsledku

Report neukládá text studentských vstupů, odpovědi modelové klientky, debrief, JWT ani release token. Ukládá jen názvy kontrol, bezpečné kódy, délky, latence, identity modelů/deploymentu, serverové podpisy a SHA-256 otisky. Běh je syntetický live-model eval. Kalibrační dvojice dokazují konzistenci rozpoznání slabého a kvalitního výkonu, nikoli to, že debrief způsobil u člověka učení nebo přenos dovednosti. To se měří až z různých skutečných nácviků studentky v competency passportu (`masteryGain`) a následně lidskou supervizí. Běh nenahrazuje uživatelské testování ani 100 lidsky zkontrolovaných sezení a sám nedokazuje účinnost koučování na skutečných klientkách.
