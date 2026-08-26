import test from 'node:test';
import assert from 'node:assert/strict';
import { activeDayLabel, localDayKey, recordActiveDay } from '../public/activity.js';

test('sto odpovědí během jednoho dne se počítá jako jediný den spolu', () => {
  const now = new Date(2026, 7, 22, 9, 30);
  let progress = { active_day_count: 0, last_active_day: null };
  for (let index = 0; index < 100; index += 1) progress = recordActiveDay(progress, now);
  assert.equal(progress.active_day_count, 1);
  assert.equal(progress.last_active_day, '2026-08-22');
});

test('nový kalendářní den zvýší počet právě jednou', () => {
  const firstDay = new Date(2026, 7, 22, 23, 59);
  const secondDay = new Date(2026, 7, 23, 0, 1);
  let progress = recordActiveDay({}, firstDay);
  progress = recordActiveDay(progress, secondDay);
  progress = recordActiveDay(progress, secondDay);
  assert.equal(progress.active_day_count, 2);
  assert.equal(localDayKey(secondDay), '2026-08-23');
});

test('počítadlo používá přirozený název dny spolu', () => {
  assert.equal(activeDayLabel(0), '0 dní spolu');
  assert.equal(activeDayLabel(1), '1 den spolu');
  assert.equal(activeDayLabel(3), '3 dny spolu');
  assert.equal(activeDayLabel(8), '8 dní spolu');
});
