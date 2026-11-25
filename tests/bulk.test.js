import test from 'node:test';
import assert from 'node:assert/strict';
import { installStoreEnv } from './store-env.js';

installStoreEnv();
const { buildBulkItems } = await import('../js/store.js');

test('buildBulkItems appends labels with palette colors and weight 1', () => {
  const { addedItems, added, skipped } = buildBulkItems([], ['Alpha', 'Beta']);
  assert.equal(added, 2);
  assert.equal(skipped, 0);
  assert.deepEqual(addedItems.map((item) => item.label), ['Alpha', 'Beta']);
  assert.deepEqual(addedItems.map((item) => item.color), ['#d8a03c', '#4f9e78']);
  assert.deepEqual(addedItems.map((item) => item.weight), [1, 1]);
  assert.ok(addedItems.every((item) => typeof item.id === 'string' && item.id.length > 0));
});

test('buildBulkItems truncates at 150 and reports skipped labels', () => {
  const existing = Array.from({ length: 148 }, () => ({ label: 'old' }));
  const { addedItems, added, skipped } = buildBulkItems(existing, ['A', 'B', 'C']);
  assert.equal(added, 2);
  assert.equal(skipped, 1);
  assert.deepEqual(addedItems.map((item) => item.label), ['A', 'B']);
  assert.deepEqual(addedItems.map((item) => item.color), ['#8b6cae', '#5e918c']);
});
