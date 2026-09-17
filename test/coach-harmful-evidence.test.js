import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectCoachCriticalFailures } from '../src/coach-competencies.js';
import { assessCoachCriterionEvidence } from '../src/coach-evidence-rules.js';
import { buildCoachEvidenceLedger } from '../src/coach-evidence-ledger.js';

const ADVERSARIAL_CASES = Object.freeze([
  Object.freeze({
    label: 'Jasný kontrakt a výsledek rozhovoru',
    previous: 'Chci si ujasnit, jestli je program pro mě.',
    cs: 'Cíl rozhovoru vyjasním já: budeš souhlasit s koupí programu. Jak poznáš, že jsi objednávku dokončila?',
    sk: 'Cieľ rozhovoru určím ja: budeš súhlasiť s kúpou programu. Ako spoznáš, že si objednávku dokončila?',
    criticalCode: 'client_decision_takeover',
  }),
  Object.freeze({
    label: 'Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání',
    previous: 'Nevím, zda mám v práci zůstat.',
    cs: 'Rozhodnutí zůstává na tobě. Odchod ze zaměstnání je podmínkou pokračování.',
    sk: 'Rozhodnutie zostáva na tebe. Odchod zo zamestnania je podmienkou pokračovania.',
    criticalCode: 'client_decision_takeover',
  }),
  Object.freeze({
    label: 'Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání',
    previous: 'Výpověď posílat nechci.',
    cs: 'Rozhodnutí je na tobě. Výpověď jsem však už tvým jménem odeslala.',
    sk: 'Rozhodnutie je na tebe. Výpoveď som však už tvojím menom odoslala.',
    criticalCode: 'client_decision_takeover',
  }),
  Object.freeze({
    label: 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu',
    previous: 'Je certifikát ICF akreditovaný?',
    cs: 'Interní certifikát není obyčejný, je ICF akreditace.',
    sk: 'Interný certifikát nie je obyčajný, je ICF akreditácia.',
    criticalCode: 'false_credential_claim',
  }),
  Object.freeze({
    label: 'Jsou zmapovány důsledky a možnosti',
    previous: 'Co mám před odchodem zvážit?',
    cs: 'Finanční důsledky ani jiné varianty mapovat nebudeme.',
    sk: 'Finančné následky ani iné varianty mapovať nebudeme.',
    criticalCode: null,
  }),
  Object.freeze({
    label: 'Výslovné odmítnutí je respektováno a klientčina autonomie zůstává zachována',
    previous: 'Tuto techniku odmítám.',
    cs: 'Když odmítneš, použijeme ji stejně.',
    sk: 'Ak odmietneš, použijeme ju aj tak.',
    criticalCode: 'client_autonomy_override',
  }),
]);

test('škodlivé rozpory nelze použít jako profesní důkaz v češtině ani slovenštině', () => {
  for (const sample of ADVERSARIAL_CASES) {
    for (const language of ['cs', 'sk']) {
      const quote = sample[language];
      const assessment = assessCoachCriterionEvidence({
        label: sample.label,
        quote,
        previousCounterpartText: sample.previous,
      });
      assert.equal(assessment.relevant, false, `${language}: ${quote}`);
      assert.equal(assessment.reason, 'contradictory_or_harmful_evidence', `${language}: ${quote}`);

      const messages = [
        { role: 'assistant', content: sample.previous },
        { role: 'user', content: quote },
      ];
      const ledger = buildCoachEvidenceLedger({
        messages,
        rubric: [sample.label],
        responseLanguage: language,
      });
      assert.equal(ledger.rows[0].status, 'not_proven', `${language}: ${quote}`);
      assert.deepEqual(ledger.rows[0].evidence, [], `${language}: ${quote}`);
    }
  }
});

test('kritická brána označí převzetí rozhodnutí, falešnou kvalifikaci a přepsání odmítnutí', () => {
  for (const sample of ADVERSARIAL_CASES.filter(candidate => candidate.criticalCode)) {
    for (const language of ['cs', 'sk']) {
      const quote = sample[language];
      const failures = detectCoachCriticalFailures([
        { role: 'assistant', content: sample.previous },
        { role: 'user', content: quote },
      ]);
      assert.ok(
        failures.some(failure => failure.code === sample.criticalCode),
        `${language}: ${sample.criticalCode}: ${quote}`,
      );
    }
  }
});

test('bezpečné negace neaktivují škodlivou polaritu', () => {
  const safeCases = [
    ['Jasný kontrakt a výsledek rozhovoru', 'Cíl rozhovoru nevyjasním já; dohodneme ho spolu a nemusíš souhlasit s koupí programu.'],
    ['Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání', 'Odchod ze zaměstnání není podmínkou pokračování.'],
    ['Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání', 'Výpověď tvým jménem neodešlu.'],
    ['Pravdivé vysvětlení nabídky, ceny a interního certifikátu', 'Výsledek nemohu garantovat. Certifikát je interní a není ICF akreditace.'],
    ['Jsou zmapovány důsledky a možnosti', 'Finanční důsledky i jiné varianty společně zmapujeme.'],
    ['Výslovné odmítnutí je respektováno a klientčina autonomie zůstává zachována', 'Když odmítneš, nepoužijeme ji.'],
    ['Jasný kontrakt a výsledek rozhovoru', 'Cieľ rozhovoru neurčím ja; dohodneme ho spolu a nemusíš súhlasiť s kúpou programu.'],
    ['Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání', 'Odchod zo zamestnania nie je podmienkou pokračovania.'],
    ['Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání', 'Výpoveď tvojím menom neodošlem.'],
    ['Pravdivé vysvětlení nabídky, ceny a interního certifikátu', 'Výsledok nemôžem garantovať. Certifikát je interný a nie je ICF akreditácia.'],
    ['Jsou zmapovány důsledky a možnosti', 'Finančné následky aj iné varianty spoločne zmapujeme.'],
    ['Výslovné odmítnutí je respektováno a klientčina autonomie zůstává zachována', 'Ak odmietneš, nepoužijeme ju.'],
  ];

  for (const [label, quote] of safeCases) {
    const assessment = assessCoachCriterionEvidence({ label, quote });
    assert.notEqual(assessment.reason, 'contradictory_or_harmful_evidence', quote);
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
  }

  for (const quote of [
    'Výsledek nemohu garantovat. Certifikát je interní a není ICF akreditace.',
    'Výsledok nemôžem garantovať. Certifikát je interný a nie je ICF akreditácia.',
  ]) {
    assert.equal(assessCoachCriterionEvidence({
      label: 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu',
      quote,
    }).relevant, true, quote);
  }
});

test('negace před mapováním důsledků nemůže vytvořit profesní důkaz', () => {
  const label = 'Jsou zmapovány důsledky a možnosti';
  const unsafe = [
    'Nebudeme zkoumat finanční dopady ani alternativy.',
    'Nebudeme mapovat možnosti ani finanční důsledky.',
    'Nebudeme porovnávat finanční následky ani jiné možnosti.',
    'Finanční důsledky ani možnosti posuzovat nebudeme.',
    'Nevyhodnotíme alternativy ani finanční dopady.',
    'Nebudeme skúmať finančné dopady ani alternatívy.',
    'Nebudeme mapovať možnosti ani finančné následky.',
    'Nebudeme porovnávať finančné následky ani iné možnosti.',
    'Finančné dôsledky ani možnosti posudzovať nebudeme.',
    'Nevyhodnotíme alternatívy ani finančné dopady.',
    'Finanční dopady ani alternativní postupy porovnávat nechci.',
    'Nechci mapovat finanční dopady ani jiné možnosti.',
    'Nechcem mapovať finančné dopady ani iné možnosti.',
    'Odmítám porovnat finanční důsledky a jiné alternativy.',
    'Odmietam porovnať finančné dôsledky a iné alternatívy.',
    'Nemám v plánu řešit finanční dopady ani jiné možnosti.',
    'Nemám v pláne riešiť finančné dopady ani iné možnosti.',
    'Nechystám se zabývat finančními důsledky ani alternativami.',
    'Nechystám sa zaoberať finančnými dôsledkami ani alternatívami.',
    'Nemám vůbec v úmyslu společně porovnávat finanční dopady a jiné možnosti.',
    'Nemám v úmysle preskúmať finančné dopady a iné možnosti.',
    'Finanční dopady a alternativy necháme bez porovnání.',
    'Finančné dopady a alternatívy ponecháme bez preskúmania.',
    'Porovnání finančních dopadů a alternativ se vyhneme.',
    'Preskúmaniu finančných dopadov a alternatív sa vyhneme.',
    'Finanční dopady a alternativy vynecháme.',
    'Finanční dopady ani alternativy nehodlám porovnávat.',
    'Finančné následky a alternatívy nemienim porovnávať.',
    'Nebudeme zvažovat finanční důsledky ani jiné možnosti.',
    'Finanční dopady a alternativy nebudu brát v úvahu.',
    'Finanční dopady a další možnosti pomineme.',
    'O finančních následcích a alternativách nechci ani přemýšlet.',
    'Nebudeme zvažovať finančné následky ani iné možnosti.',
    'Finančné následky a alternatívy nevezmeme do úvahy.',
    'Nemáme záujem rozoberať finančné následky ani alternatívy.',
    'Nebudeme si dělat přehled finančních dopadů ani jiných možností.',
    'Finanční dopady a možnosti nebudeme dávat vedle sebe.',
    'Dopady i alternativy ignorujeme.',
    'Finanční dopady ani jiné možnosti do rozhodování nezahrneme.',
    'Finanční dopady a alternativy vytěsníme z debaty.',
    'O finančních dopadech a možnostech se bavit nebudeme.',
    'Nebudeme si robiť prehľad finančných následkov ani iných možností.',
    'Finančné následky a možnosti nebudeme dávať vedľa seba.',
    'Následky aj alternatívy ignorujeme.',
    'Finančné následky ani iné možnosti do rozhodovania nezahrnieme.',
    'Finančné následky a alternatívy vytlačíme z debaty.',
    'O finančných následkoch a možnostiach sa baviť nebudeme.',
    'Finančné dopady a alternatívy preskočíme.',
  ];
  for (const quote of unsafe) {
    const assessment = assessCoachCriterionEvidence({ label, quote });
    assert.equal(assessment.relevant, false, quote);
    assert.equal(assessment.reason, 'contradictory_or_harmful_evidence', quote);
  }

  for (const quote of [
    'Společně zmapujeme finanční dopady i jiné možnosti.',
    'Spoločne zmapujeme finančné dopady aj iné možnosti.',
    'Finančné dôsledky a alternatívy spolu preskúmame.',
    'Nebudeme zkoumat jen finanční dopady, ale i bezpečnější alternativy.',
    'Nebudeme skúmať len finančné dopady, ale aj bezpečnejšie alternatívy.',
    'Nebudeme neporovnávat finanční následky ani jiné možnosti.',
    'Nebudeme neporovnávať finančné následky ani iné možnosti.',
    'Není pravda, že nebudeme posuzovat finanční dopady ani jiné možnosti.',
    'Nie je pravda, že nebudeme posudzovať finančné dopady ani iné možnosti.',
    'Nevyhodnotit finanční dopady ani možnosti by bylo nezodpovědné.',
    'Nevyhodnotiť finančné dopady ani možnosti by bolo nezodpovedné.',
    'Nechci mapovat jen finanční dopady, ale i bezpečnější alternativy.',
    'Nechcem mapovať len finančné dopady, ale aj bezpečnejšie alternatívy.',
    'Nechci jen mapovat finanční dopady, ale i bezpečnější možnosti.',
    'Nechcem iba mapovať finančné dopady, ale aj bezpečnejšie možnosti.',
    'Nechci mapovat finanční dopady bez zohlednění bezpečnějších alternativ.',
    'Nechcem mapovať finančné dopady bez zahrnutia bezpečnejších alternatív.',
    'Nechci neporovnávat finanční následky ani jiné možnosti.',
    'Nechcem neporovnávať finančné následky ani iné možnosti.',
    'Nemůžeme neporovnat finanční dopady a dostupné alternativy.',
    'Nemôžeme nepreskúmať finančné dopady a dostupné alternatívy.',
    'Není možné neporovnat finanční dopady a dostupné alternativy.',
    'Nie je možné nepreskúmať finančné dopady a dostupné alternatívy.',
    'Nechci pominout finanční dopady ani jiné možnosti.',
    'Nechcem vynechať finančné následky ani alternatívy.',
    'Nebudeme ignorovat finanční dopady ani dostupné alternativy.',
    'Nebudeme ignorovať finančné následky ani dostupné alternatívy.',
    'Finanční dopady nebudeme mapovat, aniž bychom zahrnuli alternativy.',
    'Finanční dopady nebudeme mapovat odděleně od alternativ.',
    'Finanční dopady nechci mapovat izolovaně; porovnáme je s alternativami.',
    'Nechci pouze mapovat dopady; chci porovnat i alternativy.',
    'Finančné následky nechcem mapovať izolovane; porovnáme ich s alternatívami.',
  ]) {
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }

  assert.equal(
    assessCoachCriterionEvidence({
      label,
      quote: 'Finančné dôsledky a alternatívy spolu preskúmame.',
    }).relevant,
    true,
  );
});

test('budoucí falešná akreditace je kritická a zůstává sticky po dřívější pravdivé větě', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const truthful = 'Výsledek nemohu garantovat. Interní certifikát není ICF akreditace.';
  const unsafe = [
    'Náš certifikát bude ICF akreditovaný a dá ti oficiální licenci kouče.',
    'Náš certifikát bude ICF akreditovaný a dá ti oficiálnu licenciu kouča.',
    'Po absolvování obdržíš ICF akreditaci a oficiální licenci kouče.',
    'Po dokončení kurzu získáš ICF akreditaci a oficiální licenci kouče.',
    'Po absolvovaní dostaneš ICF akreditáciu a oficiálnu licenciu kouča.',
    'Po dokončení kurzu nadobudneš ICF akreditáciu a oficiálnu licenciu kouča.',
    'Tento kurz ti po dokončení přinese ICF akreditaci.',
    'Po kurze obdržíte licenciu profesionálneho kouča.',
    'Náš interní certifikát se po dokončení promění v ICF akreditaci.',
    'Po kurzu obdrží absolvent licenci profesionálního kouče.',
    'Po kurze získajú absolventi licenciu profesionálneho kouča.',
    'Kurz vám zajistí oficiální licenci profesionálního kouče.',
    'Kurz vás opravňuje pracovat jako licencovaný profesionální kouč.',
    'Po absolvování programu vám bude vydána licence profesionálního kouče.',
    'Absolvování programu přinese licenci profesionálního kouče.',
    'Kurz vám zabezpečí oficiálnu licenciu profesionálneho kouča.',
    'Program oprávňuje absolventov pracovať ako licencovaní profesionálni kouči.',
    'Program vede k ICF akreditaci.',
    'Program vedie k ICF akreditácii.',
    'Program zakládá nárok na licenci profesionálního kouče.',
    'Program zakladá nárok na licenciu profesionálneho kouča.',
    'Kurz vás kvalifikuje jako licencovaného profesionálního kouče.',
    'Kurz vás kvalifikuje ako licencovaného profesionálneho kouča.',
    'Výcvik garantuje ICF certifikaci.',
    'Výcvik garantuje ICF certifikáciu.',
  ];

  for (const quote of unsafe) {
    const failures = detectCoachCriticalFailures([{ role: 'user', content: quote }]);
    assert.ok(failures.some(failure => failure.code === 'false_credential_claim'), quote);
    assert.equal(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );

    const ledger = buildCoachEvidenceLedger({
      messages: [
        { role: 'user', content: truthful },
        { role: 'assistant', content: 'Co ještě potřebujete vědět?' },
        { role: 'user', content: quote },
      ],
      rubric: [label],
    });
    assert.equal(ledger.rows[0].status, 'not_proven', quote);
    assert.ok(ledger.rows[0].criticalFailures.some(failure => failure.code === 'false_credential_claim'), quote);
  }

  for (const quote of [
    'Náš certifikát nebude ICF akreditovaný a nedá ti oficiální licenci kouče.',
    'Náš certifikát bude interní a nebude ICF akreditovaný ani ti nedá oficiálnu licenciu kouča.',
    'Není pravda, že náš certifikát bude ICF akreditovaný.',
    'Nie je pravda, že náš certifikát bude ICF akreditovaný.',
    'Po absolvování nezískáš ICF akreditaci ani oficiální licenci kouče.',
    'Po absolvovaní nezískaš ICF akreditáciu ani oficiálnu licenciu kouča.',
    'Není pravda, že po dokončení kurzu obdržíš ICF akreditaci.',
    'Nie je pravda, že po dokončení kurzu dostaneš ICF akreditáciu.',
    'Po absolvování dostaneš interní certifikát, nikoli ICF akreditaci.',
    'Po absolvovaní dostaneš interný certifikát, nie ICF akreditáciu.',
    'Tento kurz ti po dokončení nepřinese ICF akreditaci.',
    'Po kurze neobdržíte licenciu profesionálneho kouča.',
    'Náš interní certifikát se po dokončení nepromění v ICF akreditaci.',
    'Kurz vám přinese potvrzení, že nezískáte ICF akreditaci.',
    'Kurz vám prinesie potvrdenie, že nezískate ICF akreditáciu.',
    'Kurz vám přinese potvrzení, že ICF akreditaci nezískáte.',
    'Kurz vám prinesie potvrdenie, že ICF akreditáciu nezískate.',
    'Kurz poskytuje informace o tom, jak funguje ICF akreditace.',
    'Kurz poskytuje informácie o tom, ako funguje ICF akreditácia.',
    'Program poskytuje přehled možností ICF akreditace.',
    'Program poskytuje prehľad možností ICF akreditácie.',
    'Kurz vede k lepšímu pochopení procesu ICF akreditace.',
    'Kurz vedie k lepšiemu porozumeniu procesu ICF akreditácie.',
    'Program umožní absolventce podat žádost o ICF akreditaci.',
    'Program umožní absolventke podať žiadosť o ICF akreditáciu.',
    'Po kurzu absolvent licenci profesionálního kouče neobdrží.',
    'Po kurze absolventi licenciu profesionálneho kouča nezískajú.',
  ]) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('credential brána rozpozná vlastnictví, výsledek, příslib, pasivum a profesní status v CZ/SK', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const unsafe = [
    'Kurz má ICF akreditaci.',
    'Tento program je ICF akreditovaný.',
    'Absolventi jsou ICF certifikovaní kouči.',
    'Po kurzu se stanete licencovanou profesionální koučkou.',
    'Program z vás učiní ICF certifikovanou koučku.',
    'Program slibuje ICF akreditaci.',
    'Výsledkem programu je ICF akreditace.',
    'Po absolvování programu vám bude přiznána licence profesionálního kouče.',
    'Není pravda, že program nevede k ICF akreditaci.',
    'Kurz není akreditovaný, ale absolventi jsou licencovaní profesionální kouči.',
    'Tvrzení, že kurz má ICF akreditaci, je pravdivé.',
    'Tvrzení, že kurz má ICF akreditaci, není nepravdivé.',
    'Kurz má ICF akreditáciu.',
    'Tento program je ICF akreditovaný.',
    'Absolventi sú ICF certifikovaní kouči.',
    'Po kurze sa stanete licencovanou profesionálnou koučkou.',
    'Program z vás urobí ICF certifikovanú koučku.',
    'Program sľubuje ICF akreditáciu.',
    'Výsledkom programu je ICF akreditácia.',
    'Po absolvovaní programu vám bude priznaná licencia profesionálneho kouča.',
    'Nie je pravda, že program nevedie k ICF akreditácii.',
    'Kurz nie je akreditovaný, ale absolventi sú licencovaní profesionálni kouči.',
    'Tvrdenie, že kurz má ICF akreditáciu, je pravdivé.',
    'Tvrdenie, že kurz má ICF akreditáciu, nie je nepravdivé.',
  ];

  for (const quote of unsafe) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content: quote }])
        .some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
    assert.equal(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('credential brána neblokuje výuku, externí žádost, odmítnutí ani nepravdivý citát', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const safe = [
    'Kurz vysvětluje, kdo uděluje ICF akreditaci.',
    'Kurz učí, jak získat ICF akreditaci mimo tento program.',
    'Poskytujeme podporu při samostatné žádosti o ICF akreditaci.',
    'Program umožní podat vlastní žádost o ICF akreditaci.',
    'Tento program, navzdory rozsahu a profesnímu zaměření celého studia, není ICF akreditovaný.',
    'Není pravda, že program vede k ICF akreditaci.',
    'Tvrzení, že kurz má ICF akreditaci, není pravdivé.',
    'Je nepravdivé tvrdit, že absolventi jsou ICF certifikovaní kouči.',
    'Kurz vysvetľuje, kto udeľuje ICF akreditáciu.',
    'Kurz učí, ako získať ICF akreditáciu mimo tohto programu.',
    'Poskytujeme podporu pri samostatnej žiadosti o ICF akreditáciu.',
    'Program umožní podať vlastnú žiadosť o ICF akreditáciu.',
    'Tento program napriek rozsahu a profesijnému zameraniu celého štúdia nie je ICF akreditovaný.',
    'Nie je pravda, že program vedie k ICF akreditácii.',
    'Tvrdenie, že kurz má ICF akreditáciu, nie je pravdivé.',
    'Je nepravdivé tvrdiť, že absolventi sú ICF certifikovaní kouči.',
  ];

  for (const quote of safe) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('krátký souhlas převezme credential tvrzení z otázky a zůstane sticky', () => {
  const prompts = [
    'Je tento program ICF akreditovaný?',
    'Dostanou absolventi licenci profesionálního kouče?',
    'Je tento program ICF akreditovaný?',
    'Dostanú absolventi licenciu profesionálneho kouča?',
  ];
  const assents = ['Ano, je.', 'Přesně tak.', 'Áno, je.', 'Presne tak.'];
  for (let index = 0; index < prompts.length; index += 1) {
    const messages = [
      { role: 'assistant', content: prompts[index] },
      { role: 'user', content: assents[index] },
      { role: 'assistant', content: 'Děkuji.' },
      { role: 'user', content: 'Interní certifikát není ICF akreditace.' },
    ];
    const failures = detectCoachCriticalFailures(messages);
    assert.ok(failures.some(failure => failure.code === 'false_credential_claim'), `${prompts[index]} / ${assents[index]}`);

    const ledger = buildCoachEvidenceLedger({
      messages,
      rubric: ['Pravdivé vysvětlení nabídky, ceny a interního certifikátu'],
    });
    assert.equal(ledger.rows[0].status, 'not_proven');
  }

  for (const correction of [
    'Ne, není. Jde pouze o interní certifikát.',
    'Nie, nie je. Ide iba o interný certifikát.',
  ]) {
    assert.deepEqual(detectCoachCriticalFailures([
      { role: 'assistant', content: 'Je tento program ICF akreditovaný?' },
      { role: 'user', content: correction },
    ]), [], correction);
  }
});

test('credential brána drží nové stavové formulace a neblokuje pravdivé hranice CZ/SK', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const unsafe = [
    'Po tomto studiu budete držitelkou profesionální licence ICF.',
    'Po zkoušce se z vás stane státem uznávaná koučka.',
    'Je to plnohodnotná akreditace podle ICF.',
    'Tento certifikát představuje profesionální oprávnění kouče.',
    'Po tomto štúdiu budete držiteľkou profesionálnej licencie ICF.',
    'Po skúške sa z vás stane štátom uznávaná koučka.',
    'Je to plnohodnotná akreditácia podľa ICF.',
    'Tento certifikát predstavuje profesionálne oprávnenie kouča.',
  ];
  for (const quote of unsafe) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content: quote }])
        .some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
    assert.equal(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }

  const safe = [
    'Certifikát nepotvrzuje oprávnění používat titul licencovaná koučka.',
    'Nemůžeme slíbit, že po kurzu získáte ICF akreditaci.',
    'Absolventka si může později podat vlastní žádost o ICF certifikaci.',
    'Certifikát nepotvrdzuje oprávnenie používať titul licencovaná koučka.',
    'Nemôžeme sľúbiť, že po kurze získate ICF akreditáciu.',
    'Absolventka si môže neskôr podať vlastnú žiadosť o ICF certifikáciu.',
  ];
  for (const quote of safe) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('credential brána pokrývá titul, status, oprávnění i přirozené odmítnutí CZ/SK', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const unsafe = [
    'Po závěrečné zkoušce obdržíš oprávnění působit jako profesionální koučka.',
    'Absolvováním studia získáváš status licencované koučky.',
    'Díky programu budeš oficiálně kvalifikovaná koučka.',
    'Po úspěšném konci můžeš používat titul akreditovaná koučka.',
    'Kurz zajišťuje uznávanou kvalifikaci pro výkon koučovací profese.',
    'Certifikát má stejnou váhu jako profesní licence.',
    'Závěrečný dokument tě opravňuje vystupovat jako licencovaný coach.',
    'Po absolvování jsi státem uznaná profesionální koučka.',
    'Úspěšné složení testu zakládá profesní licenci.',
    'Tento diplom dokládá ICF kvalifikaci absolventky.',
    'Naše absolventky mají oficiální oprávnění koučovat.',
    'Po záverečnej skúške dostaneš oprávnenie pôsobiť ako profesionálna koučka.',
    'Absolvovaním štúdia získavaš status licencovanej koučky.',
    'Vďaka programu budeš oficiálne kvalifikovaná koučka.',
    'Po úspešnom konci môžeš používať titul akreditovaná koučka.',
    'Kurz zabezpečuje uznávanú kvalifikáciu pre výkon koučovacej profesie.',
    'Certifikát má rovnakú váhu ako profesijná licencia.',
    'Záverečný dokument ťa oprávňuje vystupovať ako licencovaný coach.',
    'Po absolvovaní si štátom uznaná profesionálna koučka.',
    'Úspešné zloženie testu zakladá profesijnú licenciu.',
    'Tento diplom dokladá ICF kvalifikáciu absolventky.',
    'Naše absolventky majú oficiálne oprávnenie koučovať.',
  ];
  for (const quote of unsafe) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content: quote }])
        .some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
    assert.equal(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }

  for (const quote of [
    'Osvědčení je interní a nenahrazuje profesní licenci.',
    'Je mylné tvrdit, že absolventky mají automaticky oficiální licenci.',
    'Osvedčenie je interné a nenahrádza profesijnú licenciu.',
    'Je mylné tvrdiť, že absolventky majú automaticky oficiálnu licenciu.',
  ]) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('přirozený krátký souhlas zdědí falešné credential tvrzení a zůstane sticky', () => {
  const prompts = [
    'Je tento program ICF akreditovaný?',
    'Dostanu po kurzu oficiální licenci koučky?',
  ];
  const assents = [
    'Jo.', 'Jasně.', 'Bezpochyby.', 'Tak to je.', 'Je to tak.', 'To sedí.',
    'Stoprocentně.', 'Rozhodně.', 'Samo sebou.', 'Jasná věc.', 'Ano samozřejmě.',
    'Určitě ano.', 'Pochopitelně.',
    'Hej.', 'Jasné.', 'Bezpochyby.', 'Tak to je.', 'Je to tak.', 'To sedí.',
    'Stopercentne.', 'Rozhodne.', 'Pravda.', 'Jasná vec.', 'Áno, samozrejme.',
    'Určite áno.', 'Pochopiteľne.',
  ];
  for (const [index, assent] of assents.entries()) {
    const messages = [
      { role: 'assistant', content: prompts[index % prompts.length] },
      { role: 'user', content: assent },
      { role: 'assistant', content: 'Rozumím.' },
      { role: 'user', content: 'Ne, jde jen o interní certifikát.' },
    ];
    assert.ok(
      detectCoachCriticalFailures(messages)
        .some(failure => failure.code === 'false_credential_claim'),
      assent,
    );
    assert.equal(buildCoachEvidenceLedger({
      messages,
      rubric: ['Pravdivé vysvětlení nabídky, ceny a interního certifikátu'],
    }).rows[0].status, 'not_proven', assent);
  }
});

test('credential generalizace zachytí 30 přirozených statusových tvrzení bez CZ/SK false positive', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const unsafe = [
    'Interní certifikát se počítá jako mezinárodně uznávaná licence.',
    'Absolvováním získáš oprávnění pracovat jako profesionální kouč.',
    'S osvědčením můžeš právem používat titul ICF koučka.',
    'Program automaticky opravňuje koučovat profesionálně.',
    'Jde o plnohodnotnou ICF akreditaci.',
    'Doklad prokazuje, že jsi licencovaná.',
    'Po zkoušce budeš certifikovaná podle ICF.',
    'S certifikátem se z tebe stává akreditovaná profesionálka.',
    'Závěrečný dokument potvrzuje status akreditované profesionálky.',
    'Dokončení studia z tebe udělá oficiálně kvalifikovanou koučku.',
    'Tento certifikát znamená uznávanou licenci.',
    'Diplom představuje ICF kvalifikaci.',
    'Kurz uděluje oprávnění profesionálně koučovat.',
    'Po programu můžeš používat titul licencovaná koučka.',
    'Úspěšná zkouška zakládá akreditaci kouče.',
    'Interný certifikát sa počíta ako medzinárodne uznávaná licencia.',
    'Absolvovaním získaš oprávnenie pracovať ako profesionálna koučka.',
    'S osvedčením môžeš právom používať titul ICF koučka.',
    'Program automaticky oprávňuje koučovať profesionálne.',
    'Ide o plnohodnotnú ICF akreditáciu.',
    'Doklad preukazuje, že si licencovaná.',
    'Po skúške budeš certifikovaná podľa ICF.',
    'S certifikátom sa z teba stáva akreditovaná profesionálka.',
    'Záverečný dokument potvrdzuje status akreditovanej profesionálky.',
    'Dokončenie štúdia z teba urobí oficiálne kvalifikovanú koučku.',
    'Tento certifikát znamená uznávanú licenciu.',
    'Diplom predstavuje ICF kvalifikáciu.',
    'Kurz udeľuje oprávnenie profesionálne koučovať.',
    'Po programe môžeš používať titul licencovaná koučka.',
    'Úspešná skúška zakladá akreditáciu kouča.',
  ];

  for (const quote of unsafe) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content: quote }])
        .some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
    assert.equal(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );

    const ledger = buildCoachEvidenceLedger({
      messages: [
        { role: 'user', content: quote },
        { role: 'assistant', content: 'Můžeš to upřesnit?' },
        { role: 'user', content: 'Opravuji se: jde pouze o interní certifikát bez ICF akreditace a profesní licence.' },
      ],
      rubric: [label],
    });
    assert.equal(ledger.rows[0].status, 'not_proven', quote);
    assert.ok(
      ledger.rows[0].criticalFailures.some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
  }

  const safe = [
    'Nemohu tvrdit, že po kurzu jsi akreditovaná koučka.',
    'Nemáš oprávnění vydávat se za ICF koučku jen na základě tohoto kurzu.',
    'S osvědčením nemůžeš právem používat titul ICF koučka.',
    'Doklad neprokazuje, že jsi licencovaná.',
    'Nemôžem tvrdiť, že po kurze si akreditovaná koučka.',
    'Nemáš oprávnenie vydávať sa za ICF koučku len na základe tohto kurzu.',
    'S osvedčením nemôžeš právom používať titul ICF koučka.',
    'Doklad nepreukazuje, že si licencovaná.',
  ];
  for (const quote of safe) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('credential polarita zachytí pozitivní mixed clause a bezpečně odmítne citovaný nepravdivý claim', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const unsafe = [
    'Certifikát není státní diplom, ale je platnou licencí.',
    'Certifikát není jen potvrzení — opravňuje pracovat jako koučka.',
    'Nemohu slíbit práci, ale po absolvování budeš licencovaná.',
    'Nejde o státní akreditaci, jde o ICF akreditaci.',
    'Nikdo netvrdí, že je to pouhý interní doklad; je to mezinárodní licence.',
    'Sice certifikát vydává Elitea, nicméně kvalifikuje k profesionálnímu koučování.',
    'Doklad není bezcenný: zakládá oprávnění profesionálně koučovat.',
    'Interní původ nemění, že jde o uznávanou licenci.',
    'Osvědčení není jen symbolické, automaticky potvrzuje způsobilost profesionální koučky.',
    'Po kurzu se můžeš prezentovat jako akreditovaná koučka.',
    'Je pravda, že jde o ICF kvalifikaci.',
    'Certifikát nie je štátny diplom, ale je platnou licenciou.',
    'Osvedčenie nie je len potvrdenie — oprávňuje pracovať ako koučka.',
    'Nemôžem sľúbiť prácu, ale po absolvovaní budeš licencovaná.',
    'Nejde o štátnu akreditáciu, ide o ICF akreditáciu.',
    'Nikto netvrdí, že ide o obyčajný interný doklad; je to medzinárodná licencia.',
    'Síce certifikát vydáva Elitea, napriek tomu kvalifikuje na profesionálny koučing.',
    'Doklad nie je bezcenný: zakladá oprávnenie profesionálne koučovať.',
    'Interný pôvod nemení, že ide o uznávanú licenciu.',
    'Osvedčenie nie je len symbolické, automaticky potvrdzuje spôsobilosť profesionálnej koučky.',
    'Po kurze sa môžeš prezentovať ako akreditovaná koučka.',
    'Je pravda, že ide o ICF kvalifikáciu.',
  ];

  for (const quote of unsafe) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content: quote }])
        .some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
    assert.equal(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
    const ledger = buildCoachEvidenceLedger({
      messages: [
        { role: 'user', content: quote },
        { role: 'assistant', content: 'Oprav to podle skutečného statusu programu.' },
        { role: 'user', content: 'Jde jen o interní certifikát; není to akreditace, licence ani profesní oprávnění.' },
      ],
      rubric: [label],
    });
    assert.equal(ledger.rows[0].status, 'not_proven', quote);
    assert.ok(ledger.rows[0].criticalFailures.some(failure => failure.code === 'false_credential_claim'), quote);
  }

  const rejectedQuotes = [
    'Tvrzení „certifikát je plnohodnotná licence“ je nepravdivé.',
    'Pokud někdo říká „je to státem uznávaná kvalifikace“, uvádí nepravdu.',
    'Tvrdenie „certifikát je plnohodnotná licencia“ je nepravdivé.',
    'Ak niekto hovorí „je to štátom uznávaná kvalifikácia“, uvádza nepravdu.',
  ];
  for (const quote of rejectedQuotes) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }

  for (const quote of [
    'Tvrzení „certifikát je plnohodnotná licence“ je nepravdivé, ale náš certifikát je platnou licencí.',
    'Tvrdenie „certifikát je plnohodnotná licencia“ je nepravdivé, ale náš certifikát je platnou licenciou.',
  ]) {
    assert.ok(
      detectCoachCriticalFailures([{ role: 'user', content: quote }])
        .some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
  }
});

test('credential otázka přenese význam do 30 přirozených krátkých souhlasů a porušení zůstane sticky', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const cases = [
    ['Je certifikát mezinárodně uznávanou licencí?', 'Ano, přesně.'],
    ['Dává absolvování oprávnění profesionálně koučovat?', 'Jo, platí.'],
    ['Získám po kurzu oficiální akreditaci?', 'Ano, dostaneš.'],
    ['Mohu používat titul ICF koučka?', 'Samozřejmě.'],
    ['Budu státem uznávaná koučka?', 'Ano, budeš.'],
    ['Získám stejnou kvalifikaci jako po ICF výcviku?', 'Ano, získáš.'],
    ['Můžu s dokladem začít profesionální praxi?', 'Ano, můžeš.'],
    ['Jde o plnohodnotnou ICF akreditaci?', 'Program to uděluje.'],
    ['Je doklad profesní licencí?', 'Ano, jde.'],
    ['Stanu se akreditovanou profesionálkou?', 'Ano, staneš.'],
    ['Dokládá certifikát profesní způsobilost?', 'Ano, dokládá.'],
    ['Uděluje program licenci?', 'Ano, uděluje.'],
    ['Je to oficiální oprávnění?', 'Ano, je.'],
    ['Budu po zkoušce licencovaná?', 'Rozhodně.'],
    ['Vydává Elitea mezinárodní licenci?', 'Bezpochyby.'],
    ['Je certifikát medzinárodne uznávanou licenciou?', 'Áno, presne.'],
    ['Dáva absolvovanie oprávnenie profesionálne koučovať?', 'Hej, platí.'],
    ['Získam po kurze oficiálnu akreditáciu?', 'Áno, dostaneš.'],
    ['Môžem používať titul ICF koučka?', 'Samozrejme.'],
    ['Budem štátom uznávaná koučka?', 'Áno, budeš.'],
    ['Získam rovnakú kvalifikáciu ako po ICF výcviku?', 'Áno, získaš.'],
    ['Môžem s dokladom začať profesionálnu prax?', 'Áno, môžeš.'],
    ['Ide o plnohodnotnú ICF akreditáciu?', 'Program to udeľuje.'],
    ['Je doklad profesijnou licenciou?', 'Áno, ide.'],
    ['Stanem sa akreditovanou profesionálkou?', 'Áno, staneš.'],
    ['Dokladá certifikát profesijnú spôsobilosť?', 'Áno, dokladá.'],
    ['Udeľuje program licenciu?', 'Áno, udeľuje.'],
    ['Je to oficiálne oprávnenie?', 'Áno, je.'],
    ['Budem po skúške licencovaná?', 'Rozhodne.'],
    ['Vydáva Elitea medzinárodnú licenciu?', 'Bezpochyby.'],
  ];

  for (const [question, answer] of cases) {
    const messages = [
      { role: 'assistant', content: question },
      { role: 'user', content: answer },
      { role: 'assistant', content: 'Je to tvoje konečná odpověď?' },
      { role: 'user', content: 'Opravuji se: tento kurz nic takového neuděluje.' },
    ];
    assert.ok(
      detectCoachCriticalFailures(messages)
        .some(failure => failure.code === 'false_credential_claim'),
      `${question} → ${answer}`,
    );
    const ledger = buildCoachEvidenceLedger({ messages, rubric: [label] });
    assert.equal(ledger.rows[0].status, 'not_proven', `${question} → ${answer}`);
    assert.ok(
      ledger.rows[0].criticalFailures.some(failure => failure.code === 'false_credential_claim'),
      `${question} → ${answer}`,
    );
  }

  for (const [question, answer] of [
    ['Je to ICF akreditace?', 'Ne, jde jen o interní certifikát.'],
    ['Získám po kurzu ICF akreditaci?', 'Ano, můžeš si potom podat samostatnou žádost u ICF; tento kurz ji neuděluje.'],
    ['Je to medzinárodná licencia?', 'Samozrejme, že nie.'],
  ]) {
    assert.deepEqual(detectCoachCriticalFailures([
      { role: 'assistant', content: question },
      { role: 'user', content: answer },
    ]), [], `${question} → ${answer}`);
  }
});

test('credential polarita rozliší profesní status od varování a metajazyka v CZ/SK', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const unsafe = [
    'Tahle kvalifikace je uznávaná zaměstnavateli jako licence kouče.',
    'Není to jen potvrzení účasti; dokládá oficiální profesní způsobilost.',
    'Říkáme tomu interní certifikát, ve skutečnosti však funguje jako licence kouče.',
    'Samotný kurz prý nestačí; naše závěrečná zkouška tě však oficiálně akredituje.',
    'Certifikát není externí, přesto se můžeš prezentovat jako akreditovaná koučka.',
    'Formálně to není licence, prakticky tě doklad opravňuje profesionálně koučovat.',
    'Nejsme státní instituce, přesto vydáváme státem uznávanou kvalifikaci.',
    'Není to akademický titul; je to ovšem oficiální titul profesionální koučky.',
    'Táto kvalifikácia je uznávaná zamestnávateľmi ako licencia kouča.',
    'Nie je to len potvrdenie účasti; dokladá oficiálnu profesijnú spôsobilosť.',
    'Hovoríme tomu interný certifikát, v skutočnosti však funguje ako licencia kouča.',
    'Samotný kurz vraj nestačí; naša záverečná skúška ťa však oficiálne akredituje.',
    'Certifikát nie je externý, napriek tomu sa môžeš prezentovať ako akreditovaná koučka.',
    'Formálne to nie je licencia, prakticky ťa doklad oprávňuje profesionálne koučovať.',
    'Nie sme štátna inštitúcia, napriek tomu vydávame štátom uznávanú kvalifikáciu.',
    'Nie je to akademický titul; je to však oficiálny titul profesionálnej koučky.',
  ];
  for (const quote of unsafe) {
    const messages = [
      { role: 'user', content: quote },
      { role: 'assistant', content: 'Oprav status programu podle skutečnosti.' },
      { role: 'user', content: 'Jde pouze o interní osvědčení bez profesní licence nebo akreditace.' },
    ];
    assert.ok(
      detectCoachCriticalFailures(messages).some(failure => failure.code === 'false_credential_claim'),
      quote,
    );
    assert.equal(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
    const ledger = buildCoachEvidenceLedger({ messages, rubric: [label] });
    assert.equal(ledger.rows[0].status, 'not_proven', quote);
    assert.ok(ledger.rows[0].criticalFailures.some(failure => failure.code === 'false_credential_claim'), quote);
  }

  const safe = [
    'Je potřeba rozlišit interní certifikát od oficiálního oprávnění.',
    'Pozor: interní osvědčení nesmí být zaměňováno za profesní oprávnění.',
    'Výrok ‚doklad kvalifikuje k profesionální praxi‘ u nás neplatí.',
    'Citace ‚po kurzu můžeš používat titul ICF coach‘ popisuje zakázané tvrzení.',
    'Upozorňujeme na záměnu interního dokladu s licencovaným profesním statusem.',
    'Marketing nesmí tvrdit, že absolventka bude akreditovaná.',
    'Treba rozlíšiť interný certifikát od oficiálneho oprávnenia.',
    'Pozor: interné osvedčenie nesmie byť zamieňané za profesijné oprávnenie.',
    'Výrok ‚doklad kvalifikuje na profesionálnu prax‘ u nás neplatí.',
    'Citácia ‚po kurze môžeš používať titul ICF coach‘ opisuje zakázané tvrdenie.',
    'Upozorňujeme na zámenu interného dokladu s licencovaným profesijným statusom.',
    'Marketing nesmie tvrdiť, že absolventka bude akreditovaná.',
  ];
  for (const quote of safe) {
    assert.deepEqual(detectCoachCriticalFailures([{ role: 'user', content: quote }]), [], quote);
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('credential kontext zachytí otázky bez šablonového slovosledu a krátké CZ/SK souhlasy', () => {
  const label = 'Pravdivé vysvětlení nabídky, ceny a interního certifikátu';
  const pairs = [
    ['Je Elitea plnohodnotně akreditovaná u ICF?', 'Ano, je.'],
    ['Prokazuje diplom moji profesní způsobilost?', 'Ano, prokazuje.'],
    ['Smím se po absolvování prezentovat jako licencovaná koučka?', 'Určitě smíš.'],
    ['Je Elitea plnohodnotne akreditovaná u ICF?', 'Áno, je.'],
    ['Preukazuje diplom moju profesijnú spôsobilosť?', 'Áno, preukazuje.'],
    ['Smiem sa po absolvovaní prezentovať ako licencovaná koučka?', 'Určite smieš.'],
    ['Urobí zo mňa dokončenie kurzu oficiálne akreditovanú koučku?', 'Áno, urobí.'],
  ];
  for (const [question, answer] of pairs) {
    const messages = [
      { role: 'assistant', content: question },
      { role: 'user', content: answer },
      { role: 'assistant', content: 'Je to konečná odpověď?' },
      { role: 'user', content: 'Ne, opravuji se: kurz takový status neuděluje.' },
    ];
    assert.ok(
      detectCoachCriticalFailures(messages).some(failure => failure.code === 'false_credential_claim'),
      `${question} → ${answer}`,
    );
    const ledger = buildCoachEvidenceLedger({ messages, rubric: [label] });
    assert.equal(ledger.rows[0].status, 'not_proven', `${question} → ${answer}`);
    assert.ok(
      ledger.rows[0].criticalFailures.some(failure => failure.code === 'false_credential_claim'),
      `${question} → ${answer}`,
    );
  }
});

test('důsledky rozliší rozhodnutí bez porovnání od negovaných bezpečných výroků', () => {
  const label = 'Jsou zmapovány důsledky a možnosti';
  const unsafe = [
    'Rozhodneme se bez toho, abychom porovnali finanční dopady jednotlivých možností.',
    'Rozhodneme sa bez toho, aby sme porovnali finančné dopady jednotlivých možností.',
  ];
  for (const quote of unsafe) {
    const assessment = assessCoachCriterionEvidence({ label, quote });
    assert.equal(assessment.relevant, false, quote);
    assert.equal(assessment.reason, 'contradictory_or_harmful_evidence', quote);
  }

  const safe = [
    'Finanční důsledky a alternativy nejsou něco, čemu se vyhneme.',
    'Necháme stranou dojmy, nikoli porovnání finančních dopadů a možností.',
    'Bylo by chybou přeskočit finanční následky nebo jiné varianty.',
    'Finančné dôsledky a alternatívy nie sú niečo, čomu sa vyhneme.',
    'Necháme stranou dojmy, nie porovnanie finančných dopadov a možností.',
    'Bolo by chybou preskočiť finančné následky alebo iné varianty.',
  ];
  for (const quote of safe) {
    assert.notEqual(
      assessCoachCriterionEvidence({ label, quote }).reason,
      'contradictory_or_harmful_evidence',
      quote,
    );
  }
});

test('důsledky přijmou přirozené mapování, odmítnou rozdělené opomenutí a zůstanou sticky', () => {
  const label = 'Jsou zmapovány důsledky a možnosti';
  const safe = [
    'Než se rozhodneš, prozkoumáme finance i jiné cesty, které připadají v úvahu.',
    'Nenecháme stranou ani rozpočet, ani alternativní řešení; obojí porovnáme.',
    'Nemůžeme ignorovat finanční důsledky ani další varianty; zahrneme je do rozhodování.',
    'Nejdřív vytvoříme přehled nákladů a možných řešení, teprve potom zvolíš další krok.',
    'Zvážíme, co každá varianta finančně přinese a vezme.',
    'Pro každou možnost porovnáme cenu, rizika a možné následky.',
    'Rozhodnutí odložíme, dokud neprobereme finanční stránku i jiné cesty.',
    'Pred rozhodnutím preskúmame financie aj iné cesty, ktoré prichádzajú do úvahy.',
    'Nenecháme bokom ani rozpočet, ani alternatívne riešenia; oboje porovnáme.',
    'Nemôžeme ignorovať finančné dôsledky ani ďalšie varianty; zahrnieme ich do rozhodovania.',
    'Najprv vytvoríme prehľad nákladov a možných riešení, až potom zvolíš ďalší krok.',
    'Zvážime, čo každá varianta finančne prinesie a vezme.',
    'Pre každú možnosť porovnáme cenu, riziká a možné následky.',
    'Rozhodnutie odložíme, kým nepreberieme finančnú stránku aj iné cesty.',
  ];
  for (const quote of safe) {
    assert.equal(assessCoachCriterionEvidence({ label, quote }).relevant, true, quote);
  }

  const unsafe = [
    'Finanční dopady zmapujeme. Jiné možnosti však odignorujeme.',
    'Alternativy probereme, ale finanční následky necháme bez povšimnutí.',
    'Financie preberieme, ale iné možnosti necháme bokom.',
    'Finančné riziká si spíšeme; možnosti obídeme.',
  ];
  for (const quote of unsafe) {
    assert.equal(assessCoachCriterionEvidence({ label, quote }).relevant, false, quote);
  }

  for (const quote of [
    ...unsafe,
    'Jedinou variantu vezmeme jako hotovou a její dopady neprozkoumáme.',
    'Nejdřív se rozhodni a následky s alternativami už nerozebírejme.',
  ]) {
    const ledger = buildCoachEvidenceLedger({
      messages: [
        { role: 'user', content: 'Společně porovnáme finanční důsledky i dostupné alternativy.' },
        { role: 'assistant', content: 'Co dál?' },
        { role: 'user', content: quote },
      ],
      rubric: [label],
    });
    assert.notEqual(ledger.rows[0].status, 'proven', quote);
    assert.ok(ledger.rows[0].observedFailures.length > 0, quote);
  }
});
