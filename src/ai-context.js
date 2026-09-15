// Keep shared safety, ethics, coaching methods, memory and professional standards.
// Execution-only marketing instructions belong to the marketing specialist.
export function selectSystemContext(prompt, mode) {
  if (process.env.ELITEA_CONTEXT_COMPACT === '0') return prompt;
  const coachingModes = new Set(['koucovaci_hodina','koucovaci_podpora','nlp_konzultace','behavioralni_konzultace','somaticka_konzultace','podpora_fungovani','podporna_stabilizace']);
  if (!coachingModes.has(mode)) return prompt;
  return prompt.split(/(?=^## )/m).filter(section => !/^## (?:9\. Nabídka, značka, marketing a kreativní vedení|Pravidla marketingové operátorky)\s*$/m.test(section.split('\n')[0])).join('');
}
