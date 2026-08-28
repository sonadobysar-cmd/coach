const STEPS = Object.freeze([
  'Vymez jedno konkrétní podnikatelské rozhodnutí, jeho vlastníka, časový horizont a výsledek, který potřebuješ vytvořit.',
  'Doplň pracovní pole doložitelnými daty; fakta, interpretace, odhady a přání udržuj v oddělených sloupcích.',
  'Proveď nácvik nebo kritickou obhajobu se studijní trenérkou Elitea a ulož otázku, odpověď i upravenou verzi výstupu.',
  'Stanov nejmenší další experiment, metriku, stop pravidlo, datum revize a člověka odpovědného za aktualizaci.',
]);

export function expandBusinessMaterials(materials) {
  return materials.map(material => ({
    ...material,
    howToUse: material.howToUse || [...STEPS],
    prompts: material.prompts || [
      { id: 'decision', label: 'Rozhodnutí, kontext a výsledek', help: `Pro materiál „${material.title}“ popiš aktuální rozhodnutí, proč je důležité, kdo jej vlastní a dokdy musí vzniknout použitelný výstup.` },
      { id: 'evidence', label: 'Data, zdroje a míra jistoty', help: `Použij postup: ${material.method} U každého tvrzení uveď zdroj, datum, míru jistoty a nejvýznamnější protidůkaz.` },
      { id: 'economics', label: 'Ekonomika, kapacita a trade-off', help: 'Zachyť peníze, čas, kapacitu, alternativní náklady, nejhorší přijatelný scénář a podmínku, při níž rozhodnutí nedává smysl.' },
      { id: 'risk', label: 'Riziko, etika a stop pravidlo', help: `Převeď do konkrétního rozhodovacího pravidla tuto hranici: ${material.boundary}` },
      { id: 'practice', label: 'Obhajoba s Elitea a opravený pokus', help: 'Ulož klíčovou námitku trenérky, svou první odpověď, zpětnou vazbu a přesnou opravenou verzi artefaktu.' },
      { id: 'next', label: 'Experiment, metrika a datum revize', help: 'Urči nejmenší krok, primární metriku, minimální práh, stop pravidlo, vlastníka a termín, kdy rozhodnutí aktualizuješ.' },
    ],
  }));
}
