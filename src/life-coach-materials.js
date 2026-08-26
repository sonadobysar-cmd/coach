const STEPS = Object.freeze([
  'Nejprve vymez jednu konkrétní situaci, cíl, roli koučky a bezpečnostní hranici; nevycházej z obecné nálepky člověka.',
  'Vyplň pracovní pole vlastními slovy, odděl fakta od interpretace a uveď alespoň jednu alternativní hypotézu.',
  'Proveď předepsaný nácvik se studijní trenérkou Elitea a ulož konkrétní ukázku výkonu, ne jen dojem.',
  'Zapracuj zpětnou vazbu, zopakuj nejslabší sekvenci a napiš, co se změnilo v přesnosti, autonomii nebo bezpečnosti.',
]);

export function expandLifeCoachMaterials(materials) {
  return materials.map(material => ({
    ...material,
    howToUse: material.howToUse || [...STEPS],
    prompts: material.prompts || [
      { id: 'case', label: 'Konkrétní situace a zakázka', help: `Pro materiál „${material.title}“ popiš pozorovatelnou situaci, klientčina slova, očekávaný výsledek a svou roli.` },
      { id: 'analysis', label: 'Rozlišení, fakta a hypotézy', help: `Použij tento postup: ${material.method} Odděl fakta, klientčin význam, vlastní domněnku a nejméně jednu jinou možnost.` },
      { id: 'boundary', label: 'Etika, souhlas a stop pravidlo', help: `Převeď do konkrétního rozhodnutí tuto hranici: ${material.boundary}` },
      { id: 'practice', label: 'Nácvik s Elitea a důkaz výkonu', help: 'Ulož klíčovou otázku či reakci, odpověď modelové klientky, zpětnou vazbu a přesnou opravenou verzi.' },
      { id: 'transfer', label: 'Přenos, měření a další krok', help: 'Urči nejmenší použitelný krok, způsob ověření, datum revize a situaci, v níž metodu nepoužiješ.' },
    ],
  }));
}
