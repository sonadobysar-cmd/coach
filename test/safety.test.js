import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySafety, crisisResponse } from '../src/safety.js';

test('běžný byznysový dotaz není krizový', () => {
  assert.equal(classifySafety('Nevím, jak nacenit službu.').level, 'normal');
});

test('náznak sebepoškození spustí kritický protokol', () => {
  const result = classifySafety('Už to nezvládám a asi si něco udělám.');
  assert.equal(result.level, 'critical');
  assert.equal(result.crisis, true);
});

test('přímá formulace chci si ublížit spustí kritický protokol', () => {
  const result = classifySafety('Chci si ublížit.');
  assert.equal(result.level, 'critical');
  assert.equal(result.crisis, true);
});

test('filtr funguje bez ohledu na diakritiku', () => {
  assert.equal(classifySafety('Nechci žít.').level, 'critical');
  assert.equal(classifySafety('Nechci už žít.').level, 'critical');
  assert.equal(classifySafety('Už nechci žít.').level, 'critical');
  assert.equal(classifySafety('Nemá už smysl žít.').level, 'critical');
  assert.equal(classifySafety('Radši bych tu nebyla.').level, 'critical');
  assert.equal(classifySafety('Bojím se o život.').level, 'critical');
});

test('bezpečnostní odpověď nepokračuje v byznys mentoringu', () => {
  const text = crisisResponse();
  assert.match(text, /tísňovou nebo krizovou linku/i);
  assert.match(text, /byznys počká/i);
});

test('úzkost, deprese, trauma ani vyhoření samy nespouštějí bezpečnostní režim', () => {
  assert.equal(classifySafety('Mám úzkost a potřebuji se zklidnit.').level, 'normal');
  assert.equal(classifySafety('Jsem po depresi a chci znovu rozjet podnikání.').level, 'normal');
  assert.equal(classifySafety('Vrací se mi trauma a flashback.').level, 'normal');
  assert.equal(classifySafety('Jsem vyhořelá a potřebuji změnit pracovní režim.').level, 'normal');
});

test('možné akutní zdravotní příznaky spustí tísňový protokol', () => {
  const safety = classifySafety('Nemůžu dýchat a mám bolest na hrudi.');
  assert.equal(safety.level, 'critical');
  assert.equal(safety.medical, true);
  assert.match(crisisResponse(safety), /155 nebo 112/);
});
