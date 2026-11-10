const STORAGE_KEY = 'roulette-overlay/v1';
const CHANNEL_NAME = 'roulette-overlay';

export const MAX_ITEMS = 40;
export const MAX_LABEL = 80;

export const PALETTE = [
  '#d8a03c',
  '#4f9e78',
  '#4a7cab',
  '#bd5a45',
  '#8b6cae',
  '#5e918c',
  '#a24f6d',
  '#7f8f45',
  '#c07d40',
  '#6b7e9e',
  '#a86f4c',
  '#8a6455',
];

export const DEFAULT_ITEMS = [
  { label: 'Chat picks the game', weight: 3 },
  { label: 'One extra hour', weight: 2 },
  { label: 'Viewer picks a challenge', weight: 2 },
  { label: 'Skip the next break', weight: 2 },
  { label: 'Raid a friend', weight: 1 },
  { label: 'Host roulette', weight: 1 },
  { label: 'Sub goal bonus', weight: 1 },
  { label: 'Wildcard', weight: 1 },
];

export const DEFAULT_SETTINGS = {
  durationMs: 6500,
  sound: true,
  overlayVisible: true,
  bannerMs: 8000,
  announceOdds: true,
  showHub: true,
  showRoundPick: true,
};

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanText(value, max = MAX_LABEL) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function cleanColor(value, index) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : PALETTE[index % PALETTE.length];
}

function cleanItem(raw, index) {
  const item = raw && typeof raw === 'object' ? raw : {};
  return {
    id: typeof item.id === 'string' && item.id ? item.id.slice(0, 24) : uid(),
    label: cleanText(item.label) || `Pick ${index + 1}`,
    color: cleanColor(item.color, index),
    weight: clamp(item.weight, 0, 1000, 1),
  };
}

function cleanItems(rawItems) {
  if (!Array.isArray(rawItems)) return null;
  return rawItems.slice(0, MAX_ITEMS).map(cleanItem);
}

function cleanSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    durationMs: clamp(s.durationMs, 3000, 15000, DEFAULT_SETTINGS.durationMs),
    sound: s.sound !== false,
    overlayVisible: s.overlayVisible !== false,
    bannerMs: clamp(s.bannerMs, 0, 120000, DEFAULT_SETTINGS.bannerMs),
    announceOdds: s.announceOdds !== false,
    showHub: s.showHub !== false,
    showRoundPick: s.showRoundPick !== false,
  };
}

function cleanProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const items = cleanItems(raw.items);
  if (!items) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 24) : uid(),
    name: cleanText(raw.name, 40) || 'Untitled wheel',
    mode: raw.mode === 'weighted' ? 'weighted' : 'equal',
    items,
    savedAt: clamp(raw.savedAt, 0, 9e15, Date.now()),
  };
}

function cleanSpin(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const items = cleanItems(raw.items);
  if (!items || !items.length) return null;
  const startAngle = Number(raw.startAngle);
  const endAngle = Number(raw.endAngle);
  const startedAt = Number(raw.startedAt);
  const durationMs = Number(raw.durationMs);
  if (![startAngle, endAngle, startedAt, durationMs].every(Number.isFinite)) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    index: Math.max(0, Math.floor(Number(raw.index) || 0)),
    winnerId: typeof raw.winnerId === 'string' ? raw.winnerId : items[0].id,
    round: Math.max(1, Math.floor(Number(raw.round) || 1)),
    mode: raw.mode === 'weighted' ? 'weighted' : 'equal',
    items,
    startAngle,
    endAngle,
    startedAt,
    durationMs: clamp(durationMs, 1000, 30000, DEFAULT_SETTINGS.durationMs),
    dismissed: raw.dismissed === true,
  };
}

export function normalize(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const items = cleanItems(base.items) || DEFAULT_ITEMS.map(cleanItem);
  const profiles = Array.isArray(base.profiles) ? base.profiles.map(cleanProfile).filter(Boolean).slice(0, 40) : [];
  return {
    schema: 1,
    rev: Math.max(0, Math.floor(Number(base.rev) || 0)),
    writer: typeof base.writer === 'string' ? base.writer : null,
    mode: base.mode === 'weighted' ? 'weighted' : 'equal',
    items,
    settings: cleanSettings(base.settings),
    spin: cleanSpin(base.spin),
    round: Math.max(0, Math.floor(Number(base.round) || 0)),
    profiles,
    activeProfileId: typeof base.activeProfileId === 'string' ? base.activeProfileId : null,
    updatedAt: clamp(base.updatedAt, 0, 9e15, 0),
  };
}

export function createDefaultState() {
  return normalize({
    items: DEFAULT_ITEMS.map(cleanItem),
    settings: DEFAULT_SETTINGS,
    rev: 1,
    updatedAt: Date.now(),
  });
}

function readRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let state = normalize(readRaw() || createDefaultState());
const writerId = uid();
const listeners = new Set();

let channel = null;
try {
  channel = new BroadcastChannel(CHANNEL_NAME);
} catch {
  channel = null;
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of [...listeners]) {
    try {
      listener(state);
    } catch (error) {
      console.error('[roulette] listener failed', error);
    }
  }
}

function persist(next) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[roulette] could not save to localStorage', error);
  }
  try {
    channel && channel.postMessage({ rev: next.rev, writer: writerId });
  } catch {
    /* channel closed */
  }
}

function adopt(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  const next = normalize(candidate);
  if (next.rev <= state.rev) return false;
  state = next;
  emit();
  return true;
}

export function update(mutator) {
  const draft = clone(state);
  mutator(draft);
  draft.rev = state.rev + 1;
  draft.writer = writerId;
  draft.updatedAt = Date.now();
  state = normalize(draft);
  persist(state);
  emit();
  return state;
}

if (channel) {
  channel.addEventListener('message', (event) => {
    if (!event.data || event.data.writer === writerId) return;
    adopt(readRaw());
  });
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    adopt(JSON.parse(event.newValue));
  } catch {
    /* ignore a malformed write */
  }
});

/* Storage events can be swallowed (some embedded Chromium builds, iframes).
   A slow poll keeps the two OBS views honest even then. */
window.setInterval(() => {
  const raw = readRaw();
  if (raw) adopt(raw);
}, 750);

/* ---- wheel helpers ---- */

export function weightOf(item, mode) {
  return mode === 'weighted' ? Math.max(0, Number(item.weight) || 0) : 1;
}

export function totalWeight(items, mode) {
  return items.reduce((sum, item) => sum + weightOf(item, mode), 0);
}

export function shareOf(item, items, mode) {
  const total = totalWeight(items, mode);
  return total > 0 ? weightOf(item, mode) / total : 0;
}

/* ---- profiles ---- */

export function saveProfile(name) {
  const clean = cleanText(name, 40);
  if (!clean) return { ok: false, error: 'Give the wheel a name first.' };
  let result = { ok: true };
  update((draft) => {
    const existing = draft.profiles.find((p) => p.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      existing.mode = draft.mode;
      existing.items = clone(draft.items);
      existing.savedAt = Date.now();
      draft.activeProfileId = existing.id;
      result = { ok: true, updated: true, id: existing.id };
      return;
    }
    const profile = { id: uid(), name: clean, mode: draft.mode, items: clone(draft.items), savedAt: Date.now() };
    draft.profiles.unshift(profile);
    draft.profiles = draft.profiles.slice(0, 40);
    draft.activeProfileId = profile.id;
    result = { ok: true, created: true, id: profile.id };
  });
  return result;
}

export function loadProfile(id) {
  update((draft) => {
    const profile = draft.profiles.find((p) => p.id === id);
    if (!profile) return;
    draft.mode = profile.mode;
    draft.items = clone(profile.items);
    draft.activeProfileId = profile.id;
    draft.spin = null;
  });
}

export function deleteProfile(id) {
  update((draft) => {
    draft.profiles = draft.profiles.filter((p) => p.id !== id);
    if (draft.activeProfileId === id) draft.activeProfileId = null;
  });
}

/* ---- json ---- */

export function exportPayload() {
  return {
    app: 'roulette-overlay',
    schema: 1,
    exportedAt: new Date().toISOString(),
    wheel: { mode: state.mode, items: clone(state.items) },
    settings: clone(state.settings),
    profiles: clone(state.profiles),
  };
}

export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (Array.isArray(data)) data = { wheel: { items: data, mode: 'equal' } };
  if (!data || typeof data !== 'object') return { ok: false, error: 'No wheel data found in that file.' };
  const wheel = data.wheel && typeof data.wheel === 'object' ? data.wheel : data;
  const items = cleanItems(wheel.items);
  if (!items || !items.length) return { ok: false, error: 'That file has no picks in it.' };
  const profiles = Array.isArray(data.profiles) ? data.profiles.map(cleanProfile).filter(Boolean) : [];
  return {
    ok: true,
    wheel: { mode: wheel.mode === 'weighted' ? 'weighted' : 'equal', items },
    settings: data.settings ? cleanSettings(data.settings) : null,
    profiles,
  };
}

export function applyImport(parsed) {
  update((draft) => {
    draft.mode = parsed.wheel.mode;
    draft.items = parsed.wheel.items;
    draft.spin = null;
    draft.activeProfileId = null;
    if (parsed.settings) {
      const keepVisible = draft.settings.overlayVisible;
      draft.settings = { ...parsed.settings, overlayVisible: keepVisible };
    }
    const names = new Set(draft.profiles.map((p) => p.name.toLowerCase()));
    for (const profile of parsed.profiles) {
      if (names.has(profile.name.toLowerCase())) continue;
      names.add(profile.name.toLowerCase());
      draft.profiles.unshift(profile);
    }
    draft.profiles = draft.profiles.slice(0, 40);
  });
}

export function clearSpin() {
  update((draft) => {
    draft.spin = null;
  });
}

export function resetRounds() {
  update((draft) => {
    draft.round = 0;
    draft.spin = null;
  });
}

export function storageKey() {
  return STORAGE_KEY;
}
