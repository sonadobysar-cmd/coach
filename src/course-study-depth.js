import { courseMasteryProfile } from './course-mastery.js';

export const MIN_LESSON_WORDS = 160;

export function enrichCourseStudyDepth(items = [], context = {}) {
  const profile = courseMasteryProfile(context.courseId);
  return items.map((item, itemIndex) => {
    if (item.kind !== 'lesson') return item;

    const beforeWords = courseWordCount(item.markdown);
    if (beforeWords >= MIN_LESSON_WORDS) {
      return withDepthMetadata(item, beforeWords, false);
    }

    const focus = cleanLessonTitle(item.title);
    const moduleIndex = Number(context.moduleIndex || 0);
    const moduleCount = Number(context.moduleCount || 1);
    const rotation = moduleIndex * 3 + itemIndex;
    const learningNeed = pickPhase(profile.needs, moduleIndex, moduleCount, 'přesně porozumět principu a jeho použití');
    const practiceContext = pickPhase(profile.contexts, moduleIndex, moduleCount, 'reálná pracovní situace');
    const evidence = pickPhase(profile.evidence, moduleIndex, moduleCount, 'konkrétní pozorovatelný výsledek');
    const transfer = buildTransferSection({
      courseTitle: context.courseTitle,
      moduleTitle: context.moduleTitle,
      focus,
      role: profile.role,
      learningNeed,
      practiceContext,
      evidence,
      variant: rotation % 4,
    });
    const markdown = `${String(item.markdown || '').trim()}\n\n${transfer}`.trim();
    const afterWords = courseWordCount(markdown);

    return withDepthMetadata({ ...item, markdown }, afterWords, true, beforeWords);
  });
}

export function courseWordCount(markdown = '') {
  const text = String(markdown)
    .replace(/<!--.*?-->/gs, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\]()|~–—-]/g, ' ');
  return text.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu)?.length || 0;
}

export function courseDepthSummary(modules = []) {
  const items = modules.flatMap(module => module.items || []);
  const lessons = items.filter(item => item.kind === 'lesson');
  const wordCounts = lessons.map(item => courseWordCount(item.markdown));
  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
  return {
    standardVersion: 1,
    minimumLessonWords: MIN_LESSON_WORDS,
    lessonCount: lessons.length,
    averageLessonWords: lessons.length ? Math.round(totalWords / lessons.length) : 0,
    shortestLessonWords: lessons.length ? Math.min(...wordCounts) : 0,
    enrichedLessonCount: lessons.filter(item => item.depth?.enriched).length,
    scheduledMinutes: items.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
    meetsLessonDepthStandard: lessons.length > 0 && wordCounts.every(count => count >= MIN_LESSON_WORDS),
  };
}

function buildTransferSection({
  courseTitle,
  moduleTitle,
  focus,
  role,
  learningNeed,
  practiceContext,
  evidence,
  variant,
}) {
  const roleText = sentenceCase(role || 'modelová klientka');
  const moduleFocus = cleanModuleTitle(moduleTitle);
  const activities = [
    `Téma **${focus}** není zvládnuté pouhým přečtením. Potřebuješ rozpoznat, kdy je užitečné, co v dané situaci skutečně mění a podle čeho poznáš, že nepoužíváš jen naučenou frázi.

1. **Vysvětli princip:** vlastními slovy popiš, jak část „${focus}“ souvisí s výsledkem modulu „${moduleFocus}“. Přidej jeden příklad vhodného použití a jeden protipříklad, kdy by stejný postup řešil jiný problém.
2. **Vyřeš mikropřípad:** ${roleText} přináší situaci „${practiceContext}“. Nezačínej řešením. Nejprve napiš dvě informace, které musíš zjistit, a teprve potom zvol jeden malý postup, který naplní potřebu: „${learningNeed}“.
3. **Dolož rozhodnutí:** zaznamenej, co bylo faktem, co tvou interpretací, jaké jiné řešení připadalo v úvahu a proč jsi je nyní nezvolila. Výstup uzavři důkazem: ${evidence}.`,
    `U části **${focus}** odděl znalost pojmu od profesní dovednosti. Dovednost se projeví až tehdy, když umíš princip vysvětlit, zvolit jej ve vhodném okamžiku a upravit postup podle skutečné reakce druhé strany.

1. **Srovnej dvě cesty:** napiš přesný postup vycházející z lekce a vedle něj lákavou zkratku, která by mohla působit profesionálně, ale ignorovala by cíl modulu „${moduleFocus}“. U obou označ předpoklad, riziko a informaci, která může rozhodnutí změnit.
2. **Postav rozhodovací křižovatku:** ${roleText} řeší „${practiceContext}“ a potřebuje „${learningNeed}“. Navrhni dvě možné reakce. Uveď, na jakou konkrétní odpověď nebo pozorování čekáš, než mezi nimi zvolíš; nevymýšlej chybějící data.
3. **Vytvoř použitelný výstup:** zpracuj krátkou kartu pro další osobu: kdy princip použít, první krok, stop podmínka a způsob kontroly. Povinný důkaz je: ${evidence}.`,
    `Smyslem části **${focus}** je převést princip do rozhodování. Nestačí vědět, jak se metoda jmenuje; musíš umět zdůvodnit její volbu, poznat její limit a zachytit výsledek bez přikrášlení.

1. **Teach-back bez žargonu:** během devadesáti sekund vysvětli princip začátečnici. Použij jeden příklad z modulu „${moduleFocus}“, ale žádnou garanci výsledku. Potom označ větu, která je doloženým pravidlem, a větu, která je pouze pracovní hypotézou.
2. **Klinika chyby:** pro situaci „${practiceContext}“ záměrně napiš ukvapené doporučení. Najdi v něm tři chyby — například neověřený předpoklad, přeskočený kontext nebo chybějící měřítko — a přepiš je do postupu, který pomůže naplnit potřebu „${learningNeed}“.
3. **Přenes princip:** použij opravenou verzi na jeden vlastní případ. Zachyť stav před krokem, skutečný průběh a výsledek. Jako důkaz ulož: ${evidence}.`,
    `Při práci s tématem **${focus}** sleduj rozdíl mezi aktivitou a účinkem. Správně provedený postup není ten, který vypadá odborně, ale ten, který odpovídá zakázce, kontextu a předem stanovenému měřítku.

1. **Sestav diagnostickou mapu:** pro situaci „${practiceContext}“ rozděl zápis do čtyř polí: pozorovatelná fakta, neznámé informace, omezení a otázka, která nejvíc ovlivní další volbu. Propoj mapu s cílem modulu „${moduleFocus}“.
2. **Navrhni vratný mikroexperiment:** ${roleText} potřebuje „${learningNeed}“. Urči nejmenší bezpečný krok, výchozí stav, očekávaný signál, čas kontroly a stop pravidlo. Neměň současně více hlavních proměnných; jinak z výsledku nezjistíš, co skutečně pomohlo.
3. **Proveď review:** po pokusu odděl data od dojmu a rozhodni pokračovat, upravit, nebo zastavit. Jednou větou zdůvodni volbu a přilož důkaz: ${evidence}.`,
  ];
  return `<!-- elitea-study-depth:v1 -->
### Přenos do praxe (10–12 minut)

${activities[variant]}

### Kontrola zvládnutí

Bez nahlížení shrň princip ve třech větách a pojmenuj jeho hranici. Hotovo není pocit „rozumím tomu“, ale konkrétní zápis nebo artefakt, ze kterého druhá osoba pozná výchozí situaci, tvoji rozhodovací logiku, provedený krok a způsob vyhodnocení. Pokud chybějí fakta, souhlas, měřítko nebo možnost postup změnit, vrať se k zadání; nepřekrývej mezeru sebejistým doporučením. V programu **${courseTitle}** se tato práce ukládá jako důkaz učení, nikoli jako formální vyplnění stránky.`;
}

function withDepthMetadata(item, wordCount, enriched, originalWordCount = wordCount) {
  return {
    ...item,
    depth: {
      standardVersion: 1,
      wordCount,
      originalWordCount,
      enriched,
      meetsStandard: wordCount >= MIN_LESSON_WORDS,
    },
  };
}

function pickPhase(values, moduleIndex, moduleCount, fallback) {
  if (!Array.isArray(values) || !values.length) return fallback;
  const safeModuleCount = Math.max(1, Number(moduleCount) || 1);
  const position = Math.min(safeModuleCount - 1, Math.max(0, Number(moduleIndex) || 0));
  const index = Math.min(values.length - 1, Math.floor(position * values.length / safeModuleCount));
  return values[index];
}

function cleanLessonTitle(value = '') {
  return String(value)
    .replace(/^Lekce\s+[\d.]+\s*[—–-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'praktický princip lekce';
}

function cleanModuleTitle(value = '') {
  const cleaned = String(value)
    .replace(/^MODUL\s+\d+\s*[—–-]\s*/i, '')
    .replace(/^ÚVODNÍ PROFESNÍ MODUL\s*[—–-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'praktické použití';
  const letters = cleaned.replace(/[^A-Za-zÀ-ž]/g, '');
  if (letters.length >= 4 && letters === letters.toLocaleUpperCase('cs-CZ')) {
    const lower = cleaned.toLocaleLowerCase('cs-CZ');
    return sentenceCase(lower);
  }
  return cleaned;
}

function sentenceCase(value = '') {
  const text = String(value).trim();
  return text ? text.charAt(0).toLocaleUpperCase('cs-CZ') + text.slice(1) : '';
}
