const CASES = Object.freeze([
  ['Pozvánka slibuje uzdravení traumatu a facilitátorka chce během kruhu přecházet mezi rituálem, koučinkem a radou bez oznámení.','scope, pravdivý slib a okamžik odborného předání'],
  ['Scénář tvrdí, že všechny ženy od pradávna slavily stejný rituál a přebírá symbol konkrétní kultury bez uvedení původu.','historický fakt, moderní interpretaci, osobní víru a kulturní odpovědnost'],
  ['Kruh používá mateřství, menstruaci a božské ženství jako povinné znaky ženské zkušenosti.','vymezení cílové skupiny, bariéru a rovnocennou cestu účasti'],
  ['Dvouhodinový program má dvanáct aktivit, žádnou rezervu a hluboké sdílení začíná deset minut před koncem.','účel bloků, časovou rezervu, položku k vypuštění a bezpečné uzavření'],
  ['Účastnice očekávají absolutní mlčenlivost, fotografie se pořizují automaticky a nikdo nezná postup při akutním ohrožení.','informovaný souhlas, reálnou hranici důvěrnosti a incidentní postup'],
  ['Facilitátorka prodává vlastní služby po zranitelném sdílení a oblíbené člence poskytuje soukromou podporu bez hranic.','moc, konflikt zájmů, dvojí vztah a transparentní alternativu'],
  ['Jedna žena mluví patnáct minut, druhá radí a třetí nechce převzít mluvící předmět.','spravedlivý čas, naslouchání, dobrovolnost a opravný zásah'],
  ['Místo je v patře bez výtahu, hoří v něm svíčky, používá se silná vůně a online účastnice nemá soukromí.','fyzickou, smyslovou, informační a digitální bezpečnost'],
  ['Otevření vyžaduje zavřené oči, modlitbu a držení rukou; karta je poté vykládána jako předpověď.','orientaci, spirituální volbu, sekulární alternativu a hranici symbolu'],
  ['Skupina přesvědčuje ženu k objetí a delšímu očnímu kontaktu, protože odmítnutí údajně znamená blok.','opt-in souhlas, rovnocennou alternativu a stop signál'],
  ['Při poměru dechu 4:8 má členka závrať a facilitátorka ji vybízí, aby nepříjemný pocit prodechla.','běžný dech, kontraindikace, ukončení a následnou kontrolu'],
  ['Efektní aktivita nemá jasný výsledek, instrukce jsou nejasné a facilitátorka ji nechce zkrátit navzdory reakci skupiny.','účel, instrukci, integraci, plán B a měřitelnou opravu'],
  ['Afirmace „miluji se“ zvyšuje stud a pracovní list žádá veřejně popsat rodinné zranění.','uvěřitelnou větu, soukromí, volbu a neklinickou hranici'],
  ['Spojení se měří množstvím odhalené bolesti a zraňující komentář je omluven dobrým úmyslem.','stupňovanou zranitelnost, dopad, odpovědnost a obnovu dohody'],
  ['Vůně je označena za nízkovibrační a karta má rozhodnout, zda účastnice opustí práci.','smyslový vjem, osobní význam, zkreslení a kontrolu reality'],
  ['Žena v krizi nic vděčného nenachází a skupina jí vysvětluje, že se soustředí na negativní věci.','validaci, selektivní pozornost, neutralitu a možnost nepokračovat'],
  ['Nesplněný cíl je připsán nízké vibraci a při rituálu se mají pálit citlivé zápisy v uzavřené místnosti.','symbol, fakt, požární riziko, ovlivnitelný krok a ochranu zápisu'],
  ['Během meditace se účastnice odpojí, ale scénář přikazuje zůstat se zavřenýma očima do konce.','sledování účinku, vnější orientaci, stop postup a odbornou návaznost'],
  ['Vizualizace pláže nefunguje, body scan zvyšuje bolest a fráze laskavosti působí nepravdivě.','adaptaci bez hodnocení, vnější kotvu a platnost nulového účinku'],
  ['Pilot má hezké fotografie, ale chybí kalkulace, souhlasy, evaluační data, incidentní plán a důkaz facilitátorského výkonu.','ekonomiku, etický marketing, dokumentaci a certifikační kritéria'],
]);

const MOVES = Object.freeze([
  'Odděl fakta od interpretací a napiš dvě možné chyby, kterých by se začátečnice mohla dopustit.',
  'Napiš doslova jednu bezpečnou větu facilitátorky, jednu otázku na souhlas a jednu rovnocennou alternativu.',
  'Stanov rozhodovací hranici: kdy pokračovat, kdy postup změnit, kdy zastavit a jaký důkaz uložit do portfolia.',
]);

export function enrichWomensCircleStudy(items, moduleIndex) {
  const guide = CASES[moduleIndex];
  if (!guide) return items;
  let lessonIndex = 0;
  return items.map(item => {
    if (item.kind !== 'lesson') return item;
    const move = MOVES[lessonIndex++] || MOVES.at(-1);
    const protocol = `### Aktivní studium lekce — 15 až 17 minut

**Vybavení bez nápovědy (3 min).** Zavři text a napiš hlavní pravidlo lekce „${item.title}“, jeho účel a jednu věc, kterou toto pravidlo neznamená. Potom text znovu otevři a oprav nepřesnost jinou barvou.

**Rozhodovací případ (5 min).** ${guide[0]} Rozpracuj případ pouze optikou této lekce. ${move}

**Přenos do praxe (5 min).** U tématu ${guide[1]} vytvoř konkrétní postup použitelný v živé skupině. Zahrň slova facilitátorky, předvídatelnou reakci účastnice, volbu bez vysvětlování a způsob kontroly dopadu.

**Kontrola kvality (2–4 min).** Ověř fyzické a psychologické bezpečí, důvěrnost, přístupnost, kulturní pokoru, vlastnictví rozhodnutí a hranici role. Pokud bod neumíš doložit konkrétní větou nebo dokumentem, lekci ještě neuzavírej.

**Výstup do portfolia:** rozbor případu, dvě doslovné formulace, rovnocenná alternativa, stop pravidlo a jedna opravená verze po sebekontrole.`;
    return { ...item, markdown: `${item.markdown}\n\n${protocol}` };
  });
}
