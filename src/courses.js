import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { enrichSelfTrustStudy } from './self-trust-study.js';
import { enrichLifeCoachStudy } from './life-coach-study.js';
import { enrichWomensCircleStudy } from './womens-circle-study.js';
import { publicCourseTrainerProfile } from './course-trainer-profiles.js';
import { extractCourseVisual } from './course-visuals.js';
import { courseDepthSummary, enrichCourseStudyDepth } from './course-study-depth.js';

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

const ENTREPRENEURSHIP_META = Object.freeze({
  id: 'podnikani-od-napadu-k-rustu',
  slug: 'podnikani-od-napadu-k-rustu',
  title: 'Podnikání od nápadu k růstu',
  subtitle: 'Strategický masterclass pro ověření, spuštění, řízení a škálování zdravého byznysu',
  badge: 'ELITEA BUSINESS MASTERY',
  level: 'Podnikatelský masterclass',
  durationHours: 32,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Rozšířený textový a interaktivní masterclass: 16 modulů, 96 částí, zákaznický výzkum, validace, positioning, nabídka, značka, marketing, prodej, finance, provoz, leadership, škálování, 17 pracovních materiálů a 10 audio briefingů.',
  coverNumber: '10',
  topicLabel: 'BUSINESS MASTERY',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Business Mastery — Podnikání od nápadu k růstu',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního dvaatřicetihodinového podnikatelského programu, praktického portfolia a závěrečné obhajoby. Nejde o státní kvalifikaci ani právní, účetní, daňové či investiční oprávnění a negarantuje podnikatelský výsledek.',
});

const PART_TIME_BUSINESS_META = Object.freeze({
  id: 'vedlejsi-byznys-pri-zamestnani',
  slug: 'vedlejsi-byznys-pri-zamestnani',
  title: 'Vedlejší byznys při zaměstnání',
  subtitle: 'Od bezpečného experimentu k první klientce a rozhodnutí o další etapě',
  badge: 'ELITEA SIDE BUSINESS LAB',
  level: 'Praktický podnikatelský program',
  durationHours: 24,
  accent: 'ink',
  instructor: 'Nia Dobyšar',
  description: 'Praktický textový a interaktivní program: 12 modulů, 72 částí, reálná kapacita, finanční bezpečí, výběr nápadu, validace, mini nabídka, první prodej, klientské doručení, střet zájmů, 33 pracovních materiálů a 10 audio briefingů.',
  coverNumber: '11',
  topicLabel: 'SIDE BUSINESS',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Side Business Lab — Vedlejší byznys při zaměstnání',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřiadvacetihodinového programu, praktických výstupů a závěrečné obhajoby. Nejde o státní kvalifikaci ani právní, účetní, daňové, investiční či pracovněprávní stanovisko a negarantuje příjem ani možnost odejít ze zaměstnání.',
});

const AI_AGENTS_META = Object.freeze({
  id: 'ai-agenti-a-automatizace',
  slug: 'ai-agenti-a-automatizace-v-praxi',
  title: 'AI agenti a automatizace v praxi',
  subtitle: 'Od kvalitního zadání po bezpečný produkční AI systém',
  badge: 'ELITEA AI AUTOMATION MASTERY',
  level: 'Praktický AI výcvik',
  durationHours: 28,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 14 modulů, 84 částí, prompting a kontext, Cowork, dovednosti, pluginy, MCP a konektory, data, dokumenty, AI coding, agentní architektura, týmy, osobní AI systém, produkční automatizace, 28 pracovních materiálů a 10 přesných audio briefingů.',
  coverNumber: '12',
  topicLabel: 'AI & AUTOMATION',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea AI Automation Mastery — AI agenti a automatizace v praxi',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního osmadvacetihodinového praktického výcviku, portfolia workflow a závěrečné produkční obhajoby. Nejde o certifikaci společnosti Anthropic, OpenAI, Microsoft ani jiné technologické společnosti a negarantuje bezpečnost, shodu s právem ani obchodní výsledek konkrétního nasazení.',
});

const STARTUP_IDEA_META = Object.freeze({
  id: 'napad-k-overene-prilezitosti',
  slug: 'od-napadu-k-overene-prilezitosti',
  title: 'Od nápadu k ověřené příležitosti',
  subtitle: 'Customer discovery, validace a první tržní důkaz s podporou AI',
  badge: 'ELITEA STARTUP VALIDATION LAB',
  level: 'Praktický validační výcvik',
  durationHours: 28,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 14 modulů, 84 částí, systematická ideace, problem–solution fit, zákaznické rozhovory, konkurence, market sizing, ekonomika, Lean Canvas, experimenty, landing page, cenový test, prototyp, MVP, GTM, B2B pilot, 28 pracovních materiálů a 10 audio briefingů.',
  coverNumber: '13',
  topicLabel: 'STARTUP VALIDATION',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Startup Validation Lab — Od nápadu k ověřené příležitosti',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního osmadvacetihodinového validačního výcviku, evidence roomu a závěrečné obhajoby. Nejde o státní kvalifikaci ani právní, účetní, daňové či investiční doporučení, negarantuje životaschopnost nápadu, financování ani podnikatelský výsledek.',
});

const BUSINESS_DEVELOPMENT_META = Object.freeze({
  id: 'strategicka-partnerstvi-business-development',
  slug: 'strategicka-partnerstvi-a-business-development',
  title: 'Strategická partnerství a Business Development',
  subtitle: 'Od partnerské teze k vyjednané, řízené a měřitelné spolupráci',
  badge: 'ELITEA BUSINESS DEVELOPMENT MASTERY',
  level: 'Profesní byznysový výcvik',
  durationHours: 28,
  accent: 'ink',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 14 modulů, 84 částí, partnerská strategie, ekosystém, relationship capital, research a outreach, discovery, společný business case, deal design, vyjednávání, due diligence, pilot, governance, QBR, bezpečná AI automatizace, 28 pracovních materiálů a 10 přesných audio briefingů.',
  coverNumber: '14',
  topicLabel: 'BUSINESS DEVELOPMENT',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Business Development Mastery — Strategická partnerství',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního osmadvacetihodinového profesního výcviku, partnerského evidence roomu a závěrečné obhajoby. Nejde o státní kvalifikaci ani právní, účetní, daňové, bezpečnostní či investiční stanovisko a negarantuje uzavření dohody ani obchodní výsledek.',
});

const GENERATIVE_AI_MARKETING_META = Object.freeze({
  id: 'generativni-ai-pro-marketing-a-byznys',
  slug: 'generativni-ai-pro-marketing-tvorbu-a-byznys',
  title: 'Generativní AI pro marketing, tvorbu a byznys',
  subtitle: 'Od kvalitního zadání přes multimodální produkci k bezpečnému pracovnímu systému',
  badge: 'ELITEA GENERATIVE AI MASTERY',
  level: 'Komplexní profesní AI výcvik',
  durationHours: 42,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 14 modulů, 84 částí, AI gramotnost, prompt design, research, dokumenty, data, vlastní asistenti, automatizace, provozní piloty, content a SEO, generovaný obraz, video, hlas, podcast, AI coding, governance, 28 pracovních materiálů a 12 přesných audio briefingů.',
  coverNumber: '15',
  topicLabel: 'GENERATIVE AI',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Generative AI Mastery — Marketing, tvorba a byznys',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního dvaačtyřicetihodinového praktického výcviku, multimodálního portfolia a závěrečné obhajoby. Nejde o certifikaci OpenAI, Anthropic, Google, Microsoft, Adobe ani jiné technologické společnosti, nenahrazuje právní, bezpečnostní, finanční či jinou regulovanou kvalifikaci a negarantuje úsporu, příjem ani bezchybnost AI systému.',
});

const SOCIAL_MEDIA_MANAGEMENT_META = Object.freeze({
  id: 'social-media-management-strategie-a-rust',
  slug: 'social-media-management-strategie-obsah-a-rust',
  title: 'Social Media Management: strategie, obsah a růst',
  subtitle: 'Od klientského briefu přes produkci a komunitu k měřitelnému systému',
  badge: 'ELITEA SOCIAL MEDIA MANAGEMENT MASTERY',
  level: 'Komplexní profesní marketingový výcvik',
  durationHours: 32,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 16 modulů, 96 částí, klientský onboarding, značka, audit, strategie, content system, copy, Canva a vizuální produkce, video, platformní playbooky, komunita, influence, krize, paid social, workflow, AI, analytika, 32 pracovních materiálů a 12 přesných audio briefingů.',
  coverNumber: '16',
  topicLabel: 'SOCIAL MEDIA MANAGEMENT',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Social Media Management Mastery — Strategie, obsah a růst',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního dvaatřicetihodinového profesního výcviku, praktického portfolia a závěrečné klientské obhajoby. Nejde o certifikaci Meta, TikTok, Google, YouTube, LinkedIn, Pinterest, X, Canva ani jiné platformy, nenahrazuje právní, datové či reklamní posouzení a negarantuje dosah, viralitu, prodej ani obchodní výsledek.',
});

const CANVA_CONTENT_DESIGN_META = Object.freeze({
  id: 'canva-content-design-studio',
  slug: 'canva-content-design-studio',
  title: 'Canva Content Design Studio',
  subtitle: 'Od designových principů k profesionální grafice, videu a předatelnému systému',
  badge: 'ELITEA CANVA CONTENT DESIGN STUDIO',
  level: 'Komplexní profesní designový výcvik',
  durationHours: 30,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 15 modulů, 90 částí, designové myšlení, barva, typografie, kompozice, licence, Canva workflow, brand kit, šablony, statická grafika, carousely, video, pokročilé animace, multi-channel adaptace, e-booky, prezentace, tisk, web, AI, prodej šablon, 30 pracovních materiálů a 12 přesných audio briefingů.',
  coverNumber: '17',
  topicLabel: 'CANVA & CONTENT DESIGN',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Canva Content Design Studio — Profesní vizuální produkce',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního třicetihodinového designového výcviku, produkčního portfolia a závěrečné creative review. Nejde o certifikaci Canva ani jiné technologické společnosti, nenahrazuje právní posouzení licencí, autorských práv či ochranných známek a negarantuje dosah, konverze, prodej ani obchodní výsledek.',
});

const CANVA_AI_BUSINESS_SYSTEMS_META = Object.freeze({
  id: 'canva-ai-business-systems-lab',
  slug: 'canva-ai-business-systems-lab',
  title: 'Canva AI & Business Systems Lab',
  subtitle: 'Od Canva AI a datové produkce k řízenému brandovému operačnímu systému',
  badge: 'ELITEA CANVA AI & BUSINESS SYSTEMS LAB',
  level: 'Pokročilý profesní Canva AI výcvik',
  durationHours: 40,
  accent: 'mint',
  instructor: 'Nia Dobyšar',
  description: 'Pokročilý textový a interaktivní výcvik: 20 modulů, 120 částí, Canva workspace, AI pracovní kontrakty, generovaný obraz, odpovědná editace, brand strategy a governance, sociální systémy, Sheets, Bulk Create, Docs, Whiteboards, prezentace, AI video, střih, Canva Code, weby, Apps, týmový provoz, release a incidenty, 40 pracovních materiálů a 12 přesných audio vedení.',
  coverNumber: '18',
  topicLabel: 'CANVA AI & BUSINESS SYSTEMS',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Canva AI & Business Systems Lab — Brandový operační systém',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřicetihodinového profesního výcviku, praktického systému a závěrečné obhajoby. Nejde o certifikaci ani autorizaci Canva či jiné technologické společnosti, nenahrazuje právní, bezpečnostní, datové, přístupnostní ani vývojářské posouzení a negarantuje úsporu, dosah, konverze, příjem ani obchodní výsledek.',
});

const CONTENT_MARKETING_EDITORIAL_META = Object.freeze({
  id: 'content-marketing-editorial-growth-system',
  slug: 'content-marketing-editorial-growth-system',
  title: 'Content Marketing: Editorial Growth System',
  subtitle: 'Od audience evidence a strategie k důvěryhodnému obsahu, distribuci a růstu',
  badge: 'ELITEA CONTENT MARKETING MASTERY',
  level: 'Komplexní profesní content marketing výcvik',
  durationHours: 36,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 18 modulů, 108 částí, marketingové základy, nákupní cesta, audience research, content strategy, storytelling, web, ideace, editorial trust, copywriting, obsahové typy, originální výzkum, repurposing, SEO, distribuce, e-mail, multichannel, AI content operations, měření, 36 pracovních materiálů a 12 přesných audio vedení.',
  coverNumber: '19',
  topicLabel: 'CONTENT MARKETING',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Content Marketing Mastery — Editorial Growth System',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního šestatřicetihodinového profesního výcviku, obsahového systému a závěrečné obhajoby. Nejde o státní kvalifikaci ani certifikaci Google, Meta, Canva, e-mailové či jiné platformy, nenahrazuje právní, datové, SEO nebo odborné posouzení a negarantuje ranking, dosah, konverze, prodej ani obchodní výsledek.',
});

const AI_CONTENT_PRODUCTION_META = Object.freeze({
  id: 'ai-content-production-studio',
  slug: 'ai-content-production-studio',
  title: 'AI Content Production Studio',
  subtitle: 'Od brand voice a prompt systému k 28denní multimodální produkci a řízenému release',
  badge: 'ELITEA AI CONTENT PRODUCTION STUDIO',
  level: 'Praktický profesní AI content výcvik',
  durationHours: 24,
  accent: 'mint',
  instructor: 'Nia Dobyšar',
  description: 'Praktický textový a interaktivní výcvik: 12 modulů, 72 částí, AI content charter, brand voice dataset, prompt systém a evaly, audience evidence, 28denní sprint, captions, hooks, CTA, blog SEO, AI grafika, produktová fotografie, carousely, infografiky, short i long-form video, batching, kalendář, repurposing, scheduling, automatizace, analytika, AI search visibility, 24 pracovních materiálů a 10 přesných audio vedení.',
  coverNumber: '20',
  topicLabel: 'AI CONTENT PRODUCTION',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea AI Content Production Studio — Multimodální obsahový systém',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřiadvacetihodinového profesního výcviku, praktického produkčního systému a závěrečné obhajoby. Nejde o certifikaci OpenAI, Canva, Meta, Google ani jiné technologické společnosti, nenahrazuje právní, licenční, datové, SEO nebo odborné posouzení a negarantuje viralitu, ranking, úsporu, dosah, konverze, prodej ani obchodní výsledek.',
});

const VISUAL_CONTENT_STRATEGY_META = Object.freeze({
  id: 'visual-content-strategy-campaign-lab',
  slug: 'visual-content-strategy-campaign-lab',
  title: 'Visual Content Strategy & Campaign Lab',
  subtitle: 'Od audience evidence a brand codes k pravdivé vizuální kampani, distribuci a creative learning',
  badge: 'ELITEA VISUAL CONTENT STRATEGY LAB',
  level: 'Komplexní profesní visual content marketing výcvik',
  durationHours: 28,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 14 modulů, 84 částí, visual content charter, cíle a baseline, audience evidence, decision jobs, distinctive brand codes, barva, typografie, hierarchie, format portfolio, produktové a lifestyle vizuály, UGC, testimonial, case study, data, infografiky, meme formáty, explainer a how-to video, etické hooky, platformní distribuce, business-model campaign strategy, creative testing, asset governance, 28 pracovních materiálů a 10 přesných audio vedení.',
  coverNumber: '21',
  topicLabel: 'VISUAL CONTENT STRATEGY',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Visual Content Strategy & Campaign Lab — Profesní vizuální kampaň',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního osmadvacetihodinového profesního výcviku, praktického campaign systemu a závěrečné obhajoby. Nejde o státní kvalifikaci ani certifikaci Canva, Meta, Google, TikTok, Adobe či jiné platformy, nenahrazuje právní, licenční, datové, přístupnostní nebo odborné posouzení a negarantuje viralitu, dosah, engagement, konverze, prodej ani obchodní výsledek.',
});

const FOUNDER_PRODUCTIVITY_META = Object.freeze({
  id: 'founder-productivity-execution-os',
  slug: 'founder-productivity-execution-os',
  title: 'Founder Productivity & Execution OS',
  subtitle: 'Od attention auditu a priorit k udržitelnému osobnímu i týmovému provedení',
  badge: 'ELITEA FOUNDER PRODUCTIVITY & EXECUTION OS',
  level: 'Komplexní profesní productivity a execution výcvik',
  durationHours: 40,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 20 modulů, 120 částí, produktivita jako pracovní systém, attention audit, digitální tření, CEO a operator time, kapacita, priority, cíle, kalendář, timeboxing, task systém, deep work, prokrastinační tření, motivace, návyky, udržitelný workload, rozhodování, logika, kreativita, učení, workspace, e-mail, schůzky, delegování, týmová zpětná vazba, SOP, automatizace, AI productivity, execution dashboard, 40 pracovních materiálů a 12 přesných audio vedení.',
  coverNumber: '22',
  topicLabel: 'FOUNDER PRODUCTIVITY & EXECUTION',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Founder Productivity & Execution OS — Profesní systém provedení',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřicetihodinového profesního výcviku, praktického execution systému a závěrečné obhajoby. Nejde o státní kvalifikaci ani externí profesní certifikaci, nenahrazuje zdravotní, psychologické, pracovněprávní, právní nebo jiné odborné posouzení a negarantuje výkon, produktivitu, úsporu času, příjem, zisk ani obchodní výsledek.',
});

const CAPCUT_SHORT_FORM_META = Object.freeze({
  id: 'capcut-short-form-video-studio',
  slug: 'capcut-short-form-video-studio',
  title: 'CapCut Desktop + Mobile + AI Video Studio',
  subtitle: 'Od bezpečného projektu a střihové logiky k cross-device, AI-ready a předatelnému short-form videu',
  badge: 'ELITEA CAPCUT DESKTOP + MOBILE + AI STUDIO',
  level: 'Komplexní profesní short-form video editing výcvik',
  durationHours: 40,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 20 modulů, 120 částí, CapCut desktop a mobile workspace, settings, source pack a práva, short-form story, etické hooky, beat sheet, ingest, sync, recovery, timeline, trim, split, J/L cuts, vertical reframing, dialog, hudba, SFX, B-roll, overlays, masky, keyframes, easing, speed design, animace, transitions, effects, auto-captions, typography, přístupnost, color match, produktová věrnost, retence, batching, týmový review, export, compression, post-upload QA, cross-device parity, troubleshooting, templates, stock governance, AI captions a text-to-video workflow, provenance, evaly, creative testing, campaign capstone, 40 pracovních materiálů a 14 přesných audio vedení.',
  coverNumber: '23',
  topicLabel: 'SHORT-FORM VIDEO EDITING',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea CapCut Desktop + Mobile + AI Video Studio — Profesní video produkce',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřicetihodinového profesního výcviku, praktického desktopového, mobilního a AI video systému a závěrečné obhajoby. Nejde o certifikaci CapCut, ByteDance, TikTok, Meta, Instagram, YouTube, Google ani jiné platformy, nenahrazuje právní, licenční, datové, přístupnostní nebo odborné posouzení a negarantuje viralitu, dosah, retenci, engagement, konverze, prodej ani obchodní výsledek.',
});

const CONTENT_CREATOR_PERSONAL_BRAND_META = Object.freeze({
  id: 'content-creator-personal-brand-studio',
  slug: 'content-creator-personal-brand-studio',
  title: 'Content Creator & Personal Brand Studio',
  subtitle: 'Od niche, osobní značky a kamerového projevu k publikačnímu, analytickému a obchodnímu creator systému',
  badge: 'ELITEA CONTENT CREATOR & PERSONAL BRAND STUDIO',
  level: 'Komplexní profesní creator výcvik',
  durationHours: 36,
  accent: 'mint',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 18 modulů, 108 částí, creator charter, niche a audience evidence, positioning, UVP, osobní značka, platformní portfolio YouTube, Instagram a TikTok, content pillars, ideace a AI, editorial calendar, gear a TCO, domácí studio, světlo, smartphone a camera capture, zvuk, kamerový projev, storytelling, hook a payoff, long-form, short-form série, editor a CapCut handoff, thumbnail a Canva packaging, přístupnost, publikace, community care, analytika, experimenty, creator business, partnerství, 36 pracovních materiálů a 12 přesných audio vedení.',
  coverNumber: '24',
  topicLabel: 'CONTENT CREATOR & PERSONAL BRAND',
  categoryId: COURSE_CATEGORIES.MARKETING.id,
  categoryLabel: COURSE_CATEGORIES.MARKETING.label,
  certificateTitle: 'Elitea Content Creator & Personal Brand Studio — Profesní creator systém',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního šestatřicetihodinového profesního výcviku, praktického creator systému a závěrečné obhajoby. Nejde o certifikaci YouTube, Google, Instagram, Meta, TikTok, CapCut, Canva ani jiné platformy, nenahrazuje právní, licenční, daňové, účetní, zdravotní či jiné odborné posouzení a negarantuje viralitu, dosah, retenci, počet sledujících, partnerství, příjem, prodej ani obchodní výsledek.',
});

const STRATEGIC_THINKING_META = Object.freeze({
  id: 'strategic-thinking-decision-lab',
  slug: 'strategicke-mysleni-a-rozhodovani',
  title: 'Strategické myšlení & Decision-Making Lab',
  subtitle: 'Od důkazní diagnózy přes scénáře a portfolia k auditovatelnému rozhodnutí',
  badge: 'ELITEA STRATEGY MASTERY',
  level: 'Profesní strategický výcvik',
  durationHours: 24,
  accent: 'plum',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 12 modulů, 72 částí, SWOT/TOWS, PESTLE, scénáře, Porter, value chain, VRIO, business model, Ansoff, portfolia, Three Horizons, Blue Ocean, decision memo, OKR, 24 pracovních nástrojů a 8 audio vedení.',
  coverNumber: '25',
  topicLabel: 'STRATEGY & DECISIONS',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Strategy Mastery — Strategické myšlení a rozhodování',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřiadvacetihodinového strategického výcviku a evidence roomu. Nejde o státní kvalifikaci ani právní, finanční, daňové či investiční poradenství a negarantuje obchodní výsledek.',
});

const WORKFLOW_PRODUCTIVITY_META = Object.freeze({
  id: 'workflow-productivity-toolkit',
  slug: 'workflow-a-productivity-toolkit',
  title: 'Workflow & Productivity Toolkit',
  subtitle: 'GTD, priority, Pomodoro, Flowtime, timeboxing, Kanban a osobní pracovní systém',
  badge: 'ELITEA WORKFLOW MASTERY',
  level: 'Praktický workflow výcvik',
  durationHours: 24,
  accent: 'ink',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 12 modulů, 72 částí, GTD, Eisenhower, Pareto, ABC, MoSCoW, Pomodoro, Flowtime, time blocking, Kanban, WIP, batching, tření, návyky, deep work, adaptivní plán, 24 pracovních nástrojů a 8 audio vedení.',
  coverNumber: '26',
  topicLabel: 'WORKFLOW TOOLKIT',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Workflow Mastery — Workflow & Productivity Toolkit',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřiadvacetihodinového workflow výcviku a praktického portfolia. Nejde o zdravotní, psychologickou ani jinou regulovanou kvalifikaci a negarantuje výkon, úsporu času, příjem ani obchodní výsledek.',
});

const PROJECT_OPERATIONS_META = Object.freeze({
  id: 'project-workflow-operations-management',
  slug: 'project-workflow-operations-management',
  title: 'Project, Workflow & Operations Management',
  subtitle: 'Od charteru a flow přes kvalitu a rizika k bezpečnému release a provozu',
  badge: 'ELITEA PROJECT & OPERATIONS MASTERY',
  level: 'Profesní projektový výcvik',
  durationHours: 24,
  accent: 'bronze',
  instructor: 'Nia Dobyšar',
  description: 'Komplexní textový a interaktivní výcvik: 12 modulů, 72 částí, charter, stakeholdery, RACI, scope, WBS, waterfall, agile, hybrid, Scrum, Kanban, kritická cesta, RAID, SOP, QA/QC, kapacita, náklady, dodavatelé, release, handoff, 24 pracovních nástrojů a 8 audio vedení.',
  coverNumber: '27',
  topicLabel: 'PROJECT & OPERATIONS',
  categoryId: COURSE_CATEGORIES.BUSINESS_STRATEGY.id,
  categoryLabel: COURSE_CATEGORIES.BUSINESS_STRATEGY.label,
  certificateTitle: 'Elitea Project & Operations Mastery',
  certificateThresholdPercent: 100,
  certificateNote: 'Certifikát potvrzuje dokončení interního čtyřiadvacetihodinového projektového a provozního výcviku. Nejde o státní, právní, bezpečnostní, účetní ani jinou oborovou kvalifikaci a negarantuje termín, rozpočet ani obchodní výsledek.',
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
  'course-podnikani-od-napadu-k-rustu.md': ENTREPRENEURSHIP_META,
  'course-vedlejsi-byznys-pri-zamestnani.md': PART_TIME_BUSINESS_META,
  'course-ai-agenti-a-automatizace.md': AI_AGENTS_META,
  'course-napad-k-overene-prilezitosti.md': STARTUP_IDEA_META,
  'course-strategicka-partnerstvi-business-development.md': BUSINESS_DEVELOPMENT_META,
  'course-generativni-ai-pro-marketing-a-byznys.md': GENERATIVE_AI_MARKETING_META,
  'course-social-media-management-strategie-a-rust.md': SOCIAL_MEDIA_MANAGEMENT_META,
  'course-canva-content-design-studio.md': CANVA_CONTENT_DESIGN_META,
  'course-canva-ai-business-systems-lab.md': CANVA_AI_BUSINESS_SYSTEMS_META,
  'course-content-marketing-editorial-growth-system.md': CONTENT_MARKETING_EDITORIAL_META,
  'course-ai-content-production-studio.md': AI_CONTENT_PRODUCTION_META,
  'course-visual-content-strategy-campaign-lab.md': VISUAL_CONTENT_STRATEGY_META,
  'course-founder-productivity-execution-os.md': FOUNDER_PRODUCTIVITY_META,
  'course-capcut-short-form-video-studio.md': CAPCUT_SHORT_FORM_META,
  'course-content-creator-personal-brand-studio.md': CONTENT_CREATOR_PERSONAL_BRAND_META,
  'course-strategic-thinking-decision-lab.md': STRATEGIC_THINKING_META,
  'course-workflow-productivity-toolkit.md': WORKFLOW_PRODUCTIVITY_META,
  'course-project-workflow-operations-management.md': PROJECT_OPERATIONS_META,
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
  const sourceModules = splitModules(source);
  const modules = sourceModules.map((module, moduleIndex) => {
    const baseItems = splitItems(module.body, moduleIndex);
    const specializedItems = meta.id === SELF_TRUST_META.id
      ? enrichSelfTrustStudy(baseItems, moduleIndex)
      : meta.id === LIFE_COACH_META.id
        ? enrichLifeCoachStudy(baseItems, moduleIndex)
        : meta.id === WOMENS_CIRCLE_META.id
          ? enrichWomensCircleStudy(baseItems, moduleIndex)
          : baseItems;
    return {
      id: `module-${moduleIndex}`,
      number: moduleIndex,
      title: module.title,
      shortTitle: module.title.replace(/^MODUL \d+ —\s*/i, '').replace(/^ÚVODNÍ PROFESNÍ MODUL —\s*/i, ''),
      items: enrichCourseStudyDepth(specializedItems, {
        courseId: meta.id,
        courseTitle: meta.title,
        moduleIndex,
        moduleCount: sourceModules.length,
        moduleTitle: module.title,
      }),
    };
  });

  const itemCount = modules.reduce((sum, module) => sum + module.items.length, 0);
  return {
    ...meta,
    trainer: publicCourseTrainerProfile(meta.id),
    modules,
    moduleCount: modules.length,
    itemCount,
    depth: courseDepthSummary(modules),
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
    depth: course.depth,
    materialCount: publicCourseMaterials(course.materials).length,
    mastery: course.mastery?.summary || null,
    certificate: course.certificate,
  };
}

export function isInternalCourseMaterial(material = {}) {
  const id = String(material.id || '').toLocaleLowerCase('cs');
  const title = String(material.title || '').toLocaleLowerCase('cs');
  return /(?:^|-)audio(?:-production)?-pack$/.test(id)
    || /audio\s+(?:k\s+nahrání|produkce|produkční balíček)/i.test(title);
}

export function publicCourseMaterials(materials = []) {
  return Array.isArray(materials) ? materials.filter(material => !isInternalCourseMaterial(material)) : [];
}

export function publicCourseDetail(course) {
  return {
    ...course,
    materials: publicCourseMaterials(course?.materials),
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
