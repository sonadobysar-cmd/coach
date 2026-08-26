const DEFAULT_STEPS = Object.freeze([
  'Vyber jednu konkrétní situaci a nejdřív projdi zdravotní, krizovou, souhlasovou a produktovou bezpečnostní bránu.',
  'Odděl klientčina slova, tradiční Bachův popis, vlastní interpretaci a tvrzení, která současné důkazy nepodporují.',
  'Vyplň rozlišovací část, variantu bez esence, stop pravidlo a podle zadání proveď simulaci se studijní trenérkou Elitea.',
  'Oprav nejméně jednu formulaci, ulož původní i novou verzi a napiš, jak změna zvýšila bezpečnost nebo přesnost.',
]);

export function expandBachMaterials(materials) {
  return materials.map(material => ({
    ...material,
    howToUse: material.howToUse || [...DEFAULT_STEPS],
    prompts: material.prompts || defaultPrompts(material),
  }));
}

function defaultPrompts(material) {
  return [
    { id: 'situation', label: 'Konkrétní situace a vlastní slova', help: `Pro materiál „${material.title}“ zachyť čas, prostředí, pozorovatelný děj a doslovná slova bez diagnózy.` },
    { id: 'traditional', label: 'Tradiční popis a nejbližší kontrast', help: `Použij metodu: ${material.method} Uveď také sousední kartu nebo alternativu a co je rozlišuje.` },
    { id: 'evidence', label: 'Důkaz, nejistota a jiné vysvětlení', help: 'Odděl tradici, osobní zkušenost a klinické tvrzení a napiš alespoň jedno jiné možné vysvětlení výsledku.' },
    { id: 'safety', label: 'Souhlas, produkt a stop pravidlo', help: `Převeď do konkrétního rozhodnutí tuto hranici: ${material.boundary}` },
    { id: 'result', label: 'Výsledek, oprava a další krok', help: 'Popiš výstup, reakci Elitea, opravenou formulaci, variantu bez esence a bezpečný další krok.' },
  ];
}
