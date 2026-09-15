export function finalExamScenarioIds(course) {
  const definition = course?.mastery?.finalExam || course?.finalExam || {};
  const values = Array.isArray(definition.scenarioIds) && definition.scenarioIds.length
    ? definition.scenarioIds
    : [definition.scenarioId];
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

export function isFinalExamScenario(course, scenarioId) {
  const value = String(scenarioId || '').trim();
  return Boolean(value) && finalExamScenarioIds(course).includes(value);
}
