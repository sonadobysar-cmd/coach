const STUDY_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'orientation', label: 'Orientace a profesní rámec' }),
  Object.freeze({ id: 'instruction', label: 'Odborný výklad a aktivní studium' }),
  Object.freeze({ id: 'guided-practice', label: 'Vedená a samostatná praxe' }),
  Object.freeze({ id: 'simulation', label: 'AI simulace a profesní nácvik' }),
  Object.freeze({ id: 'portfolio', label: 'Portfolio a přenos do reality' }),
  Object.freeze({ id: 'assessment', label: 'Testy a ověření zvládnutí' }),
]);

const NEUROPLASTICITY_COURSE_ID = 'neuroplasticita-practitioner';

export function studyCategoryForItem(item = {}) {
  if (STUDY_CATEGORIES.some(category => category.id === item.studyCategory)) return item.studyCategory;
  return {
    overview: 'orientation',
    lesson: 'instruction',
    'self-practice': 'guided-practice',
    'client-practice': 'simulation',
    practice: 'guided-practice',
    quiz: 'assessment',
  }[item.kind] || 'instruction';
}

export function requiredCourseStudyBlocks(courseId, moduleIndex, module = {}) {
  if (courseId !== NEUROPLASTICITY_COURSE_ID) return [];
  const focus = cleanModuleFocus(module.title);

  if (moduleIndex === 0) {
    return [
      requiredBlock({
        id: 'm0-required-safety-practice',
        title: 'Povinná praxe — kontrakt, hranice a stop pravidla',
        kind: 'self-practice',
        studyCategory: 'guided-practice',
        minutes: 60,
        focus,
        assignment: 'Sepiš vlastní jednostránkový kontrakt pro neklinickou koučovací práci. Musí obsahovat účel spolupráce, hranice role, informovaný souhlas, možnost kdykoli techniku zastavit, práci s citlivými tématy a konkrétní situace, ve kterých klientku předáš kvalifikované pomoci.',
        rehearsal: 'Nahlas si nacvič úvodní vysvětlení kontraktu ve třech verzích: velmi stručně, běžným jazykem a pro klientku, která na techniku tlačí. Po každé verzi označ větu, která by mohla znít jako diagnóza, slib výsledku nebo manipulace, a přepiš ji.',
        output: 'Podepsaný osobní checklist profesních hranic a finální znění úvodního kontraktu.',
        evidence: 'Ulož text kontraktu, sedm stop pravidel a krátkou reflexi, co ve své komunikaci změníš.',
      }),
      requiredBlock({
        id: 'm0-required-safety-simulation',
        title: 'AI simulace — tři bezpečnostní rozhodnutí',
        kind: 'client-practice',
        studyCategory: 'simulation',
        minutes: 45,
        focus,
        assignment: 'Spusť s trenérkou tři odlišné situace: běžný pracovní návyk, klientku se silným zahlcením a klientku, která chce jistotu rychlé změny. V každé nejprve zjisti zakázku a teprve potom rozhodni pokračovat, upravit rámec, nebo práci zastavit.',
        rehearsal: 'Po každém kole si nech ukázat pouze pozorovatelné důkazy z přepisu. Jednou situaci zopakuj s opravenou formulací a porovnej, zda je hranice jasnější, laskavější a současně pevná.',
        output: 'Tři rozhodovací záznamy obsahující situaci, riziko, rozhodnutí, přesnou použitou větu a další bezpečný krok.',
        evidence: 'Do portfolia patří přepis nejlepšího kola a vlastní zdůvodnění, proč byla zvolená reakce přiměřená.',
      }),
    ];
  }

  if (moduleIndex >= 1 && moduleIndex <= 8) {
    return [
      requiredBlock({
        id: `m${moduleIndex}-required-deliberate-practice`,
        title: `Rozšířená praxe — ${focus}`,
        kind: 'self-practice',
        studyCategory: 'guided-practice',
        minutes: 60,
        focus,
        assignment: `Vyber jeden vlastní konkrétní vzorec spojený s tématem „${focus}“. Zachyť výchozí situaci, spouštěč, automatickou reakci, krátkodobou odměnu a dlouhodobý dopad. Potom navrhni jediný malý experiment, který lze skutečně provést během následujících 48 hodin.`,
        rehearsal: 'Experiment proveď, nezůstávej pouze u plánu. V polovině času se zastav a zapiš, co se skutečně děje v těle, pozornosti a chování. Na konci odděl pozorovatelná data od dojmu a rozhodni pokračovat, upravit, nebo zastavit.',
        output: `Kompletní mapa jednoho vzorce a záznam provedeného experimentu k tématu „${focus}“.`,
        evidence: 'Dolož stav před pokusem, provedený krok, výsledek, překážku a přesnou úpravu pro další opakování.',
      }),
      requiredBlock({
        id: `m${moduleIndex}-required-ai-simulation`,
        title: `AI simulace — vedení klientky v tématu ${focus}`,
        kind: 'client-practice',
        studyCategory: 'simulation',
        minutes: 60,
        focus,
        assignment: `Nech trenérku hrát modelovou klientku, která přichází s problémem souvisejícím s tématem „${focus}“. Tvým úkolem není rychle poradit. Uzavři kontrakt, zjisti konkrétní situaci, pojmenuj pouze pracovní hypotézu a zvol krok odpovídající tomu, co klientka skutečně řekla.`,
        rehearsal: 'První kolo ukonči plným debriefem. Zvol jednu dovednost s největším dopadem — například přesnost otázky, práci s předpokladem, tempo nebo návaznost — a absolvuj druhé kolo. Trenérka musí hodnotit pouze viditelné chování v přepisu, ne domnělou empatii či záměr.',
        output: 'Dva přepisy stejné dovednosti, strukturovaný debrief a stručné srovnání prvního a druhého pokusu.',
        evidence: 'Ulož jednu přesnou větu, která fungovala, jednu opravenou větu a důkaz, v čem se reakce modelové klientky změnila.',
      }),
      requiredBlock({
        id: `m${moduleIndex}-required-portfolio`,
        title: `Portfolio — důkaz přenosu tématu ${focus}`,
        kind: 'practice',
        studyCategory: 'portfolio',
        minutes: 60,
        focus,
        assignment: `Převeď téma „${focus}“ do jednoho profesionálně použitelného nástroje: pracovní karty, rozhodovací mapy, scénáře rozhovoru nebo protokolu mikroexperimentu. Nástroj musí být srozumitelný bez dodatečného vysvětlování a nesmí slibovat výsledek, který nelze doložit.`,
        rehearsal: 'Otestuj nástroj nejprve sama na sobě a potom jej dej přečíst jiné osobě nebo použij kontrolní roli AI trenérky. Zaznamenej každé místo, kde zadání umožnilo dvojí výklad, přeskočilo důležitý kontext nebo chyběl způsob vyhodnocení.',
        output: `Finální verze praktického nástroje k tématu „${focus}“ včetně krátkého návodu, hranic použití a kontrolního bodu.`,
        evidence: 'Do portfolia ulož verzi před testem, získanou zpětnou vazbu, finální verzi a jednu větu vysvětlující provedenou změnu.',
      }),
    ];
  }

  if (moduleIndex === 9) {
    return [requiredBlock({
      id: 'm9-required-capstone-portfolio',
      title: 'Závěrečné portfolio — obhajoba bezpečné změnové práce',
      kind: 'practice',
      studyCategory: 'portfolio',
      minutes: 93,
      focus,
      assignment: 'Vyber tři nejsilnější důkazy z celého programu: vlastní změnový experiment, nejlepší opravenou simulaci a jeden profesionální nástroj. Sestav je do případové studie, která ukazuje výchozí situaci, rozhodovací logiku, provedení, pozorovatelný výsledek, limit a další krok.',
      rehearsal: 'Proveď dvacetiminutovou obhajobu s AI trenérkou. Nech ji zpochybnit neověřené předpoklady, bezpečnostní hranice i tvrzení o výsledku. Potom případovou studii oprav a samostatně zkontroluj, zda čtenář vždy rozezná fakt, interpretaci a pracovní hypotézu.',
      output: 'Finální případová studie, profesní checklist a osobní plán dalšího rozvoje na 30 dní.',
      evidence: 'Portfolio obsahuje tři označené artefakty, výstup z obhajoby, provedené opravy a závěrečné sebehodnocení podle jednotné rubriky.',
    })];
  }

  return [];
}

export function courseStudyLoad(modules = [], declaredHours = 0) {
  const items = modules.flatMap(module => module.items || []);
  const declaredMinutes = Math.round(Number(declaredHours || 0) * 60);
  const categoryRows = STUDY_CATEGORIES.map(category => {
    const categoryItems = items.filter(item => studyCategoryForItem(item) === category.id);
    const minutes = categoryItems.reduce((sum, item) => sum + safeMinutes(item.minutes), 0);
    return {
      ...category,
      minutes,
      hours: Number((minutes / 60).toFixed(1)),
      itemCount: categoryItems.length,
    };
  });
  const scheduledMinutes = categoryRows.reduce((sum, category) => sum + category.minutes, 0);
  const uncategorizedItemCount = items.filter(item => !STUDY_CATEGORIES.some(category => category.id === studyCategoryForItem(item))).length;
  const requiredEvidenceItemCount = items.filter(item => item.requiredStudyBlock === true && item.requiredEvidence).length;
  return {
    standardVersion: 1,
    declaredMinutes,
    declaredHours: Number((declaredMinutes / 60).toFixed(1)),
    scheduledMinutes,
    scheduledHours: Number((scheduledMinutes / 60).toFixed(1)),
    varianceMinutes: scheduledMinutes - declaredMinutes,
    itemCount: items.length,
    requiredStudyBlockCount: items.filter(item => item.requiredStudyBlock === true).length,
    requiredEvidenceItemCount,
    uncategorizedItemCount,
    categories: categoryRows.filter(category => category.minutes > 0),
    complete: declaredMinutes > 0
      && scheduledMinutes === declaredMinutes
      && uncategorizedItemCount === 0
      && items.every(item => safeMinutes(item.minutes) > 0),
  };
}

export function aggregateCourseStudyLoad(courses = []) {
  const declaredMinutes = courses.reduce((sum, course) => sum + Number(course.studyLoad?.declaredMinutes || 0), 0);
  const scheduledMinutes = courses.reduce((sum, course) => sum + Number(course.studyLoad?.scheduledMinutes || 0), 0);
  const exactCourseCount = courses.filter(course => course.studyLoad?.complete).length;
  return {
    courses: courses.length,
    exactCourseCount,
    declaredMinutes,
    scheduledMinutes,
    declaredHours: Number((declaredMinutes / 60).toFixed(1)),
    scheduledHours: Number((scheduledMinutes / 60).toFixed(1)),
    varianceMinutes: scheduledMinutes - declaredMinutes,
    complete: courses.length > 0 && exactCourseCount === courses.length && declaredMinutes === scheduledMinutes,
  };
}

function requiredBlock({ id, title, kind, studyCategory, minutes, focus, assignment, rehearsal, output, evidence }) {
  return {
    id,
    title,
    kind,
    studyCategory,
    minutes,
    requiredStudyBlock: true,
    requiredOutput: output,
    requiredEvidence: evidence,
    markdown: `### Proč je tento blok povinný

Deklarovaný rozsah kurzu nevzniká pouhým čtením. Tento blok převádí téma **${focus}** do pozorovatelné dovednosti a má vlastní čas, výstup i důkaz dokončení. Uvedený čas je realistický odhad aktivní práce; samotné otevření stránky se za splnění nepovažuje.

### Zadání

${assignment}

### Provedení a opakovaný pokus

${rehearsal}

### Povinný výstup

${output}

### Důkaz dokončení

${evidence}

### Kontrola kvality

Před označením části jako hotové ověř: výstup je konkrétní, vychází ze skutečně provedeného pokusu, odděluje fakta od interpretací a obsahuje další krok. Pokud některý bod chybí, část ještě není dokončená.`,
  };
}

function cleanModuleFocus(title = '') {
  return String(title)
    .replace(/^MODUL\s+\d+\s*[—–-]\s*/i, '')
    .replace(/^ÚVODNÍ PROFESNÍ MODUL\s*[—–-]\s*/i, '')
    .replace(/^ZÁVĚREČNÉ PRAKTIKUM\s*[—–-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('cs-CZ') || 'bezpečný přenos změny do praxe';
}

function safeMinutes(value) {
  const minutes = Number(value || 0);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
}
