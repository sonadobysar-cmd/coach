const STEPS = Object.freeze([
  'Vymez konkrétní skupinu, účel materiálu, hranici facilitace a situaci, v níž se postup nepoužije.',
  'Vyplň pole vlastními slovy a doplň doslovný jazyk souhlasu, rovnocennou alternativu a stop pravidlo.',
  'Proveď nácvik se studijní trenérkou Elitea a ulož ukázku zásahu, reakci modelové účastnice a hodnocení.',
  'Oprav nejslabší část, zopakuj ji a dolož změnu v bezpečí, srozumitelnosti, inkluzi nebo vedení času.',
]);

export function expandWomensCircleMaterials(materials) {
  return materials.map(material => ({
    ...material,
    howToUse: material.howToUse || [...STEPS],
    prompts: material.prompts || [
      { id:'purpose', label:'Skupina, účel a hranice', help:`Pro „${material.title}“ popiš cílovou skupinu, účel, očekávaný výstup a co tento materiál neslibuje.` },
      { id:'script', label:'Doslovný jazyk facilitátorky', help:`Použij tento postup: ${material.method} Napiš úvod, pokyn, souhlas, alternativu a uzavření doslova.` },
      { id:'safety', label:'Bezpečí, přístupnost a stop pravidlo', help:`Převeď do konkrétního rozhodnutí tuto hranici: ${material.boundary}` },
      { id:'simulation', label:'Simulace s Elitea', help:'Ulož situaci, svůj zásah, reakci modelové účastnice, hodnocení a opravenou formulaci.' },
      { id:'evidence', label:'Důkaz výkonu a revize', help:'Urči měřitelný výstup, zpětnou vazbu, datum revize a situaci, kdy materiál přestane být vhodný.' },
    ],
  }));
}
