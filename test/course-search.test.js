import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCourseSearchIndex, searchCourseIndex } from '../src/course-search.js';

const courses = [{
  slug: 'pevna-v-sobe', title: 'Pevná v sobě', subtitle: 'Sebedůvěra', categoryId: 'coaching-mental-health',
  modules: [{ title: 'Hranice', items: [
    { id: 'hranice-rodina', title: 'Hranice v rodině', kind: 'lesson', minutes: 12, markdown: '# Lekce\nRozpoznej automatický souhlas a formuluj vlastní hranici.' },
    { id: 'sebeprijeti', title: 'Sebepřijetí', kind: 'practice', minutes: 15, markdown: 'Práce se sebekritikou a laskavě pravdivým jazykem.' },
  ] }],
}];

test('fulltext najde přesnou studijní část podle názvu i obsahu', () => {
  const index = buildCourseSearchIndex(courses);
  assert.equal(index.length, 2);
  assert.equal(searchCourseIndex(index, 'hranice rodině')[0].itemId, 'hranice-rodina');
  assert.equal(searchCourseIndex(index, 'automatický souhlas')[0].itemId, 'hranice-rodina');
});

test('fulltext zvládá češtinu bez diakritiky a prázdný dotaz nic nevrací', () => {
  const index = buildCourseSearchIndex(courses);
  assert.equal(searchCourseIndex(index, 'sebeprijeti')[0].itemId, 'sebeprijeti');
  assert.deepEqual(searchCourseIndex(index, 'a'), []);
});
