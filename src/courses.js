import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { enrichSelfTrustStudy } from './self-trust-study.js';
import { enrichLifeCoachStudy } from './life-coach-study.js';
import { enrichWomensCircleStudy } from './womens-circle-study.js';
import { publicCourseTrainerProfile } from './course-trainer-profiles.js';
import { extractCourseVisual } from './course-visuals.js';

export const COURSE_CATEGORIES = Object.freeze({
  COACHING_MENTAL_HEALTH: Object.freeze({ id: 'coaching-mental-health', label: 'Koučink & Mental Health' }),
  MARKETING: Object.freeze({ id: 'marketing', label: 'Marketing' }),
  BUSINESS_STRATEGY: Object.freeze({ id: 'business-strategy', label: 'Byznys, mentoring & strategie' }),
});

const NEUROPLASTICITY_META = Object.freeze({
  id: 'neuroplasticita-practitioner',
  slug: 'prepis-svuj-vzorec',
  title: 'Přepiš svůj vzorec',
  subtitle: 'Praktická neuroplasticita v koučovací praxi',
  badge: 'ELITEA CERTIFIED PRACTITIONER',
  level: 'Profesní výcvik',
  durationHours: 40,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Nauč se techniky nejprve na sobě, potom v simulaci se studijní trenérkou Elitea a nakonec v bezpečné koučovací praxi s klientkou.',
  coverNumber: '01',
  topicLabel: 'NEUROPLASTICITA',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
});

const SELF_TRUST_META = Object.freeze({
  id: 'pevna-v-sobe-intensive',
  slug: 'pevna-v-sobe',
  title: 'Pevná v sobě',
  subtitle: 'Sebedůvěra, sebeláska a sebepřijetí v praxi',
  badge: 'ELITEA SIGNATURE INTENSIVE',
  level: 'Intenzivní koučovací program',
  durationHours: 40,
  accent: 'ink',
  instructor: 'Nia Dobyšar',
  description: 'Čtyřicetihodinový textový a interaktivní program: omluvy, hlas, pochvala, people-pleasing, hranice, imposter fenomén, automatické myšlenky, růstové nastavení, 21 materiálů, 12 audio praxí a osobní portfolio důkazů.',
  coverNumber: '02',
  topicLabel: 'SEBEDŮVĚRA',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
  certificateTitle: 'Osvědčení o absolvování programu Pevná v sobě',
  certificateThresholdPercent: 100,
  certificateNote: 'Osvědčení potvrzuje dokončení programu, jeho praktických výstupů a závěrečného ověření. Nejde o profesní, zdravotnickou ani psychoterapeutickou kvalifikaci.',
});

const SPIRITUAL_COACH_META = Object.freeze({
  id: 'spiritualni-koucink-practice',
  slug: 'spiritualni-koucink-v-praxi',
  title: 'Spirituální koučink v praxi',
  subtitle: 'Intuice, hluboké vedení a vlastní signature metoda',
  badge: 'ELITEA CERTIFIED SPIRITUAL COACH',
  level: 'Profesní výcvik',
  durationHours: 32,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Kompletní textový a praktický výcvik: vlastní sladění, bezpečné vedení klientky, spirituální praxe, signature metoda, podnikání, portfolio a dvě celá cvičná sezení.',
  coverNumber: '03',
  topicLabel: 'SPIRITUALITA',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
  certificateTitle: 'Elitea Certified Spiritual Coach',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení výcviku, praktického portfolia a závěrečného nácviku podle standardu Elitea Academy.',
});

const COMMUNICATION_META = Object.freeze({
  id: 'komunikace-v-praxi',
  slug: 'komunikace-ktera-funguje',
  title: 'Komunikace, která funguje',
  subtitle: 'Profesní masterclass pro rozhovor, vliv, prezentaci a náročné situace',
  badge: 'ELITEA CERTIFIED COMMUNICATION PRACTITIONER',
  level: 'Profesní výcvik',
  durationHours: 40,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Textový a interaktivní komunikační výcvik s kamerovým tréninkem, simulacemi s Elitea, pracovními listy, přesnými audio instrukcemi a závěrečným portfoliem důkazů.',
  coverNumber: '04',
  topicLabel: 'KOMUNIKACE',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Certified Communication Practitioner',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení čtyřicetihodinového výcviku, praktického portfolia a dvou závěrečných výkonů podle standardu Elitea Academy.',
});

const CBT_COACHING_META = Object.freeze({
  id: 'kbt-koucink-v-praxi',
  slug: 'kbt-inspirovany-koucink',
  title: 'KBT-inspirovaný koučink v praxi',
  subtitle: 'Myšlenky, emoce, chování a bezpečný plán změny',
  badge: 'ELITEA CERTIFIED COGNITIVE COACHING PRACTITIONER',
  level: 'Profesní výcvik',
  durationHours: 40,
  accent: 'ink',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: ABC+ formulace, automatické myšlenky, přesvědčení, sokratovské otázky, behaviorální experimenty, 17 pracovních materiálů, simulace s Elitea a závěrečné portfolio.',
  coverNumber: '05',
  topicLabel: 'KBT KOUČINK',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
  certificateTitle: 'Elitea Certified Cognitive Coaching Practitioner',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřicetihodinového KBT-inspirovaného koučovacího výcviku a praktického portfolia. Nejde o zdravotnickou kvalifikaci, státní rekvalifikaci ani oprávnění poskytovat psychoterapii či diagnostiku.',
});

const ADHD_FOCUS_META = Object.freeze({
  id: 'adhd-focus-motivace',
  slug: 'adhd-soustredeni-a-motivace',
  title: 'ADHD: soustředění, motivace a exekutivní dovednosti',
  subtitle: 'Praktický systém pro práci, studium a ADHD-inspirovaný koučink',
  badge: 'ELITEA CERTIFIED ADHD-FOCUSED COACHING PRACTITIONER',
  level: 'Profesní výcvik',
  durationHours: 32,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: START analýza, vnější čas, prostředí, učení, pracovní paměť, focus bloky, 17 materiálů, 8 vedených audio praxí a simulace s Elitea.',
  coverNumber: '06',
  topicLabel: 'ADHD & FOCUS',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
  certificateTitle: 'Elitea Certified ADHD-Focused Coaching Practitioner',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního dvaatřicetihodinového ADHD-inspirovaného koučovacího výcviku, praktického portfolia a simulace. Nejde o zdravotnickou kvalifikaci ani oprávnění diagnostikovat ADHD, poskytovat psychoterapii či měnit léčbu.',
});

const BACH_FLOWER_META = Object.freeze({
  id: 'bachovy-kvetove-esence',
  slug: 'bachovy-kvetove-esence-bezpecna-praxe',
  title: 'Bachovy květové esence: tradice, rozlišování a bezpečná praxe',
  subtitle: 'Komplexní průvodce 38 esencemi, rozhovorem a etickým použitím',
  badge: 'ELITEA CERTIFIED BACH FLOWER-INFORMED PRACTITIONER',
  level: 'Profesní výcvik',
  durationHours: 40,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: všech 38 esencí, 19 rozlišovacích párů, bezpečný rozhovor, produktový a krizový rámec, 21 materiálů, 10 přesných audio praxí a simulace s Elitea.',
  coverNumber: '07',
  topicLabel: 'BACHOVY ESENCE',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
  certificateTitle: 'Elitea Certified Bach Flower-Informed Practitioner',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřicetihodinového výcviku v tradičním systému Bachových esencí, důkazně poctivé komunikaci a bezpečné neklinické praxi. Nejde o zdravotnickou, psychoterapeutickou, veterinární ani Bach Centre kvalifikaci a neopravňuje diagnostikovat, léčit nebo předepisovat.',
});

const LIFE_COACH_META = Object.freeze({
  id: 'profesionalni-life-coach',
  slug: 'profesionalni-life-coach-od-kontraktu-k-vysledku',
  title: 'Profesionální Life Coach: od kontraktu k výsledku',
  subtitle: 'Kompletní výcvik koučovacího řemesla, bezpečné praxe a udržitelné nabídky',
  badge: 'ELITEA CERTIFIED PROFESSIONAL LIFE COACH',
  level: 'Profesní výcvik', durationHours: 36, accent: 'bronze', instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: etika, kontrakt, naslouchání, otázky, cíle, GROW, HEART, NLP-inspirované experimenty, emoce, přesvědčení, změna, 19 materiálů, 10 audio praxí a závěrečná koučovací nabídka.',
  coverNumber: '08', topicLabel: 'LIFE COACHING',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
  certificateTitle: 'Elitea Certified Professional Life Coach', certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního šestatřicetihodinového profesního koučovacího výcviku, portfolia a závěrečných simulací. Nejde o zdravotnickou, psychoterapeutickou, státní ani ICF kvalifikaci.',
});

const WOMENS_CIRCLE_META = Object.freeze({
  id: 'facilitace-zenskych-kruhu',
  slug: 'facilitatorka-zenskych-kruhu-bezpeci-spojeni-ritual',
  title: 'Facilitátorka ženských kruhů: bezpečí, spojení a rituál',
  subtitle: 'Profesní výcvik skupinového prostoru od prvního kontraktu po udržitelný cyklus',
  badge: 'ELITEA CERTIFIED WOMEN\'S CIRCLE FACILITATOR',
  level: 'Profesní výcvik', durationHours: 40, accent: 'plum', instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: kontrakt, skupinové bezpečí, sdílení, rituál, souhlas, dech, tematické kruhy, meditace, 21 materiálů, 12 audio scénářů a závěrečný pilot.',
  coverNumber: '09', topicLabel: 'ŽENSKÉ KRUHY',
  categoryId: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id,
  categoryLabel: COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.label,
  certificateTitle: 'Elitea Certified Women\'s Circle Facilitator', certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřicetihodinového výcviku, bezpečnostní dokumentace, portfolia a závěrečné facilitátorské praxe. Nejde o zdravotnickou, psychoterapeutickou, krizovou, státní ani jinou regulovanou kvalifikaci.',
});

const COURSE_META_BY_FILE = Object.freeze({
  'course-neuroplasticita-practitioner.md': NEUROPLASTICITY_META,
  'course-pevna-v-sobe.md': SELF_TRUST_META,
  'course-spiritualni-koucink.md': SPIRITUAL_COACH_META,
  'course-komunikace-v-praxi.md': COMMUNICATION_META,
  'course-kbt-koucink-v-praxi.md': CBT_COACHING_META,
  'course-adhd-focus-motivace.md': ADHD_FOCUS_META,
  'course-bachovy-kvetove-esence.md': BACH_FLOWER_META,
  'course-profesionalni-life-coach.md': LIFE_COACH_META,
  'course-zenske-kruhy.md': WOMENS_CIRCLE_META,
});

export async function loadCourses(coursePaths) {
  const paths = Array.isArray(coursePaths) ? coursePaths : [coursePaths];
  return Promise.all(paths.map(async coursePath => {
    const markdown = await readFile(coursePath, 'utf8');
    return parseCourse(markdown, COURSE_META_BY_FILE[basename(coursePath)] || NEUROPLASTICITY_META);
  }));
}

export function parseCourse(markdown, meta = NEUROPLASTICITY_META) {
  const source = String(markdown || '').replace(/\r\n/g, '\n');
  const modules = splitModules(source).map((module, moduleIndex) => {
    const baseItems = splitItems(module.body, moduleIndex);
    return {
      id: `module-${moduleIndex}`,
      number: moduleIndex,
      title: module.title,
      shortTitle: module.title.replace(/^MODUL \d+ —\s*/i, '').replace(/^ÚVODNÍ PROFESNÍ MODUL —\s*/i, ''),
      items: meta.id === SELF_TRUST_META.id
        ? enrichSelfTrustStudy(baseItems, moduleIndex)
        : meta.id === LIFE_COACH_META.id
          ? enrichLifeCoachStudy(baseItems, moduleIndex)
          : meta.id === WOMENS_CIRCLE_META.id
            ? enrichWomensCircleStudy(baseItems, moduleIndex)
            : baseItems,
    };
  });

  const itemCount = modules.reduce((sum, module) => sum + module.items.length, 0);
  return {
    ...meta,
    trainer: publicCourseTrainerProfile(meta.id),
    modules,
    moduleCount: modules.length,
    itemCount,
    certificate: meta.certificate === false ? null : {
      title: meta.certificateTitle || 'Elitea Certified Practitioner',
      issuedBy: 'Nia Dobyšar',
      thresholdPercent: meta.certificateThresholdPercent || 100,
      note: meta.certificateNote || 'Certifikát o úspěšném absolvování kvalifikačního programu; nejde o osvědčení o státní rekvalifikaci.',
    },
  };
}

export function courseSummary(course) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    badge: course.badge,
    level: course.level,
    durationHours: course.durationHours,
    instructor: course.instructor,
    description: course.description,
    coverNumber: course.coverNumber,
    topicLabel: course.topicLabel,
    categoryId: course.categoryId,
    categoryLabel: course.categoryLabel,
    trainer: course.trainer,
    moduleCount: course.moduleCount,
    itemCount: course.itemCount,
    materialCount: course.materials?.length || 0,
    mastery: course.mastery?.summary || null,
    certificate: course.certificate,
  };
}

function splitModules(markdown) {
  const lines = markdown.split('\n');
  const starts = [];
  lines.forEach((line, index) => {
    if (/^# (ÚVODNÍ PROFESNÍ MODUL|MODUL \d+|ZÁVĚREČNÉ PRAKTIKUM|CERTIFIKAČNÍ ZKOUŠKA)/.test(line)) {
      starts.push({ index, title: line.replace(/^#\s+/, '').trim() });
    }
  });

  return starts.map((start, index) => {
    const end = starts[index + 1]?.index ?? findCourseEnd(lines, start.index + 1);
    return { title: start.title, body: lines.slice(start.index + 1, end).join('\n').trim() };
  });
}

function findCourseEnd(lines, fromIndex) {
  for (let index = fromIndex; index < lines.length; index += 1) {
    if (/^# (ZÁVĚREČNÉ VYHODNOCENÍ|KLÍČ K TESTŮM|INTERNÍ POZNÁMKA)/.test(lines[index])) return index;
  }
  return lines.length;
}

function splitItems(body, moduleIndex) {
  const lines = body.split('\n');
  const starts = [];
  lines.forEach((line, index) => {
    if (/^## Lekce /.test(line) || /^### Praktická laboratoř /.test(line) || /^### Profesní aplikace /.test(line) || /^## Test modulu /.test(line)) {
      starts.push({ index, title: line.replace(/^#{2,3}\s+/, '').trim(), kind: itemKind(line) });
    }
  });

  if (!starts.length) {
    return body ? [{ id: `m${moduleIndex}-intro`, title: 'Profesní rámec a praxe', kind: 'practice', minutes: 20, markdown: body }] : [];
  }

  const leading = lines.slice(0, starts[0].index).join('\n').trim();
  const items = starts.map((start, index) => {
    const end = starts[index + 1]?.index ?? lines.length;
    const rawMarkdown = lines.slice(start.index + 1, end).join('\n').trim();
    const durationMatch = rawMarkdown.match(/^<!--\s*minutes:\s*(\d+)\s*-->\s*/i);
    const withoutDuration = durationMatch ? rawMarkdown.slice(durationMatch[0].length).trim() : rawMarkdown;
    const experience = extractCourseVisual(withoutDuration);
    return {
      id: `m${moduleIndex}-${index + 1}`,
      title: start.title,
      kind: start.kind,
      minutes: durationMatch ? Number(durationMatch[1]) : itemMinutes(start.kind),
      markdown: experience.markdown,
      visual: experience.visual,
    };
  });
  if (leading) items.unshift({ id: `m${moduleIndex}-overview`, title: 'Výsledek a přehled modulu', kind: 'overview', minutes: 4, markdown: leading });
  return items;
}

function itemKind(line) {
  if (line.startsWith('## Lekce')) return 'lesson';
  if (line.startsWith('### Praktická laboratoř')) return 'self-practice';
  if (line.startsWith('### Profesní aplikace')) return 'client-practice';
  if (line.startsWith('## Test modulu')) return 'quiz';
  return 'lesson';
}

function itemMinutes(kind) {
  return {
    overview: 4,
    lesson: 10,
    'self-practice': 20,
    'client-practice': 25,
    quiz: 12,
    practice: 20,
  }[kind] || 10;
}
