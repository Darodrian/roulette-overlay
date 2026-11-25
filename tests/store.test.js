import test from 'node:test';
import assert from 'node:assert/strict';
import { installStoreEnv } from './store-env.js';

installStoreEnv();
const store = await import('../js/store.js');

test('normalize keeps at most 200 picks', () => {
  const items = Array.from({ length: 210 }, (_, i) => ({ label: `P${i}` }));
  assert.equal(store.normalize({ items }).items.length, 200);
});

test('parsePickLines splits mixed line endings and trims each line', () => {
  assert.deepEqual(store.parsePickLines('  Alpha  \r\n\n Beta\rGamma \n'), ['Alpha', 'Beta', 'Gamma']);
});

test('parsePickLines truncates long lines and drops blank lines', () => {
  assert.equal(store.parsePickLines('x'.repeat(120))[0].length, 100);
  assert.deepEqual(store.parsePickLines('\n \t\n'), []);
});

test('isTextFile accepts text extensions and rejects images', () => {
  assert.equal(store.isTextFile({ name: 'list.TXT', type: '' }), true);
  assert.equal(store.isTextFile({ name: 'notes.md', type: '' }), true);
  assert.equal(store.isTextFile({ name: 'pic.png', type: 'image/png' }), false);
});
