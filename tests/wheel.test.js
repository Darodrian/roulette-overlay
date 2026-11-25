import test from 'node:test';
import assert from 'node:assert/strict';
import { installStoreEnv } from './store-env.js';

installStoreEnv();
const { labelFits } = await import('../js/wheel.js');

test('labelFits keeps text on 40 equal slices', () => {
  assert.equal(labelFits({ angle: (2 * Math.PI) / 40 }, 234), true);
});

test('labelFits drops text on 200 equal slices', () => {
  assert.equal(labelFits({ angle: (2 * Math.PI) / 200 }, 234), false);
});

test('labelFits keeps text on a wide weighted slice', () => {
  assert.equal(labelFits({ angle: (2 * Math.PI) / 2 }, 234), true);
});
