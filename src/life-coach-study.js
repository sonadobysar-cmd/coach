const MODULE_CASES = Object.freeze([
  {
    case: 'Zájemkyně žádá jistotu, že jí koučink odstraní panické stavy a do tří měsíců změní život.',
    transfer: 'Vytvoř jednu pravdivou větu o přínosu služby, jednu hranici kompetence a jednu větu pro citlivé předání.',
    proof: 'Je zřejmé, kdo rozhoduje, co lze skutečně ověřit a kdy koučování končí.',
  },
  {
    case: 'Koučka věnuje oblíbené klientce více času, radí jí častěji a její mlčení automaticky vykládá jako odpor.',
    transfer: 'Odděl pozorování, vlastní interpretaci a obchodní či emoční zájem koučky; doplň protidůkaz a supervizní otázku.',
    proof: 'Závěr zůstává hypotézou a oprava vrací klientce autonomii místo sebeobviňování koučky.',
  },
  {
    case: 'Klientka v polovině kariérního sezení otevře zdravotní potíže a chce, aby byly její informace použity také v anonymní případové studii.',
    transfer: 'Napiš přesná slova pro zastavení, nové vyjednání cíle, samostatný souhlas a bezpečné uzavření.',
    proof: 'Každý údaj má účel, každá změna zakázky souhlas a důvěrnost má srozumitelně popsané výjimky.',
  },
  {
    case: 'Klientka řekne, že nechce znovu obětovat zdraví; koučka ji přeruší vlastním příběhem a označí ji za vystrašenou.',
    transfer: 'Napiš kratší parafrázi, ověřitelný odraz emoce a opravu po přerušení. Nepřidávej význam, který nezazněl.',
    proof: 'Klientka může každou formulaci snadno potvrdit, zpřesnit nebo odmítnout.',
  },
  {
    case: 'Koučka během jedné minuty položí tři otázky a do čtvrté ukryje doporučení, které sama považuje za nejlepší.',
    transfer: 'Rozděl otázky na jedno jádro, urči účel každé z nich a přepiš skrytou radu do neutrálního zkoumání.',
    proof: 'Otázka navazuje na poslední význam klientky, není sugestivní a její hloubka odpovídá souhlasu.',
  },
  {
    case: 'Klientka chce „být úspěšnější“, ale plán obsahuje pouze počet příspěvků a výsledek závisí převážně na trhu.',
    transfer: 'Odděl výsledek, chování a systém; doplň COACH kontrolu, výchozí hodnotu a první důkaz rozvoje kompetence.',
    proof: 'Cíl je srozumitelný, převážně ovlivnitelný klientkou a měření neodměňuje pouhou aktivitu.',
  },
  {
    case: 'Akční plán stojí na motivaci, nemá spouštěč ani minimální verzi a při nesplnění má koučka klientku „přitlačit“.',
    transfer: 'Navrhni konkrétní spouštěč, minimální krok, podporu prostředí, férovou kontrolu a způsob učení z nesplnění.',
    proof: 'Odpovědnost není kontrola ani stud; systém funguje i v horším dni a oslava nepodmiňuje vlastní hodnotu.',
  },
  {
    case: 'Kolo života ukáže nízké zdraví, GROW nabídne deset možností a koučka chce klientce rovnou přidělit svůj HEART plán.',
    transfer: 'Vyber vhodný nástroj pro konkrétní fázi, vysvětli jeho omezení a převeď výstup do jediného vlastněného kroku.',
    proof: 'Nástroj slouží zakázce, není diagnózou ani efektní náhradou za naslouchání a končí rozhodnutím klientky.',
  },
  {
    case: 'Koučka má šest formulářů, dlouhé poznámky a dashboard, ale nedokáže vysvětlit, proč jednotlivé údaje ukládá.',
    transfer: 'Zachovej jen nezbytná pole, přiřaď jim účel a dobu uchování a zvol jednu metriku procesu i výsledku.',
    proof: 'Dokumentace pomáhá kontinuitě a učení, neprofiluje klientku a neobsahuje citlivá data bez právního důvodu.',
  },
  {
    case: 'Klientka chce pomocí kotvy vymazat trauma a koučka po zlepšení připíše celý účinek NLP bez alternativního vysvětlení.',
    transfer: 'Přepiš postup jako dobrovolný předregistrovaný experiment s měřením, stop pravidlem a možností nulového účinku.',
    proof: 'Jazyk neobsahuje léčebný slib, mechanismus není vydáván za fakt a klinické téma vede k odbornému předání.',
  },
  {
    case: 'Klientka se usměje, ale mluví tiše; koučka z řeči těla usoudí, že lže, a začne uměle kopírovat její gesta.',
    transfer: 'Odděl signál od výkladu, navrhni ověřovací otázku a ukaž rapport pomocí tempa, přesnosti a respektu.',
    proof: 'Neverbální informace zůstává kontextem, nikoli detektorem pravdy, a sladění nepůsobí manipulativně.',
  },
  {
    case: 'Koučka klientce říká, že stačí růstový mindset a neuroplasticita, přestože chybí zdroje, dovednost i realistický plán.',
    transfer: 'Urči, co je naučitelné, co vyžaduje prostředí a co není pod přímou kontrolou; navrhni malý test dovednosti.',
    proof: 'Naděje je spojena s tréninkem a zpětnou vazbou, ne s obviňováním klientky za každou překážku.',
  },
  {
    case: 'Při mindfulness klientka hlásí neklid a odpojení; koučka trvá na zavřených očích a delším soustředění na dech.',
    transfer: 'Nabídni informovanou volbu, vnější orientaci, krátkou alternativu a jasnou možnost praxi okamžitě ukončit.',
    proof: 'Cvičení není povinné ani léčebné, průběžně se sleduje účinek a zhoršení vede ke změně nebo zastavení.',
  },
  {
    case: 'Klientka říká „všechno pokazím“ a koučka jí bez zkoumání nařídí pozitivní afirmaci, které klientka nevěří.',
    transfer: 'Odděl situaci, přesnou myšlenku, důkaz, kognitivní zkratku a užitečnější větu, která zůstává uvěřitelná.',
    proof: 'Reframe nepopírá fakta ani emoci, není vynuceně pozitivní a vede k ověřitelnému jednání.',
  },
  {
    case: 'Koučka tvrdí, že myšlenky vždy vytvářejí emoce, chce odstranit strach a přidává tlak na rychlou změnu stavu.',
    transfer: 'Zmapuj situaci, tělesný vjem, myšlenku, impulz a chování; navrhni přijetí emoce i bezpečný další krok.',
    proof: 'Emoce není morální chyba, situační nebezpečí se nepřerámovává a regulace není slibem trvalé úlevy.',
  },
  {
    case: 'Z jednoho neúspěchu klientka odvodí „nejsem podnikatelka“ a koučka hledá skryté přesvědčení, dokud nějaké nenajde.',
    transfer: 'Rozliš událost, pravidlo, schéma a alternativní vysvětlení; použij table-leg mapu bez vkládání cizího významu.',
    proof: 'Přesvědčení je pracovní formulace, důkazy zahrnují výjimky a změna se ověřuje chováním místo autosugesce.',
  },
  {
    case: 'Klientka odkládá vratné rozhodnutí, bojí se selhání a koučka ji motivuje, aby bez přípravy podstoupila velké riziko.',
    transfer: 'Urči vratnost, cenu nečinnosti, nejmenší expozici, preventivní kroky, plán opravy a stop podmínku.',
    proof: 'Odvaha není hazard, fear setting zahrnuje prevenci i obnovu a konečnou volbu provádí klientka.',
  },
  {
    case: 'Začínající koučka slibuje „najdi poslání“, volí příliš širokou cílovku a cenu určuje pouze podle vysněného příjmu.',
    transfer: 'Spoj účel, testovaný problém, scope, magnet message, balíček, kapacitu, ekonomiku a důkaz z pilotu.',
    proof: 'Příběh není přepsaná realita, nabídka nepředbíhá důkazy a certifikační portfolio dokládá celé řemeslo.',
  },
]);

const LESSON_MOVES = Object.freeze([
  'Nejprve napiš dva příklady, které se snadno zamění, a u každého vysvětli rozhodující rozdíl.',
  'Potom vytvoř dvě přesné věty, které bys v dané situaci skutečně řekla, a jednu nevhodnou formulaci oprav.',
  'Nakonec stanov rozhodovací hranici: kdy pokračovat, kdy změnit postup a podle čeho poznat, že je třeba zastavit.',
]);

export function enrichLifeCoachStudy(items, moduleIndex) {
  const guide = MODULE_CASES[moduleIndex];
  if (!guide) return items;
  let lessonIndex = 0;
  return items.map(item => {
    if (item.kind !== 'lesson') return item;
    const move = LESSON_MOVES[lessonIndex] || LESSON_MOVES.at(-1);
    lessonIndex += 1;
    const protocol = `### Aktivní část lekce — 15 až 17 minut

**1. Vybavení bez nápovědy (3 min).** Zavři text a vlastními slovy napiš hlavní princip lekce „${item.title}“. Přidej jednu věc, kterou tento princip neznamená. Teprve potom se vrať a oprav nepřesnost jinou barvou.

**2. Rozhodovací případ (5 min).** ${guide.case} Posuď případ pouze optikou této lekce. Odděl fakta, domněnky, riziko, vlastnictví rozhodnutí a nejbližší profesní tah. ${move}

**3. Přenos do vlastní praxe (5 min).** ${guide.transfer} Formulace napiš doslova, ne pouze jako hesla. U každé uveď, jakou reakci klientky bys potřebovala ověřit.

**4. Kontrola kvality (2–4 min).** ${guide.proof} Pokud některý bod nedokážeš doložit konkrétní větou nebo výstupem, lekci ještě neoznačuj za dokončenou.

**Výstup do portfolia:** krátký rozbor případu, dvě použitelné formulace, rozhodovací hranice a jedna oprava po vlastní kontrole.`;
    return { ...item, markdown: `${item.markdown}\n\n${protocol}` };
  });
}
