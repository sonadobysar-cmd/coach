const CASES = Object.freeze([
  ['Klientka chce „být sebevědomá všude“, ale popisuje odlišné reakce při poradě, doma a při cenotvorbě.','konkrétní sebeúčinnost, tři vrstvy kontextu a pozorovatelné měření'],
  ['Po chybě v termínu se neomluví, protože nechce působit slabě; jindy se omluví za otázku.','odpovědnost, empatii, zdvořilost a smysluplnou nápravu'],
  ['Před autoritou říká promiň v každé větě, s blízkými nikoli; v minulém zaměstnání byl nesouhlas trestán.','funkci návyku, moc, bezpečný experiment a mikro-pauzu'],
  ['Při zpoždění, vstupu do hovoru a chybné příloze potřebuje tři rozdílné reakce.','orientaci, informaci, poděkování a skutečnou omluvu'],
  ['E-mail je plný slov „jen“, „možná“ a „asi“, ale část nejistoty je odborně oprávněná.','minimalizaci, přesnou míru jistoty a redakční rozhodnutí'],
  ['Na poradě má důležitý nesouhlas, dvakrát je přerušena a bojí se odvety vedoucího.','otázku, vstup, nesouhlas, mocenské riziko a bezpečnější kanál'],
  ['Konkrétní pochvalu okamžitě shodí; přehnanou lichotku naopak přijme jako fakt.','přijetí zpětné vazby, vlastní podíl, tým a manipulativní lichotku'],
  ['Má doložit přínos při povýšení, ale prostředí používá pro stejné chování rozdílný metr.','zdravou hrdost, data, spojence a procesní spravedlnost'],
  ['Automaticky zachraňuje kolegyně, krátce cítí úlevu a později je vyčerpaná a naštvaná.','people-pleasing smyčku, svobodnou laskavost a cenu závazku'],
  ['Po žádosti ihned řekne ano; když se pokusí odmítnout, druhý třikrát zatlačí.','pauzu, filtr kapacity, podmíněné ano a klidné opakování'],
  ['Vysloví hranici jako příkaz druhému a následek, který sama nedokáže dodržet.','požadavek, vlastní hranici, proveditelný následek a vinu po změně'],
  ['Rodina žádá pomoc ve stejný čas jako její zvolený projekt; žádná volba není bez ceny.','alternativní náklad, hodnoty, kalendář a vlastnictví rozhodnutí'],
  ['Tvrdí, že nic nedokázala, přesto existují artefakty, zpětná vazba i návraty po chybách.','interní a externí důkaz, přínos a konkrétní mezeru v dovednosti'],
  ['Po povýšení čeká odhalení, úspěch připisuje náhodě a každou chybu považuje za důkaz podvodu.','imposter fenomén bez diagnózy, ochranu, cenu a realistický experiment'],
  ['Je jedinou ženou v týmu, kritéria se mění a její pochybnost se automaticky označí za nízké sebevědomí.','novou roli, organizační podmínky, stereotypní hrozbu a příslušnost'],
  ['Odkládá prezentaci a pak se připravuje do noci, protože chce pokrýt každou možnou otázku.','funkční analýzu, kritérium hotovo, časový strop a odstupňovaný pokus'],
  ['Po jedné nepřesnosti řekne „vždy všechno zkazím“ a ignoruje devadesát procent dobrého výkonu.','automatickou myšlenku, mentální filtr, důkazy a věrohodnou alternativu'],
  ['Opakuje stejnou strategii a slyší jen „snaž se víc“, přesto nemá zdroje ani kvalitní zpětnou vazbu.','růstové nastavení, limity evidence, změnu strategie a podmínky prostředí'],
  ['Vděčnost i afirmace zvyšují stud; neutrální smyslové všímání je snesitelné.','sebesoucit, savoring, pravdivé ocenění a rovnocennou alternativu'],
  ['V závěrečné simulaci se prolíná omlouvání, hranice, pochybnost, diskriminace a požadavek na diagnózu.','kontrakt, výběr metody, bezpečnou hranici role, portfolio a následný plán'],
]);

const MOVES = Object.freeze([
  'Odděl fakta, interpretaci, osobní dovednost, vztahový vliv a systémovou podmínku. Napiš jednu větu, která problém nezmenšuje ani nezveličuje.',
  'Vytvoř doslovnou formulaci pro nízký, střední a vyšší tlak. U každé uveď, co uděláš, když se situace zhorší.',
  'Stanov měřitelný důkaz, stop pravidlo, způsob zpětné vazby a jednu opravu, kterou provedeš po prvním pokusu.',
]);

export function enrichSelfTrustStudy(items, moduleIndex) {
  const guide = CASES[moduleIndex];
  if (!guide) return items;
  let lessonIndex = 0;
  return items.map(item => {
    if (item.kind !== 'lesson') return item;
    const move = MOVES[lessonIndex++] || MOVES.at(-1);
    const protocol = `### Aktivní studium lekce — 15 až 17 minut

**Vybavení bez nápovědy (3 min).** Zavři text a vlastními slovy napiš hlavní pravidlo lekce „${item.title}“, jeden příklad správného použití a jednu situaci, ve které by zjednodušené použití mohlo uškodit. Text znovu otevři a nepřesnost oprav jinou barvou.

**Rozhodovací případ (5 min).** ${guide[0]} Rozpracuj případ pouze optikou této lekce. ${move}

**Přenos do praxe (5 min).** Pro téma ${guide[1]} napiš konkrétní osobní krok a samostatně postup studijní trenérky Elitea. Zahrň přesnou větu, předvídatelnou reakci druhé strany, variantu při zvýšeném tlaku a způsob kontroly skutečného dopadu.

**Kontrola kvality (2–4 min).** Ověř věrohodnost, kontext moci, odpovědnost, vlastnictví rozhodnutí, neklinickou hranici a rozdíl mezi pocitem a pozorovatelným chováním. Pokud závěr stojí jen na obecném „věř si“, lekci ještě neuzavírej.

**Výstup do portfolia:** rozbor případu, dvě doslovné formulace, důkaz nebo kritérium, stop pravidlo a opravená verze po sebekontrole.`;
    return { ...item, markdown: `${item.markdown}\n\n${protocol}` };
  });
}
