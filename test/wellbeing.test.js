import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExpertSources } from '../src/coaching.js';
import {
  formatWellbeingProtocol,
  loadWellbeingProtocols,
  selectWellbeingProtocol,
  validateProtocolSources,
} from '../src/wellbeing.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const protocols = await loadWellbeingProtocols(join(ROOT, 'data', 'wellbeing-protocols.json'));
const sources = await loadExpertSources(join(ROOT, 'data', 'expert-sources.json'));

test('wellbeing protokoly jsou unikátní, ohraničené a mají platné zdroje', () => {
  assert.ok(protocols.length >= 6);
  assert.equal(new Set(protocols.map(protocol => protocol.id)).size, protocols.length);
  assert.equal(validateProtocolSources(protocols, sources), true);
  for (const protocol of protocols) {
    assert.ok(protocol.stop_conditions.length > 0);
    assert.ok(protocol.never_claim.length > 0);
  }
});

test('úzkost volí vnější orientaci a večerní meditace večerní protokol', () => {
  assert.equal(
    selectWellbeingProtocol(protocols, 'Mám úzkost a jsem rozklepaná.', 'podporna_stabilizace').id,
    'external_orientation_90s',
  );
  assert.equal(
    selectWellbeingProtocol(protocols, 'Chci večerní meditaci po práci.', 'vedena_meditace').id,
    'evening_settling_5m',
  );
});

test('wellbeing protokol se mimo bezpečné režimy nepřikládá', () => {
  assert.equal(selectWellbeingProtocol(protocols, 'Mám stres.', 'mentoring'), null);
});

test('formát protokolu obsahuje zastavovací podmínky a zakázaná tvrzení', () => {
  const text = formatWellbeingProtocol(protocols[0]);
  assert.match(text, /Okamžitě zastavit/);
  assert.match(text, /Nikdy netvrdit/);
});
