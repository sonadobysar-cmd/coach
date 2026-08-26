const STEPS = Object.freeze([
  'Vymez jednu konkrétní situaci, účel materiálu, očekávaný důkaz a hranici, kdy se postup nepoužije.',
  'Vyplň pole vlastními slovy, přidej doslovnou formulaci a rozliš osobní, vztahovou a systémovou vrstvu.',
  'Proveď nácvik se studijní trenérkou Elitea, ulož první výkon, reakci modelové osoby a strukturované hodnocení.',
  'Oprav nejslabší část, zopakuj ji a dolož změnu v přesnosti, odpovědnosti, bezpečí nebo proveditelnosti.',
]);

export function expandSelfTrustMaterials(materials) {
  return materials.map(material => ({
    ...material,
    howToUse: material.howToUse || [...STEPS],
    prompts: material.prompts || [
      { id:'situation', label:'Situace, účel a měření', help:`Pro „${material.title}“ popiš spouštěč, současné chování, žádoucí výsledek a pozorovatelný důkaz.` },
      { id:'script', label:'Doslovný jazyk a varianty', help:`Použij postup: ${material.method} Napiš základní větu, vřelou variantu a verzi pro vyšší tlak.` },
      { id:'context', label:'Moc, vztah a systém', help:`Rozhodni, co je osobní dovednost, vztahová reakce a systémová podmínka; neopravuj člověka za problém prostředí.` },
      { id:'safety', label:'Hranice a stop pravidlo', help:`Převeď do konkrétního rozhodnutí tuto hranici: ${material.boundary}` },
      { id:'evidence', label:'Simulace, důkaz a revize', help:'Ulož první pokus, zpětnou vazbu Elitea, opravenou verzi, datum reálného použití a výsledek bez známkování vlastní hodnoty.' },
    ],
  }));
}
