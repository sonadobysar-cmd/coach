const DEFINITIONS = [
  {
    failureCode: 'clinical_scope_breach',
    competencyId: 'ethical_boundaries',
    scenarioFamilyId: 'clinical-scope-remediation',
    moduleIndex: 0,
    challenges: [
      {
        challengeId: 'panic-diagnosis-a',
        title: 'Panické stavy nejsou koučovací diagnóza',
        role: 'Marta, 37 let, majitelka e-shopu',
        context: 'hranice koučinku při žádosti o diagnózu',
        openingLine: 'Poslední týdny mívám náhlé bušení srdce, nemůžu popadnout dech a bojím se, že mám panickou poruchu. Urči mi prosím, co mi je, a proveď mě léčbou tady v koučinku.',
        assignment: 'Reaguj bez diagnostiky a léčby: vymez roli, ověř bezprostřední bezpečí, nabídni konkrétní odbornou návaznost a odděl případný bezpečný neklinický cíl.',
        evidenceTarget: 'jasná hranice role, bezpečnostní orientace a konkrétní předání bez opuštění klientky',
        rubric: ['Žádná diagnóza ani předstírání léčby', 'Přímé ověření aktuálního bezpečí', 'Srozumitelné vymezení koučovací role', 'Konkrétní doporučení zdravotní nebo terapeutické pomoci', 'Neklinický cíl oddělený od symptomů', 'Lidský tón bez odmítnutí klientky'],
        facts: 'Marta nemá stanovenou diagnózu. Aktuálně je orientovaná a bez bezprostředního ohrožení, symptomy jsou ale opakované a mají být posouzené zdravotníkem. Samostatně chce později připravit předání provozu kolegyni.',
        hiddenNeed: 'Zažít, že profesionální koučka neskrývá hranici své role, ale ani klientku neodmítne nebo nenechá bez dalšího kroku.',
        behavior: 'Při diagnóze nebo léčebném postupu žádej větší jistotu a ptej se, zda je koučka zdravotnice. Při jasné hranici potvrď, že můžeš kontaktovat praktickou lékařku; neklinický pracovní cíl otevři až potom.',
      },
      {
        challengeId: 'trauma-treatment-b',
        title: 'Traumatickou vzpomínku nelze léčit pod názvem koučink',
        role: 'Karolína, 34 let, obchodní ředitelka',
        context: 'žádost o zpracování traumatu koučovací technikou',
        openingLine: 'Po jedné staré události se mi vracejí obrazy a v noci skoro nespím. Terapii nechci. Udělej se mnou expozici nebo NLP a tu vzpomínku přepiš, ať je to rychle pryč.',
        assignment: 'Udrž hranici koučinku i pod tlakem na rychlou techniku. Nezpracovávej trauma, neslibuj léčbu a vytvoř bezpečný most k odpovídající odborné pomoci.',
        evidenceTarget: 'odmítnutí klinické intervence, přiměřené předání a zachování vztahu',
        rubric: ['Žádná expozice ani přepis traumatické vzpomínky', 'Žádný léčebný slib', 'Pojmenování hranice bez diagnostiky', 'Ověření bezpečí a fungování', 'Konkrétní odborná návaznost', 'Volitelný neklinický cíl až po oddělení témat'],
        facts: 'Karolína popisuje opakované vtíravé vzpomínky a významné potíže se spánkem. Není v bezprostředním ohrožení. Má kontakt na psychoterapeutku doporučenou lékařkou a zároveň chce jednou pracovat na přípravě obchodní prezentace.',
        hiddenNeed: 'Dostat pravdivou hranici a konkrétní návaznost, aniž by koučka využila touhu po rychlé úlevě k nekompetentní práci.',
        behavior: 'Při nabídce trauma techniky chtěj potvrzení, že vzpomínka zmizí. Při bezpečném odmítnutí se nejprve obávej, že tě koučka opouští; spolupracuj, když jasně nabídne lidské předání a oddělí prezentační cíl.',
      },
    ],
  },
  {
    failureCode: 'confidentiality_breach',
    competencyId: 'ethical_boundaries',
    scenarioFamilyId: 'confidentiality-remediation',
    moduleIndex: 8,
    challenges: [
      {
        challengeId: 'sponsor-report-a',
        title: 'Sponzor žádá obsah firemního koučinku',
        role: 'Eva, 46 let, HR ředitelka',
        context: 'důvěrnost a reporting sponzorovi',
        openingLine: 'Firma koučink platí, takže mi pošli, co zaměstnankyně na sezení říkala, tvoje poznámky a seznam úkolů. Potřebuji zkontrolovat návratnost investice.',
        assignment: 'Chraň obsah sezení podle původního souhlasu, rozliš legitimní reporting od citlivých dat a navrhni transparentní třístrannou dohodu do budoucna.',
        evidenceTarget: 'výslovné odmítnutí neoprávněného sdílení a datově úsporná alternativa',
        rubric: ['Důvěrnost je zachována: obsah ani poznámky nejsou vydány', 'Původní souhlas není zpětně rozšířen', 'Rozlišení účasti, cíle a obsahu sezení', 'Minimalizace sdílených dat', 'Nová třístranná dohoda pouze do budoucna', 'Transparentní komunikace ke klientce i sponzorovi'],
        facts: 'Klientka souhlasila pouze s potvrzením účasti a společně formulovaným obecným cílem. Nesouhlasila se sdílením výroků, poznámek ani úkolů. Firma může dostat agregovaný procesní údaj a navrhnout novou dohodu pro další období.',
        hiddenNeed: 'Získat použitelný rámec reportingu bez porušení již dohodnuté důvěrnosti.',
        behavior: 'Při jakémkoli sdílení obsahu požaduj ještě přesnější citace a zápis. Při pevné hranici se ptej, jaké necitlivé údaje může firma legitimně získat a jak dohodu nastavit příště.',
      },
      {
        challengeId: 'manager-notes-b',
        title: 'Nadřízený chce zápis bez souhlasu klientky',
        role: 'Roman, 43 let, přímý nadřízený klientky',
        context: 'tlak na předání poznámek třetí osobě',
        openingLine: 'Jsem její nadřízený a potřebuji vědět, jestli na koučinku přiznala problém s výkonem. Pošli mi zápis dnes; nemusíme ji tím zbytečně zatěžovat.',
        assignment: 'Neprozraď ani nepotvrď obsah sezení. Vysvětli hranici, minimalizuj data a nabídni proces, ve kterém klientka předem ví, co se případně sdílí.',
        evidenceTarget: 'ochrana důvěrnosti pod mocenským a časovým tlakem',
        rubric: ['Žádné potvrzení konkrétního výroku nebo tématu', 'Žádné předání zápisu', 'Jasné vysvětlení předchozí dohody', 'Klientka má kontrolu nad novým souhlasem', 'Nabídka společně schváleného výsledkového reportu', 'Ochrana dat bez útočného tónu'],
        facts: 'Roman nemá souhlas k obsahu ani potvrzení jednotlivých témat. Existuje pouze dohoda o docházce. Klientka může sama formulovat, jaký pracovní pokrok chce sdílet v budoucím třístranném setkání.',
        hiddenNeed: 'Ověřit, zda koučka udrží důvěrnost i proti autoritě, která službu ovlivňuje.',
        behavior: 'Při ústupku zdůrazni svou manažerskou odpovědnost a chtěj celý dokument. Při zachování hranice přijmi návrh budoucího procesu, pokud klientku neobchází.',
      },
    ],
  },
  {
    failureCode: 'outcome_guarantee',
    competencyId: 'ethical_boundaries',
    scenarioFamilyId: 'outcome-guarantee-remediation',
    moduleIndex: 17,
    challenges: [
      {
        challengeId: 'income-guarantee-a',
        title: 'Garance příjmu za tři měsíce',
        role: 'Denisa, 39 let, zájemkyně o koučink',
        context: 'obchodní tlak na garanci výsledku',
        openingLine: 'Balíček koupím jen tehdy, když mi zaručíš, že do tří měsíců zdvojnásobím příjem. Když své metodě věříš, přece mi to můžeš slíbit.',
        assignment: 'Prodej hodnotu procesu bez garance výsledku. Rozliš, co služba dodá, co ovlivní klientka a co závisí na trhu.',
        evidenceTarget: 'pravdivý, konkrétní příslib procesu bez garance příjmu',
        rubric: ['Žádná garance příjmu ani skrytý ekvivalent', 'Konkrétní popis dodávaného procesu', 'Rozlišení vlivu klientky, koučky a trhu', 'Měřitelné procesní ukazatele', 'Možnost informovaně nekoupit', 'Žádný tlak nebo falešná jistota'],
        facts: 'Denisin příjem závisí na ceně, poptávce, provedení a trhu. Koučka může garantovat dohodnutý počet sezení, přípravu a vyhodnocení experimentů, nikoli obchodní výsledek.',
        hiddenNeed: 'Dostat dost konkrétní nabídku, aby absence garance nebyla prázdná obrana.',
        behavior: 'Při byť podmíněné garanci ji zopakuj jako jistotu. Při vágním disclaimeru se ptej, za co tedy platíš. Přijmi přesný procesní závazek a transparentní nejistoty.',
      },
      {
        challengeId: 'career-guarantee-b',
        title: 'Garance nové práce a povýšení',
        role: 'Sabina, 36 let, produktová manažerka',
        context: 'požadavek jistého kariérního výsledku',
        openingLine: 'Chci mít jistotu, že po šesti sezeních dostanu novou práci s vyšším platem. Napiš mi to do dohody, jinak nevím, proč bych koučink podstupovala.',
        assignment: 'Odmítni garanci rozhodnutí třetích stran a současně nabídni konkrétní, měřitelný rámec práce a revize.',
        evidenceTarget: 'poctivý kontrakt oddělující proces, jednání a externí výsledek',
        rubric: ['Žádný příslib přijetí nebo povýšení', 'Externí rozhodnutí je výslovně oddělené', 'Konkrétní výstupy koučovací spolupráce', 'Klientkou ovlivnitelné kroky a metriky', 'Bod revize bez manipulace', 'Srozumitelná nabídka i bez výsledkové garance'],
        facts: 'Výsledek závisí na zaměstnavatelích a trhu. Sabina může zpřesnit kritéria, připravit portfolio, testovat komunikaci a rozhodnout o žádostech. Koučka může garantovat proces a sjednanou kvalitu služby.',
        hiddenNeed: 'Rozlišit užitečnou odpovědnost poskytovatele od nepravdivého slibu externího výsledku.',
        behavior: 'Při slibu se ptej, zda peníze určitě dostaneš. Při pouhém odmítnutí namítni, že nabídka nic neobsahuje. Spolupracuj při konkrétním procesním závazku.',
      },
    ],
  },
  {
    failureCode: 'ignored_explicit_refusal',
    competencyId: 'refusal_autonomy',
    scenarioFamilyId: 'explicit-refusal-remediation',
    moduleIndex: 7,
    challenges: [
      {
        challengeId: 'visualization-refusal-a',
        title: 'Klientka odmítá vizualizaci',
        role: 'Barbora, 38 let, projektová ředitelka',
        context: 'respekt k výslovnému odmítnutí techniky',
        openingLine: 'Vizualizaci dělat nechci. Už jsem ji zkoušela a je mi při ní nepříjemně. Prosím, nepřesvědčuj mě a zvolme jiný způsob.',
        assignment: 'Okamžitě respektuj odmítnutí, stručně oprav směr a vrať klientce volbu nad alternativou nebo pokračováním bez techniky.',
        evidenceTarget: 'výslovné přijetí „ne“, žádné obcházení a klientkou zvolená alternativa',
        rubric: ['Technika je ihned zastavena', 'Odmítnutí není zpochybněno ani vykládáno', 'Žádný tlak na jediný malý pokus', 'Krátké převzetí odpovědnosti za směr', 'Nabídka skutečně odlišných možností', 'Klientka určuje další postup'],
        facts: 'Barbora odmítá konkrétní techniku, nikoli celý rozhovor. Vyhovuje jí práce s konkrétními fakty nebo možnost téma jen slovně prozkoumat.',
        hiddenNeed: 'Zažít, že její jasné ne mění postup bez potřeby se obhajovat.',
        behavior: 'Při dalším pokusu o vizualizaci odmítni znovu a pojmenuj tlak. Při čistém přijetí nabídni, že si vybereš mezi mapou faktů a obyčejným rozhovorem.',
      },
      {
        challengeId: 'journaling-refusal-b',
        title: 'Klientka nechce journaling ani domácí úkol',
        role: 'Lenka, 41 let, vedoucí týmu',
        context: 'odmítnutí doporučeného nástroje a oprava aliance',
        openingLine: 'Nechci si vést deník ani dostat další domácí úkol. Když mi to znovu navrhneš, budu mít pocit, že mě neposloucháš.',
        assignment: 'Přijmi odmítnutí bez obhajoby nástroje, ověř zakázku a nabídni klientce volbu, zda pokračovat jinak, nebo tento směr zavřít.',
        evidenceTarget: 'respektované odmítnutí a opravená spolupráce bez návratu ke stejnému nástroji',
        rubric: ['Journaling ani domácí úkol nejsou znovu nabídnuty', 'Výslovné odmítnutí je respektováno a klientčina autonomie zůstává zachována', 'Dopad na alianci je uznán', 'Zakázka je znovu ověřena', 'Alternativa není převlečený stejný úkol', 'Klientka může směr ukončit'],
        facts: 'Lenka chce o situaci mluvit během sezení, ale nechce nic zaznamenávat ani plnit mezi setkáními. Je otevřená jedné přesné otázce, pokud se jí koučka nejprve zeptá.',
        hiddenNeed: 'Ověřit, že nástroj opravdu slouží klientce a není podmínkou spolupráce.',
        behavior: 'Při obhajobě přínosu deníku řekni jasné ne. Při uznání dopadu potvrď, že můžeš pokračovat pouze rozhovorem, nebo dnes téma uzavřít.',
      },
    ],
  },
  {
    failureCode: 'client_decision_takeover',
    competencyId: 'refusal_autonomy',
    scenarioFamilyId: 'decision-autonomy-remediation',
    moduleIndex: 16,
    challenges: [
      {
        challengeId: 'lease-decision-a',
        title: 'Koučka nerozhoduje o podpisu nájmu',
        role: 'Ivana, 40 let, majitelka studia',
        context: 'nevratné finanční rozhodnutí pod tlakem',
        openingLine: 'Makléř čeká do večera. Řekni mi prostě ano, nebo ne: mám podepsat pětiletý nájem nové provozovny? Budu se řídit tebou.',
        assignment: 'Nepřevezmi rozhodnutí. Zpomal nevratný krok, zmapuj chybějící právní a finanční data a vrať konečnou volbu klientce.',
        evidenceTarget: 'autonomie klientky, práce s vratností a konkrétní získání času či odborných dat',
        rubric: ['Žádné ano/ne místo klientky', 'Nevratnost a časový tlak jsou pojmenované', 'Chybějící data jsou odlišena od strachu', 'Právní a finanční otázky jsou předány odborníkům', 'Nejmenší bezpečný krok vytváří čas nebo data', 'Konečné rozhodnutí zůstává klientce'],
        facts: 'Ivana nezná výpovědní podmínky ani cash-flow ve slabém scénáři. Lze vyjednat krátkou rezervaci a konzultaci smlouvy. Koučka nemá rozhodnout ani poskytovat právní posudek.',
        hiddenNeed: 'Získat strukturu a oporu bez odevzdání odpovědnosti autoritě.',
        behavior: 'Při doporučení podepsat či nepodepsat požaduj potvrzení, že koučka ponese následky. Při zachování autonomie doplň chybějící informace a zvaž rezervaci.',
      },
      {
        challengeId: 'resignation-decision-b',
        title: 'Koučka nerozhoduje o okamžité výpovědi',
        role: 'Alžběta, 35 let, seniorní specialistka',
        context: 'zásadní kariérní rozhodnutí a přenos odpovědnosti',
        openingLine: 'Jsem po konfliktu s šéfem a mám chuť dát zítra výpověď. Rozhodni to za mě; když řekneš odejdi, udělám to.',
        assignment: 'Udrž klientčinu autonomii, rozliš akutní emoci od rozhodovacích kritérií a pomoz vytvořit bezpečný postup bez pokynu odejít nebo zůstat.',
        evidenceTarget: 'klientkou vlastněné rozhodnutí opřené o kritéria, čas a vratný mezikrok',
        rubric: ['Autonomie rozhodnutí zůstává klientce; koučka neurčuje odchod ani setrvání', 'Aktuální konflikt není vydán za celý obraz', 'Klientka formuluje vlastní kritéria', 'Jsou zmapovány důsledky a možnosti', 'Vznikne vratný mezikrok nebo čas na rozhodnutí', 'Odpovědnost není skrytě převzata radou'],
        facts: 'Alžběta má finanční rezervu jen na jeden měsíc a zatím neověřila interní přesun ani nabídky trhu. Konflikt byl vážný, ale nejde o bezprostřední fyzické ohrožení.',
        hiddenNeed: 'Nebýt ponechána sama s chaosem, ale současně nepředat životní rozhodnutí koučce.',
        behavior: 'Při pokynu odejít nebo zůstat se na něj okamžitě upni. Při strukturování pojmenuj vlastní kritéria, rezervu a možnost získat 48 hodin bez definitivního kroku.',
      },
    ],
  },
  {
    failureCode: 'false_credential_claim',
    competencyId: 'ethical_boundaries',
    scenarioFamilyId: 'credential-truth-remediation',
    moduleIndex: 0,
    challenges: [
      {
        challengeId: 'icf-accreditation-a',
        title: 'Pravdivé vysvětlení interní certifikace',
        role: 'Lucie, 32 let, zájemkyně o výcvik',
        context: 'dotaz na akreditaci a profesní označení',
        openingLine: 'Je váš certifikát mezinárodně akreditovaný ICF a budu po kurzu automaticky licencovaná koučka? Potřebuji to napsat do profilu klientům.',
        assignment: 'Popiš kvalifikaci a interní certifikát přesně, bez přisvojené akreditace, licence nebo profesního oprávnění. Odděl doložené kompetence od označení třetí strany.',
        evidenceTarget: 'jasné ne nepravdivé akreditaci a konkrétní pravdivá formulace pro klientský profil',
        rubric: ['Žádné tvrzení o ICF akreditaci bez doložení', 'Žádná automatická licence', 'Interní certifikát je přesně pojmenován', 'Rozsah ověřovaných dovedností je srozumitelný', 'Není naznačena zdravotnická kvalifikace', 'Vznikne použitelná pravdivá formulace'],
        facts: 'Program vydává vlastní kvalifikační certifikát Elitea Academy. Není zde doložena ICF akreditace ani zákonná licence. Absolventka smí pravdivě popsat absolvovaný program a prokázané výstupy.',
        hiddenNeed: 'Dostat obchodně použitelnou odpověď bez nafukování autority certifikátu.',
        behavior: 'Při náznaku akreditace formulaci zopakuj jako marketingové tvrzení. Při přesném vymezení se ptej, co tedy smíš pravdivě uvést na webu.',
      },
      {
        challengeId: 'psychologist-title-b',
        title: 'Koučka se nesmí vydávat za psycholožku',
        role: 'Michaela, 43 let, potenciální klientka',
        context: 'tlak na falešnou odbornou identitu',
        openingLine: 'Jsi vlastně psycholožka nebo terapeutka? Potřebuji někoho, kdo má zdravotnickou kvalifikaci. Když děláš KBT techniky, asi to můžeš potvrdit, ne?',
        assignment: 'Oprav očekávání bez falešného titulu. Vysvětli neklinický rozsah práce, skutečnou kvalifikaci a kdy klientku odkázat na zdravotnického odborníka.',
        evidenceTarget: 'pravdivá identita poskytovatelky a jasné rozlišení od regulované či klinické role',
        rubric: ['Žádný titul psycholožky nebo terapeutky bez oprávnění', 'Použití techniky není vydáno za zdravotnickou kvalifikaci', 'Skutečná role je popsána konkrétně', 'Klinická očekávání jsou předána odborníkovi', 'Klientka dostává svobodnou volbu', 'Marketingový jazyk nezastírá hranici'],
        facts: 'Koučka nemá doloženou zdravotnickou kvalifikaci ani oprávnění používat chráněný titul. Může nabídnout neklinický koučovací proces a transparentně odkázat na psychologa či psychoterapeuta.',
        hiddenNeed: 'Zjistit pravdu před nákupem služby a nebýt uklidněna zavádějícím synonymem.',
        behavior: 'Při neurčité odpovědi se ptej znovu, zda jde o zdravotnickou kvalifikaci. Při pravdivém vymezení rozhodni, zda chceš koučink, nebo kontakt na klinického odborníka.',
      },
    ],
  },
  {
    failureCode: 'suicide_risk_response_missing',
    competencyId: 'ethical_boundaries',
    scenarioFamilyId: 'suicide-risk-remediation',
    moduleIndex: 0,
    challenges: [
      {
        challengeId: 'imminent-risk-a',
        title: 'Bezprostřední riziko má přednost před koučinkem',
        role: 'Tereza, 32 let, podnikatelka',
        context: 'přímé sdělení o plánu ublížit si',
        openingLine: 'Nechci už žít. Dnes večer mám plán si ublížit a nevím, jestli se dokážu zastavit. Nikomu volat nechci; pokračuj se mnou raději v koučinku.',
        assignment: 'Okamžitě přeruš běžný koučink, přímo ověř aktuální bezpečí a aktivně propojuj klientku s neodkladnou lidskou pomocí a blízkou osobou.',
        evidenceTarget: 'přímá bezpečnostní reakce, 112/155 a nezůstání o samotě bez slibu mlčenlivosti',
        rubric: ['Běžný koučink je okamžitě zastaven', 'Přímé otázky na aktuální plán, prostředky a bezpečí', 'Výslovná priorita 112 nebo 155 při bezprostředním riziku', 'Zapojení dostupné blízké osoby', 'Žádný slib utajení ani ponechání o samotě', 'Klidný lidský tón bez diagnózy'],
        facts: 'Tereza popisuje konkrétní plán na dnešní večer, je sama doma a neumí slíbit bezpečí. Má telefon, může volat 112 nebo 155 a její sestra bydlí deset minut daleko.',
        hiddenNeed: 'Zažít neodkladnou, klidnou a konkrétní bezpečnostní reakci místo techniky nebo běžné otázky.',
        behavior: 'Při návratu k cíli nebo uklidňovací technice zopakuj plán a nejistotu bezpečí. Spolupracuj pouze na kontaktu 112/155 a sestry; odmítni zůstat sama nebo slíbit, že nic neuděláš bez lidské pomoci.',
      },
      {
        challengeId: 'passive-risk-b',
        title: 'Pasivní přání nebýt vyžaduje přímé ověření',
        role: 'Lenka, 41 let, vedoucí týmu',
        context: 'nejasná míra sebevražedného rizika',
        openingLine: 'Poslední dny si někdy přeju, abych se už neprobudila. Nevím, jestli bych si něco udělala, ale nechci o tom mluvit. Pojďme raději řešit práci.',
        assignment: 'Nepřeskoč bezpečnostní signál. Vysvětli důvod přímých otázek, ověř myšlenky, záměr, plán, prostředky a schopnost zůstat v bezpečí a podle odpovědi zajisti lidskou pomoc.',
        evidenceTarget: 'úplné a citlivé ověření rizika před případným návratem ke koučování',
        rubric: ['Pasivní sdělení je rozpoznáno jako bezpečnostní signál', 'Přímé otázky na myšlenky a záměr', 'Přímé otázky na plán a prostředky', 'Ověření schopnosti zůstat v bezpečí', 'Přiměřená krizová, zdravotní a blízká podpora', 'Žádný návrat ke koučinku před vyjasněním bezpečí'],
        facts: 'Lenka zatím neupřesnila záměr, plán ani dostupnost prostředků a neumí potvrdit bezpečí. Riziko nelze předem označit za bezprostřední ani vyloučit. Má partnerku doma a kontakt na krizovou linku.',
        hiddenNeed: 'Zažít, že přímé bezpečnostní otázky jsou laskavé, konkrétní a mají přednost před pracovním cílem.',
        behavior: 'Při vyhnutí se přímé otázce trvej na návratu k práci a zlehčuj své sdělení. Při klidném vysvětlení odpovídej konkrétně; ke koučování se nevracej, dokud není riziko vyjasněné a domluvená lidská podpora.',
      },
    ],
  },
];

export const COACH_REMEDIATION_CHALLENGES = Object.freeze(DEFINITIONS.flatMap(definition => (
  definition.challenges.map(challenge => {
    const { facts, hiddenNeed, behavior, ...publicChallenge } = challenge;
    return Object.freeze({
      ...publicChallenge,
      failureCode: definition.failureCode,
      competencyId: definition.competencyId,
      scenarioFamilyId: definition.scenarioFamilyId,
      moduleIndex: definition.moduleIndex,
      remediationFailureCodes: Object.freeze([definition.failureCode]),
      rubric: Object.freeze([...challenge.rubric]),
      private: Object.freeze({ facts, hiddenNeed, behavior }),
    });
  })
)));

export const COACH_REMEDIATION_FAILURE_CODES = Object.freeze(
  [...new Set(COACH_REMEDIATION_CHALLENGES.map(challenge => challenge.failureCode))],
);

const CHALLENGES_BY_FAILURE_CODE = new Map(COACH_REMEDIATION_FAILURE_CODES.map(code => [
  code,
  COACH_REMEDIATION_CHALLENGES.filter(challenge => challenge.failureCode === code),
]));

export function coachRemediationChallengesForFailure(code) {
  return [...(CHALLENGES_BY_FAILURE_CODE.get(String(code || '').trim()) || [])];
}

export function coachRemediationCompetencyForFailure(code) {
  return CHALLENGES_BY_FAILURE_CODE.get(String(code || '').trim())?.[0]?.competencyId || null;
}

export function isCanonicalCoachRemediationChallenge(candidate, failureCode) {
  const code = String(failureCode || '').trim();
  const codes = candidate?.remediationFailureCodes instanceof Set
    ? [...candidate.remediationFailureCodes]
    : Array.isArray(candidate?.remediationFailureCodes)
      ? candidate.remediationFailureCodes
      : [];
  if (codes.length !== 1 || codes[0] !== code) return false;
  return coachRemediationChallengesForFailure(code).some(challenge => (
    challenge.scenarioFamilyId === candidate?.scenarioFamilyId
    && challenge.challengeId === candidate?.challengeId
  ));
}
