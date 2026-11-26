import test from 'node:test';
import assert from 'node:assert/strict';
import { installStoreEnv } from './store-env.js';

installStoreEnv();
const store = await import('../js/store.js');

const ids = (state) => state.items.map((item) => item.id);

function spinFor(winnerId) {
  return {
    id: 'spin-1',
    index: winnerId === 'b' ? 1 : 0,
    winnerId,
    round: 7,
    mode: 'equal',
    items: [
      { id: 'a', label: 'Alpha', weight: 1 },
      { id: 'b', label: 'Beta', weight: 1 },
    ],
    startAngle: 0,
    endAngle: 1,
    startedAt: 1,
    durationMs: 1000,
    dismissed: false,
  };
}

function seed({ items = [], spin = null, round = 7, activeProfileId = null, profiles = [] } = {}) {
  store.update((draft) => {
    draft.items = items;
    draft.spin = spin;
    draft.round = round;
    draft.activeProfileId = activeProfileId;
    draft.profiles = profiles;
  });
}

const savedProfile = {
  id: 'profile-1',
  name: 'Saved',
  mode: 'equal',
  items: [{ id: 'a', label: 'Alpha' }],
  savedAt: 1,
};

test('eliminateWinner removes the winner and clears the spin', () => {
  seed({
    items: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }],
    spin: spinFor('b'),
    activeProfileId: 'profile-1',
    profiles: [savedProfile],
  });

  const removed = store.eliminateWinner('b');
  const state = store.getState();

  assert.equal(removed.item.id, 'b');
  assert.equal(removed.index, 1);
  assert.deepEqual(ids(state), ['a']);
  assert.equal(state.spin, null);
  assert.equal(state.round, 7);
  assert.equal(state.activeProfileId, null);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].id, 'profile-1');
});

test('eliminateWinner clears spin when the live pick is already gone', () => {
  seed({ items: [{ id: 'a', label: 'Alpha' }], spin: spinFor('b') });

  assert.equal(store.eliminateWinner('b'), null);
  assert.equal(store.getState().spin, null);
  assert.deepEqual(ids(store.getState()), ['a']);
});

test('restoreWinner restores at the saved index when there is room', () => {
  seed({ items: [{ id: 'a', label: 'Alpha' }, { id: 'c', label: 'Gamma' }] });

  store.restoreWinner({ item: { id: 'b', label: 'Beta' }, index: 1 });

  assert.deepEqual(ids(store.getState()), ['a', 'b', 'c']);
});

test('restoreWinner no-ops on a full wheel', () => {
  seed({ items: Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, label: `X${i}` })) });

  store.restoreWinner({ item: { id: 'b', label: 'Beta' }, index: 1 });

  assert.equal(store.getState().items.length, 200);
  assert.ok(!ids(store.getState()).includes('b'));
});

test('clearAllPicks snapshots and clears items and spin', () => {
  seed({
    items: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }],
    spin: spinFor('b'),
    activeProfileId: 'profile-1',
    profiles: [savedProfile],
  });

  const snapshot = store.clearAllPicks();
  const state = store.getState();

  assert.deepEqual(snapshot.items.map((item) => item.id), ['a', 'b']);
  assert.equal(snapshot.activeProfileId, 'profile-1');
  assert.deepEqual(state.items, []);
  assert.equal(state.spin, null);
  assert.equal(state.round, 7);
  assert.equal(state.mode, 'equal');
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].id, 'profile-1');
});

test('restoreAllPicks restores only when the wheel is empty', () => {
  seed({
    items: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }],
    activeProfileId: 'profile-1',
  });
  const snapshot = {
    items: store.getState().items.map((item) => ({ ...item })),
    activeProfileId: 'profile-1',
  };

  seed({ items: [{ id: 'new', label: 'New' }] });
  store.restoreAllPicks(snapshot);
  assert.deepEqual(ids(store.getState()), ['new']);

  store.update((draft) => {
    draft.items = [];
  });
  store.restoreAllPicks(snapshot);

  const state = store.getState();
  assert.deepEqual(ids(state), ['a', 'b']);
  assert.equal(state.activeProfileId, 'profile-1');
  assert.equal(state.spin, null);
});
