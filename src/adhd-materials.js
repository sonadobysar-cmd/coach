const DEFAULT_STEPS = Object.freeze([
  'Vyber jednu konkrétní situaci, stanov bezpečnou hranici a před pokusem zapiš svou předpověď.',
  'Vyplň pole pozorovatelnými údaji; odděl skutečnost, vlastní interpretaci a vše, co zatím nevíš.',
  'Proveď navržený experiment v běžném životě nebo v simulaci s Elitea a zaznamenej také jeho cenu.',
  'Porovnej výsledek s předpovědí, uprav jedinou podmínku a ulož původní i opravenou verzi do portfolia.',
]);

export function expandAdhdMaterials(materials) {
  return materials.map(material => ({
    ...material,
    howToUse: material.howToUse || [...DEFAULT_STEPS],
    prompts: material.prompts || defaultPrompts(material),
  }));
}

function defaultPrompts(material) {
  return [
    {
      id: 'situation',
      label: 'Situace, kontext a cílový výstup',
      help: `Pro materiál „${material.title}“ popiš jednu pozorovatelnou situaci, její začátek, prostředí a konkrétní výsledek.`,
    },
    {
      id: 'baseline',
      label: 'Výchozí stav a přímé důkazy',
      help: 'Zapiš četnost, čas, dokončený výstup, výjimky a data, která máš před zavedením jakékoli změny.',
    },
    {
      id: 'experiment',
      label: 'Jedna změna a předpověď pokusu',
      help: `Navrhni jediný test podle metody: ${material.method} Uveď, co očekáváš a co zůstane stejné.`,
    },
    {
      id: 'safety',
      label: 'Hranice, souhlas a stop pravidlo',
      help: `Převeď tuto hranici do konkrétního rozhodnutí pro praxi: ${material.boundary}`,
    },
    {
      id: 'result',
      label: 'Výsledek, cena a další úprava',
      help: 'Porovnej předpověď se skutečností, zahrň únavu nebo jiné náklady a napiš nejmenší další bezpečný krok.',
    },
  ];
}
