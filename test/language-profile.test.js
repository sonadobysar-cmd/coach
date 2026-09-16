import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectConversationLanguage,
  responseLanguageMismatch,
} from '../src/language-profile.js';

test('jazyk konverzace pozná češtinu, slovenštinu i krátké slovenské opravy', () => {
  assert.equal(detectConversationLanguage('Nevím, proč jsem ten workshop ukončila.'), 'cs');
  assert.equal(detectConversationLanguage('Neviem, prečo som ten workshop ukončila.'), 'sk');
  for (const text of [
    'Asi neviem.',
    'Zasa sa opakuješ.',
    'Už nechcem pokračovať.',
    'Nie, toto nechcem.',
    'Rozumiem. Denník ani domácu úlohu už nebudem navrhovať a nebudem ťa presviedčať.',
    'Ktorá hodnota je v tomto rozhodnutí najviac ohrozená?',
  ]) {
    assert.equal(detectConversationLanguage(text), 'sk', text);
  }
});

test('krátké profesijní tahy se stejným významem zůstanou rozlišené podle skutečných tvarů', () => {
  assert.equal(
    detectConversationLanguage('Rozumím. Deník ani domácí úkol už nebudu navrhovat.'),
    'cs',
  );
  assert.equal(
    responseLanguageMismatch('Která hodnota je v tomto rozhodnutí nejvíc ohrožená?', 'sk'),
    true,
  );
  assert.equal(
    responseLanguageMismatch('Ktorá hodnota je v tomto rozhodnutí najviac ohrozená?', 'sk'),
    false,
  );
});

test('výslovná žádost o jazyk má přednost před starším jazykem', () => {
  const messages = [
    { role: 'user', content: 'Nevím, jak se rozhodnout.' },
    { role: 'assistant', content: 'Co teď potřebuješ?' },
    { role: 'user', content: 'Prosím, odpovedaj po slovensky.' },
  ];
  assert.equal(detectConversationLanguage(messages), 'sk');
  assert.equal(detectConversationLanguage('Prosím, odpovídej po česky.'), 'cs');
});

test('výstupní brána odmítne českou i smíšenou odpověď ve slovenském sezení', () => {
  for (const output of [
    'Beru — nechceš pokračovat s workshopem. Co chceš řešit dál?',
    'Dobre. Čo chceš riešiť dál?',
    'Máš úplnou pravdu. Čo urobil?',
    'Ta otázka byla mimo. Čo potrebuješ?',
  ]) {
    assert.equal(responseLanguageMismatch(output, 'sk'), true, output);
  }
  assert.equal(
    responseLanguageMismatch('Rozumiem — s workshopmi pokračovať nechceš. Čo chceš riešiť ďalej?', 'sk'),
    false,
  );
});

test('výstupní brána odmítne slovenskou i smíšenou odpověď v českém sezení', () => {
  assert.equal(responseLanguageMismatch('Tá otázka bola mimo. Co potřebuješ?', 'cs'), true);
  assert.equal(responseLanguageMismatch('Ta otázka byla mimo. Co potřebuješ?', 'cs'), false);
  assert.equal(
    responseLanguageMismatch('Rozumím správně, že právě toto bude náš dnešní užitečný výsledek?', 'cs'),
    false,
  );
});
