const STEPS = Object.freeze([
  'Vymez konkrétní pracovní výsledek, uživatele, vlastníka procesu a hranici toho, co AI v tomto kroku smí a nesmí udělat.',
  'Doplň pouze nezbytné vstupy a zdroje; u dat označ původ, citlivost, datum platnosti, oprávnění a pravidlo uchování.',
  'Proveď suchý běh nebo simulaci s AI lektorkou, zkontroluj výstup podle rubriky a zaznamenej chybu, opravu i zbytkové riziko.',
  'Stanov lidské schválení, měřitelnou bránu, limit času a nákladů, auditní stopu, rollback a datum dalšího testu.',
]);

export function expandAiAgentMaterials(materials) {
  return materials.map(material => ({
    ...material,
    howToUse: material.howToUse || [...STEPS],
    prompts: material.prompts || [
      { id: 'outcome', label: 'Výsledek a současný proces', help: `Pro „${material.title}“ popiš uživatele, spouštěč, současný postup, očekávaný artefakt a definici hotovo.` },
      { id: 'context', label: 'Kontext, data a zdroje', help: `Použij postup: ${material.method} Uveď původ, oprávnění, citlivost, datum a nejvýznamnější chybějící informaci.` },
      { id: 'permissions', label: 'Oprávnění a lidská brána', help: 'Odděl čtení, návrh, zápis a externí akci. Urči konkrétní osobu, obsah a okamžik schválení.' },
      { id: 'failure', label: 'Selhání, injection a zakázaná akce', help: `Převeď tuto hranici do testovatelného pravidla: ${material.boundary}` },
      { id: 'eval', label: 'Eval, důkaz a opravený pokus', help: 'Zapiš běžný, hraniční a škodlivý test, očekávaný výsledek, skutečný výsledek a opravu.' },
      { id: 'operations', label: 'Náklady, log, rollback a revize', help: 'Urči limit běhu, měřenou hodnotu, guardrail, auditní události, rollback, vlastníka a datum nové kontroly.' },
    ],
  }));
}
