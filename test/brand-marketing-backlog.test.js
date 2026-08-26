import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const backlog = JSON.parse(await readFile(new URL('../data/brand-marketing-training-backlog.json', import.meta.url), 'utf8'));

test('studijní plán Brand & Marketing pokrývá strategii, akvizici i řízení byznysu', () => {
  assert.equal(backlog.waves.length, 3);
  const courses = backlog.waves.flatMap(wave => wave.courses);
  assert.equal(courses.length, 12);
  assert.equal(new Set(courses.map(course => course.url)).size, courses.length);
  assert.deepEqual(courses.map(course => course.priority), Array.from({ length: 12 }, (_, index) => index + 1));
});

test('první vlna má definované schopnosti a evaluační brány před učením agentky', () => {
  const strategicCore = backlog.waves[0].courses;
  assert.equal(strategicCore.length, 4);
  for (const course of strategicCore) {
    assert.ok(course.requiredCapabilities.length >= 7, course.title);
    assert.ok(course.requiredEvals.length >= 3, course.title);
    assert.match(course.status, /access_required/);
  }
});

test('publikační pravidla zakazují kopírovat placené lekce do Elitea', () => {
  assert.match(backlog.governance.sourceUse, /nikoli kopie/i);
  assert.match(backlog.governance.publicationRule, /více zdrojů/i);
  assert.match(backlog.governance.agentReleaseRule, /evaluačním scénáři/i);
  assert.match(backlog.governance.platformRule, /oficiální dokumentaci/i);
});

test('veřejné programy nejsou zaměněné za seznam nakoupených zdrojů', () => {
  assert.equal(backlog.publicProgramRoadmap.length, 6);
  assert.deepEqual(backlog.publicProgramRoadmap.map(program => program.priority), [1, 2, 3, 4, 5, 6]);
  assert.equal(backlog.publicProgramRoadmap[0].id, 'podnikani-od-reality-k-rustu');
  assert.equal(backlog.publicProgramRoadmap[1].id, 'brand-marketing-strategist');
  for (const program of backlog.publicProgramRoadmap) {
    assert.ok(program.sourcePriorities.length >= 3, program.title);
    assert.ok(program.promise.length >= 60, program.title);
  }
});

test('produkt přesně odděluje mentorku, lektorku, simulaci a certifikaci', () => {
  assert.match(backlog.productDefinition.brandMentor.mission, /diagnostiky fáze a úzkého hrdla/i);
  assert.match(backlog.productDefinition.brandMentor.handoff, /Coach & Mentor/i);
  assert.deepEqual(backlog.productDefinition.courseLecturer.modes, ['explanation', 'guided_practice', 'knowledge_check', 'roleplay_handoff']);
  assert.match(backlog.productDefinition.simulation.evaluation, /výborný/i);
  assert.match(backlog.governance.lessonExperienceRule, /animovanou mapu procesu/i);
  assert.match(backlog.governance.certificateRule, /jménem absolventky/i);
});
