import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourses } from '../src/courses.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataDir = resolve(ROOT, 'data');
const coursePaths = (await readdir(dataDir))
  .filter(name => /^course-.*\.md$/.test(name) && !name.includes('audio-scripts'))
  .map(name => resolve(dataDir, name));
const courses = await loadCourses(coursePaths);
const rows = courses
  .sort((left, right) => left.title.localeCompare(right.title, 'cs'))
  .map(course => ({
    status: course.depth.meetsLessonDepthStandard ? 'OK' : 'CHYBA',
    course: course.title,
    lessons: course.depth.lessonCount,
    averageWords: course.depth.averageLessonWords,
    shortestWords: course.depth.shortestLessonWords,
    scheduledHours: Number((course.depth.scheduledMinutes / 60).toFixed(1)),
    declaredHours: course.durationHours,
  }));

console.table(rows);
const failed = rows.filter(row => row.status !== 'OK');
if (courses.length !== 27 || failed.length) {
  console.error(`Kurzový audit selhal: programů ${courses.length}/27, nevyhovujících ${failed.length}.`);
  process.exitCode = 1;
} else {
  console.log(`Kurzový audit prošel: 27/27 programů, každá odborná lekce splňuje standard hloubky.`);
}
