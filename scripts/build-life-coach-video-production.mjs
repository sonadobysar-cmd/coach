import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "data/course-profesionalni-life-coach.md");
const outputDir = path.join(root, "production/life-coach-video-course");
const source = fs.readFileSync(sourcePath, "utf8");

const concepts = [
  {
    title: "Kde koučink začíná a kde musí skončit",
    hook: "Klientka žádá techniku na trauma a zároveň říká, že ví, že nejsi terapeutka.",
    promise: "Rozlišit roli, označit její změnu a bezpečně předat zakázku mimo kompetenci.",
    mistake: "Dobře míněná technika nahradí bezpečnostní rozhodnutí.",
    demo: "Rozvojové téma postupně přejde k nespavosti, panice, lékům a výroku o bezpečí.",
    overlay: "Proces ≠ garantovaný výsledek",
  },
  {
    title: "Největší slepé místo jsi někdy ty",
    hook: "Dvě klientky udělají totéž. Jednu omluvíš a druhou označíš za nezodpovědnou.",
    promise: "Zachytit vlastní bias, projekci, záchranářství a konflikt zájmů dříve, než změní vedení.",
    mistake: "Koučka vydává svůj první dojem za empatii nebo intuici.",
    demo: "Dvě klientky se stejným chováním, ale jiným statusem a stylem projevu.",
    overlay: "Hypotéza není pravda",
  },
  {
    title: "Kontrakt, který drží celé sezení",
    hook: "Ve třicáté minutě klientka otevře úplně jiné téma a koučka automaticky pokračuje.",
    promise: "Uzavřít vztahovou dohodu, mini-kontrakt sezení a znovu vyjednat změnu směru.",
    mistake: "Úvodní formulář se považuje za souhlas se vším, co později zazní.",
    demo: "Kariérní zakázka se změní ve zdravotní a vztahové téma.",
    overlay: "Zakázka je živá dohoda",
  },
  {
    title: "Poslech, při kterém si nic nedomýšlíš",
    hook: "Klientka řekne: ‚Ne, takhle jsem to nemyslela.‘ Co uděláš s vlastní potřebou mít pravdu?",
    promise: "Poslouchat fakta, význam, emoci a jednání a parafrázi vždy nabídnout k opravě.",
    mistake: "Chytré shrnutí přidá příčinu, kterou klientka nikdy neřekla.",
    demo: "Modelová klientka osmkrát opraví část parafráze.",
    overlay: "Význam patří klientce",
  },
  {
    title: "Otázka, která otevírá — nevede",
    hook: "‚Nemyslíš, že bys měla začít delegovat?‘ zní jako otázka, ale je to rada.",
    promise: "Položit jednu otázku s jedním účelem a regulovat hloubku se souhlasem.",
    mistake: "Koučka pokládá připravené hluboké otázky bez návaznosti na poslední odpověď.",
    demo: "Elitea odpovídá jinak, než skript očekává, a nutí koučku opravdu poslouchat.",
    overlay: "Jedna otázka · jedno jádro",
  },
  {
    title: "Od přání k cíli v klientčině vlivu",
    hook: "‚Chci, aby se partner změnil.‘ To je pochopitelné přání, ale zatím ne koučovatelný cíl.",
    promise: "Oddělit přání, výsledek, systém a první testovatelný experiment.",
    mistake: "Chování se vydává za garantovaný výsledek nebo se každá překážka označí za mindset.",
    demo: "Klientka chce změnu partnera, týmu nebo publika.",
    overlay: "Výsledek · systém · experiment",
  },
  {
    title: "Accountability bez dozoru a studu",
    hook: "Klientka nejprve chce denní kontrolu. O týden později se bojí otevřít tvoji zprávu.",
    promise: "Nastavit odpovědnost jako návrat k volbě a používat výpadek jako data.",
    mistake: "Reportování se změní v poslušnost vůči koučce.",
    demo: "Denní kontrola začne klientku dusit a zvyšovat stud.",
    overlay: "Výpadek je informace",
  },
  {
    title: "GROW, HEART a Kolo života bez mechaniky",
    hook: "Klientka řekne: ‚Tahle otázka mi nesedí.‘ Profesionální reakce není dokončit formulář.",
    promise: "Použít rámec jako mapu, poznat jeho limit a bez obrany jej odložit.",
    mistake: "Model určuje rozhovor místo klientčiny zakázky.",
    demo: "Elitea třikrát odmítne otázku připraveného rámce.",
    overlay: "Model slouží rozhovoru",
  },
  {
    title: "Dokumentace, která chrání klientku i praxi",
    hook: "Sponzor platí koučink a chce vědět všechno. Platba ale nekupuje obsah sezení.",
    promise: "Sbírat minimum, oddělit fakt od hypotézy a předem vyjednat reporting i AI.",
    mistake: "Citlivá data se ukládají pro jistotu a souhlas se doplňuje zpětně.",
    demo: "HR sponzor požádá o celý obsah individuálního sezení.",
    overlay: "Sbírej jen to, co potřebuješ",
  },
  {
    title: "NLP bez magie a léčebných slibů",
    hook: "Technika nic nezměnila. Profesionální výsledek není tvrdit, že ‚pracuje v podvědomí‘.",
    promise: "Vést dobrovolný neklinický experiment, předem určit měření a přijmout nulový efekt.",
    mistake: "Metafora nebo předpoklad se prezentuje jako zákon mozku či léčba traumatu.",
    demo: "Klientka žádá rychlé vymazání traumatu pomocí NLP.",
    overlay: "Experiment, ne léčebný slib",
  },
  {
    title: "Rapport bez čtení mysli",
    hook: "Klientka uhne pohledem. Znamená to odpor, stud, soustředění — nebo vůbec nic z toho?",
    promise: "Vnímat neverbální data bez diagnózy a ověřovat individuální i kulturní preference.",
    mistake: "Ticho, gesto nebo oční kontakt se promění v jistotu o vnitřním motivu.",
    demo: "Elitea mění tempo, délku odpovědí a oční kontakt.",
    overlay: "Pozorování ≠ význam",
  },
  {
    title: "Sebedůvěra z důkazů, ne z afirmací",
    hook: "‚Když chceš, dokážeš všechno.‘ Co když klientce nechybí vůle, ale přístup, zdraví nebo zdroje?",
    promise: "Stavět sebedůvěru z konkrétní dovednosti, podmínek, tréninku a zpětné vazby.",
    mistake: "Objektivní bariéra se označí za špatné nastavení mysli.",
    demo: "Motivační zakázka odkryje systémovou nebo zdravotní překážku.",
    overlay: "Důkaz · dovednost · zkušenost",
  },
  {
    title: "Mindfulness se souhlasem a stop pravidlem",
    hook: "Klientce se při zavření očí přitíží. Pokračovat není disciplína, ale chyba.",
    promise: "Nabídnout pozornost nebo dech jako volitelnou praxi a při zhoršení bezpečně zastavit.",
    mistake: "Klidný hlas a zavřené oči se považují za univerzálně bezpečné.",
    demo: "Během meditace přijde neklid, závrať a pocit odpojení.",
    overlay: "Souhlas · volba · stop",
  },
  {
    title: "Reframing bez toxické pozitivity",
    hook: "Ne každá negativní věta je zkreslení. Některá přesně popisuje ztrátu, diskriminaci nebo hranici.",
    promise: "Oddělit fakt, interpretaci, předpověď a pravidlo a měnit jen to, co je poctivé měnit.",
    mistake: "Reframe zmenší reálnou škodu nebo přesune odpovědnost na klientku.",
    demo: "Tři situace: běžná nervozita, skutečná ztráta a diskriminace.",
    overlay: "Reframe nemění fakta",
  },
  {
    title: "Emoce nejsou selhání ani příkaz",
    hook: "Cílem není mít emoci pod úplnou kontrolou. Cílem je rozšířit volbu jednání.",
    promise: "Mapovat systém vlivů, najít časný bod volby a poznat klinickou hranici.",
    mistake: "Emoce se vysvětlí jedinou myšlenkou a člověk je obviněn za vlastní stav.",
    demo: "Klientka požaduje úplnou kontrolu emocí a později popíše klinické potíže.",
    overlay: "Emoce je informace, ne příkaz",
  },
  {
    title: "Přesvědčení, které možná chrání",
    hook: "Pravidlo vypadá omezující. V prostředí klientky ale možná stále drží skutečné bezpečí.",
    promise: "Ověřit pracovní hypotézu, respektovat ochrannou funkci a navrhnout bezpečný test.",
    mistake: "Koučka hledá skryté schéma a snaží se ho zlomit bez znalosti kontextu.",
    demo: "Omezující pravidlo vzniklo v nebezpečném pracovním prostředí.",
    overlay: "Nejdřív funkce, potom změna",
  },
  {
    title: "Rozhodnutí bez nátlaku na odvahu",
    hook: "Opatrnost není automaticky strach. U nevratného rozhodnutí může být známkou úsudku.",
    promise: "Rozlišit vratnost, kritéria, neznámé, nejmenší test a potřebu odborné rady.",
    mistake: "Koučka vytvoří falešnou naléhavost a riskantní volbu nazve odvahou.",
    demo: "Klientka volí mezi bezpečnější a riskantní cestou s právním nebo finančním dopadem.",
    overlay: "Autonomie před adrenalinem",
  },
  {
    title: "Od řemesla k pravdivé nabídce",
    hook: "Dobrá nabídka neslibuje zázrak. Ukazuje komu, s čím, jak a v jakých hranicích pomáhá.",
    promise: "Propojit smysl, niche, cenu, etický marketing, celé sezení a obhajobu certifikátu.",
    mistake: "Marketingový tlak rozšíří slib za hranici toho, co služba umí doložit.",
    demo: "Klientka, sponzor a nabídka vytvoří konflikt důvěrnosti, ceny a očekávání.",
    overlay: "Pravdivá nabídka je součást řemesla",
  },
];

const modulePattern = /^# MODUL (\d+) — (.+)$/gm;
const starts = [...source.matchAll(modulePattern)];
const modules = starts.map((match, index) => {
  const moduleIndex = Number(match[1]);
  const end = starts[index + 1]?.index ?? source.indexOf("# ZÁVĚREČNÝ STANDARD");
  const block = source.slice(match.index, end === -1 ? undefined : end);
  const lessons = [...block.matchAll(/^## Lekce (\d+\.\d+) — (.+)\n<!-- minutes: (\d+) -->\n\n([\s\S]*?)(?=\n## Lekce|\n### Praktická)/gm)].map((item) => ({
    id: item[1],
    title: item[2].trim(),
    minutes: Number(item[3]),
    body: item[4].trim(),
  }));
  const lab = block.match(/^### Praktická laboratoř \d+ — (.+)\n<!-- minutes: (\d+) -->\n\n([\s\S]*?)(?=\n### Profesní)/m);
  const simulation = block.match(/^### Profesní aplikace \d+ — (.+)\n<!-- minutes: (\d+) -->\n\n([\s\S]*?)(?=\n## Test)/m);
  const test = block.match(/^## Test modulu \d+\n<!-- minutes: (\d+) -->\n\n([\s\S]*?)$/m);
  return {
    index: moduleIndex,
    sourceTitle: match[2].trim(),
    lessons,
    lab: lab ? { title: lab[1].trim(), minutes: Number(lab[2]), body: lab[3].trim() } : null,
    simulation: simulation ? { title: simulation[1].trim(), minutes: Number(simulation[2]), body: simulation[3].trim() } : null,
    test: test ? { minutes: Number(test[1]), body: test[2].trim() } : null,
  };
});

if (modules.length !== 18 || modules.some((item) => item.lessons.length !== 3)) {
  throw new Error(`Expected 18 modules with 3 lessons; parsed ${modules.length}.`);
}

const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
const cards = [
  "# Natáčecí karty všech modulů",
  "",
  "Tyto karty jsou produkční most mezi zdrojovým kurzem a doslovnými telepromptery. Modul 0 má samostatný plný scénář. U modulů 1–17 karta uzamyká obsah, demonstraci, hranici a návaznost; teprve po čtecí zkoušce pilotu se rozepisují do finálního mluveného rytmu, aby se jedna případná změna stylu neopravovala sedmnáctkrát.",
  "",
];

for (const module of modules) {
  const concept = concepts[module.index];
  cards.push(
    `## M${String(module.index).padStart(2, "0")} — ${concept.title}`,
    "",
    `**Zdrojový modul:** ${module.sourceTitle}  `,
    `**Cold open:** „${concept.hook}“  `,
    `**Příslib dovednosti:** ${concept.promise}  `,
    `**Typická profesionálně vypadající chyba:** ${concept.mistake}  `,
    `**Grafický motiv:** ${concept.overlay}`,
    "",
    "### Tři kapitoly masterclassu",
    "",
  );
  for (const lesson of module.lessons) {
    cards.push(
      `#### ${lesson.id} — ${lesson.title}`,
      "",
      lesson.body,
      "",
      `**Obrazová funkce:** rozlišovací grafika + jedna konkrétní replika nebo rozhodovací bod.`,
      "",
    );
  }
  cards.push(
    "### Kontrastní ukázka",
    "",
    `**Situace:** ${concept.demo}`,
    "",
    `**První verze:** obsahuje tuto chybu — ${concept.mistake}`,
    "",
    `**Druhá verze:** ukáže přesné rozlišení, označení role, klientčinu volbu a další krok odpovídající modulu.`,
    "",
    "### Přechod do praxe",
    "",
    `**Laboratoř — ${module.lab.title}:** ${module.lab.body}`,
    "",
    `**AI simulace — ${module.simulation.title}:** ${module.simulation.body}`,
    "",
    "### Kontrola učení",
    "",
    module.test.body,
    "",
    "### Povinné exporty",
    "",
    `- \`LC-M${String(module.index).padStart(2, "0")}-MASTER-v01.mp4\``,
    `- \`LC-M${String(module.index).padStart(2, "0")}-LAB-v01.mp4\``,
    `- \`LC-M${String(module.index).padStart(2, "0")}-SIM-v01.mp4\``,
    `- české titulky, plný přepis, miniatura a textová alternativa`,
    "",
  );
}

const register = [
  ["asset_id", "module", "type", "working_title", "duration_target", "script_status", "content_review", "safety_review", "shoot_status", "edit_status", "publish_status"].map(escapeCsv).join(","),
];

for (const module of modules) {
  const prefix = `LC-M${String(module.index).padStart(2, "0")}`;
  const concept = concepts[module.index];
  const scriptStatus = module.index === 0 ? "shoot-ready" : "locked-card";
  register.push(
    [prefix + "-MASTER", module.index, "masterclass", concept.title, "10–14 min", scriptStatus, "pending", "pending", "not-shot", "not-edited", "not-published"].map(escapeCsv).join(","),
    [prefix + "-LAB", module.index, "lab-briefing", module.lab.title, "2–4 min", module.index === 0 ? "shoot-ready" : "locked-card", "pending", "as-needed", "not-shot", "not-edited", "not-published"].map(escapeCsv).join(","),
    [prefix + "-SIM", module.index, "simulation-briefing", module.simulation.title, "1–1.5 min", module.index === 0 ? "shoot-ready" : "locked-card", "pending", "as-needed", "not-shot", "not-edited", "not-published"].map(escapeCsv).join(","),
  );
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "all-module-shooting-cards.md"), cards.join("\n"));
fs.writeFileSync(path.join(outputDir, "video-asset-register.csv"), register.join("\n") + "\n");

console.log(`Built ${modules.length} module cards and ${register.length - 1} video asset rows.`);
