import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assessCoachCriterionEvidence } from '../src/coach-evidence-rules.js';
import { buildCoachEvidenceLedger } from '../src/coach-evidence-ledger.js';

const LABEL = 'Jsou zmapovány důsledky a možnosti';
const PROVEN_BASELINE = 'Společně porovnáme finanční důsledky i dostupné alternativy.';

const NATURAL_SAFE = Object.freeze([
  'Bylo by chybou přeskočit dopady a možnosti, proto je teď projdeme jednu po druhé.',
  'Neříkám, že peníze a jiné cesty vynecháme — naopak je společně zmapujeme.',
  'Vedle finančních rizik si pojmenujeme i jiné realistické postupy.',
  'Peníze nebudeme řešit izolovaně; dáme je vedle dostupných alternativ.',
  'Chci, abychom si ujasnily jak dopady na rozpočet, tak možnosti mimo první nápad.',
  'Než se rozhodneme, spočítáme náklady a postavíme vedle nich další možné cesty.',
  'Nechci přeskočit dopad na rozpočet ani záložní řešení.',
  'Bude fér probrat, co volba udělá s financemi a jaké jiné varianty máš.',
  'Rozhodnutí uzavřeme až po srovnání ceny, rizik a alternativ.',
  'Pojďme dát vedle sebe finanční důsledky a dvě realistické možnosti.',
  'Zajímají mě jak finanční následky, tak další dostupné cesty.',
  'Ověříme, co tě každá možnost bude stát, včetně varianty nic neměnit.',
  'Nevynecháme cenu, riziko ani jiné možné řešení.',
  'Místo rychlé volby si sepíšeme finanční následky každé dostupné možnosti.',
  'Bolo by chybou preskočiť následky a možnosti, preto ich teraz prejdeme jednu po druhej.',
  'Peniaze nebudeme riešiť izolovane; dáme ich vedľa dostupných alternatív.',
  'Overíme, čo ťa každá možnosť bude stáť, vrátane varianty nič nemeniť.',
  'Nevynecháme cenu, riziko ani iné možné riešenie.',
  'Není pravda, že bychom náklady a možnosti vynechali; právě je porovnáme.',
  'Probereme cenu volby i to, co můžeš udělat jinak.',
  'Nejprve se podíváme na finanční důsledky, potom na jiné cesty.',
  'Popri finančných rizikách si pomenujeme aj iné realistické postupy.',
  'Nie je pravda, že by sme náklady a možnosti vynechali; práve ich porovnáme.',
  'Preberieme cenu voľby aj to, čo môžeš urobiť inak.',
  'Najprv sa pozrieme na finančné dôsledky, potom na iné cesty.',
  'Co to stojí a co lze zvolit jinak patří do stejného rozboru.',
  'Čo to stojí a čo možno zvoliť inak patrí do rovnakého rozboru.',
  'Náklady ani alternativy nenecháme bez povšimnutí.',
  'Náklady ani alternatívy nenecháme bez povšimnutia.',
  'Pozrieme sa nielen na cenu, ale aj na iné uskutočniteľné varianty.',
  'Před volbou dáme do tabulky cenu každé varianty.',
  'Pred voľbou dáme do tabuľky cenu každej varianty.',
  'Na jednu stranu napíšeme dopady, na druhou dostupné cesty.',
  'Na jednu stranu napíšeme dopady, na druhú dostupné cesty.',
  'Vybereme až poté, co zhodnotíme finance a alternativy.',
  'Vyberieme až potom, čo zhodnotíme financie a alternatívy.',
]);

const NATURAL_HARMFUL = Object.freeze([
  'Varianty si sepíšeme. Náklady a rizika do úvahy nevezmeme.',
  'Rozhodni se teď, rozbor financí ani jiných řešení není potřeba.',
  'K penězům ani alternativám se vracet nebudeme.',
  'Pojďme volbu uzavřít bez srovnání dopadů a dalších cest.',
  'Nebudeme ztrácet čas finanční stránkou ani možnostmi okolo.',
  'Vyber jednu cestu; co stojí a jaké jsou jiné možnosti teď vynecháme.',
  'Bez ohledu na náklady i jiné možnosti je tahle volba jasná.',
  'Cenový dopad teď hoďme za hlavu a další možné cesty také.',
  'Rozpočet ani druhou variantu do rozhodnutí tahat nebudeme.',
  'Co tě to bude stát a zda existuje jiná cesta teď není podstatné.',
  'Náklady i ostatní řešení jsou vedlejší; uzavři to.',
  'Peněžní následky a jiné směry teď přeskoč.',
  'Neřeš, kolik to stojí ani co jiného lze udělat.',
  'Nemá cenu probírat dopad na finance nebo jinou možnost.',
  'K finanční stránce ani záložním cestám se už nemusíme vracet.',
  'Srovnání ceny s dalšími postupy si odpustíme.',
  'Nevšímej si rizika pro rozpočet ani jiných variant.',
  'Bez ohledu na finanční ztrátu i jiné cesty do toho jdi.',
  'Nezabývej se důsledky pro rozpočet nebo tím, co by šlo jinak.',
  'Nemá cenu preberať dopad na financie alebo inú možnosť.',
  'Porovnanie ceny s ďalšími postupmi si odpustíme.',
  'Nevšímaj si riziko pre rozpočet ani iné varianty.',
  'O nákladech ani jiných řešeních už nemusíme přemýšlet.',
  'Cenu a jiné možné postupy není nutné porovnávat.',
  'Finanční následky a alternativy můžeme klidně obejít.',
  'Rozhodni sa teraz, rozbor financií ani iných riešení netreba.',
  'Poďme voľbu uzavrieť bez porovnania dopadov a ďalších ciest.',
  'O nákladoch ani iných riešeniach už nemusíme premýšľať.',
  'Cenu a iné možné postupy netreba porovnávať.',
  'Finančné následky a alternatívy môžeme pokojne obísť.',
  'Rozpočtové riziko pusť z hlavy; ostatní možnosti také.',
  'Rozpočtové riziko pusť z hlavy; ostatné možnosti tiež.',
  'Nemusíme otevírat, co to udělá s financemi ani kudy jinudy.',
  'Nemusíme otvárať, čo to urobí s financiami ani kadiaľ ísť inak.',
  'Cenovku a záložní řešení teď z rozhodnutí odřízneme.',
  'Cenu a záložné riešenia teraz z rozhodnutia odrežeme.',
  'Otázka nákladů i dostupných cest je zbytečná.',
  'Otázka nákladov aj dostupných ciest je zbytočná.',
  'Přímé rozhodnutí uděláme bez pohledu na rozpočet nebo alternativy.',
  'Priame rozhodnutie urobíme bez pohľadu na rozpočet alebo alternatívy.',
  'A cenu ani jiné východisko sem teď netahej.',
  'A cenu ani iné východisko sem teraz neťahaj.',
]);

test('přirozené CZ/SK mapování důsledků a možností je skutečný profesní důkaz', () => {
  for (const quote of NATURAL_SAFE) {
    const assessment = assessCoachCriterionEvidence({ label: LABEL, quote });
    assert.equal(assessment.relevant, true, quote);
    assert.equal(assessment.reason, null, quote);
  }
});

test('přirozené CZ/SK opomenutí důsledků nikdy neprojde ani po dřívějším důkazu', () => {
  for (const quote of NATURAL_HARMFUL) {
    const assessment = assessCoachCriterionEvidence({ label: LABEL, quote });
    assert.equal(assessment.relevant, false, quote);
    assert.equal(assessment.reason, 'contradictory_or_harmful_evidence', quote);

    const ledger = buildCoachEvidenceLedger({
      messages: [
        { role: 'user', content: PROVEN_BASELINE },
        { role: 'assistant', content: 'Co dál?' },
        { role: 'user', content: quote },
      ],
      rubric: [LABEL],
    });
    assert.notEqual(ledger.rows[0].status, 'proven', quote);
    assert.ok(ledger.rows[0].observedFailures.length > 0, quote);
  }
});
