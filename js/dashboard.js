import {
  PALETTE,
  MAX_ITEMS,
  applyImport,
  clearSpin,
  deleteProfile,
  exportPayload,
  getState,
  loadProfile,
  parseImport,
  resetRounds,
  saveProfile,
  subscribe,
  uid,
  update,
} from './store.js';
import { Wheel, buildSlices } from './wheel.js';
import { angleAt, countCrossings, isDone, planSpin } from './spin.js';
import {
  ICONS,
  clamp,
  copyText,
  downloadJson,
  h,
  inOBS,
  lastBeat,
  pct,
  seconds,
  signedPct,
  toast,
} from './ui.js';

const TEMPLATE = `
<div class="dash">
  <header class="bar">
    <div class="brand">
      <span class="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 12V2.8M12 12l6.5 6.5M12 12 5.5 18.5M12 12h9.2" stroke="currentColor" stroke-width="1.6"/></svg>
      </span>
      <span class="brand__name">Roulette</span>
      <span class="brand__sub">stream overlay console</span>
    </div>
    <div class="bar__meta">
      <span class="chip" data-env title="Where this page is running"><i></i><span data-env-text>Browser</span></span>
      <span class="chip" data-link title="Overlay connection"><i></i><span data-link-text>No overlay</span></span>
    </div>
    <div class="bar__act">
      <button class="btn btn--gold bar__spin" type="button" data-spin>Spin</button>
      <button class="btn bar__overlay" type="button" data-overlay-toggle aria-pressed="true">
        <span class="dot" aria-hidden="true"></span><span data-overlay-label>Overlay on</span>
      </button>
    </div>
  </header>

  <main class="dash__main">
    <section class="stage" aria-labelledby="stage-title">
      <div class="stage__head">
        <h1 class="stage__title" id="stage-title" data-title>Equal odds</h1>
        <p class="stage__meta mono">
          <span data-round>Round 0</span><span class="dim">·</span><span data-meta>0 picks</span>
        </p>
      </div>

      <div class="stage__wheel">
        <div class="wheel-frame">
          <canvas data-wheel role="img" aria-label="Preview of the wheel"></canvas>
          <div class="pointer" data-pointer aria-hidden="true">
            <svg viewBox="0 0 28 38">
              <rect x="10" y="0" width="8" height="14" rx="2" fill="#ffb42e" stroke="#0b0d0f" stroke-width="2"/>
              <path d="M14 37 3 13h22Z" fill="#ffb42e" stroke="#0b0d0f" stroke-width="2"/>
            </svg>
          </div>
          <p class="wheel-empty" data-empty hidden>Nothing on the wheel yet.<br><span>Add two or more picks</span></p>
        </div>
      </div>

      <div class="readout">
        <div class="readout__cell">
          <span class="eyebrow">Result</span>
          <strong class="readout__value" data-result aria-live="polite">Ready</strong>
        </div>
        <div class="readout__cell readout__cell--end">
          <span class="eyebrow">Clock</span>
          <strong class="readout__value mono" data-clock>6.5s</strong>
        </div>
        <button class="readout__dismiss" type="button" data-dismiss hidden>Clear</button>
      </div>
      <div class="runline" aria-hidden="true"><span data-progress></span></div>

      <div class="stage__foot">
        <button class="spin" type="button" data-spin>
          <span data-spin-label>Spin</span><kbd>space</kbd>
        </button>
        <div class="stage__duration">
          <div class="stage__duration-head">
            <label class="eyebrow" for="duration">Spin duration</label>
            <span class="mono" data-duration-label>6.5s</span>
          </div>
          <input id="duration" type="range" min="3" max="15" step="0.5" data-duration>
        </div>
      </div>
    </section>

    <section class="panel picks-panel" aria-labelledby="picks-title">
      <div class="panel__head">
        <h2 class="panel__title" id="picks-title">Picks <span class="count mono" data-count>0</span></h2>
        <div class="segmented" data-mode role="group" aria-label="Odds mode">
          <button type="button" data-mode-btn="equal">Equal</button>
          <button type="button" data-mode-btn="weighted">Weighted</button>
        </div>
      </div>
      <p class="panel__hint" data-hint></p>
      <ol class="picks" data-items></ol>
      <button class="add" type="button" data-add><span aria-hidden="true">+</span> Add pick</button>
      <p class="swarn" data-warn hidden></p>
    </section>

    <section class="panel show-panel" aria-labelledby="show-title">
      <div class="panel__head">
        <h2 class="panel__title" id="show-title">Show</h2>
        <span class="eyebrow" data-link-sub>Off air</span>
      </div>

      <p class="notice" data-notice hidden>
        <b>This tab is outside OBS.</b> A normal browser cannot reach the overlay inside OBS Studio.
        Dock this page instead: <b>Docks → Custom Browser Docks…</b>
      </p>

      <div class="show__grid">
        <div class="show__col">
          <h3 class="sub">Settings</h3>
          <div class="setting">
            <div class="setting__copy"><span>Sound</span><small>Ticks and the winner chime, mixed through OBS.</small></div>
            <label class="switch"><input type="checkbox" data-sound><span class="switch__track"></span><span class="sr">Sound effects</span></label>
          </div>
          <div class="setting">
            <div class="setting__copy"><span>Overlay</span><small>Hide the wheel without removing the source.</small></div>
            <label class="switch"><input type="checkbox" data-overlay><span class="switch__track"></span><span class="sr">Overlay visible</span></label>
          </div>
          <div class="setting">
            <div class="setting__copy"><span>Winner banner</span><small>How long the winner stays on screen.</small></div>
            <select class="input input--select" data-banner aria-label="Winner banner duration">
              <option value="0">Hold</option>
              <option value="3000">3s</option>
              <option value="6000">6s</option>
              <option value="8000">8s</option>
              <option value="15000">15s</option>
              <option value="30000">30s</option>
            </select>
          </div>
          <div class="setting">
            <div class="setting__copy"><span>Odds on banner</span><small>Show the winning pick's probability.</small></div>
            <label class="switch"><input type="checkbox" data-odds><span class="switch__track"></span><span class="sr">Show odds on the winner banner</span></label>
          </div>
          <div class="setting">
            <div class="setting__copy"><span>Round &amp; pick on banner</span><small>Show round number and pick position.</small></div>
            <label class="switch"><input type="checkbox" data-roundpick><span class="switch__track"></span><span class="sr">Show round and pick on the winner banner</span></label>
          </div>
          <div class="setting">
            <div class="setting__copy"><span>Center readout</span><small>Round number and spin timer inside the wheel.</small></div>
            <label class="switch"><input type="checkbox" data-hub><span class="switch__track"></span><span class="sr">Show round and timer in the wheel</span></label>
          </div>
          <div class="setting">
            <div class="setting__copy"><span>Rounds</span><small>Back to round 00 and clear the wheel.</small></div>
            <button class="btn btn--sm" type="button" data-reset-rounds>Reset</button>
          </div>
        </div>

        <div class="show__col">
          <h3 class="sub">Profiles</h3>
          <ul class="profiles" data-profiles></ul>
          <form class="saveform" data-save-form>
            <input class="input" data-save-name placeholder="Name this wheel" maxlength="40" aria-label="Profile name">
            <button class="btn btn--sm" type="submit">Save</button>
          </form>
          <p class="fineprint">Profiles live in this browser only. Export a file to move them.</p>
        </div>

        <div class="show__col">
          <h3 class="sub">Backup</h3>
          <div class="io">
            <button class="btn btn--sm" type="button" data-export>Export</button>
            <label class="btn btn--sm" for="import-file">Import
              <input id="import-file" type="file" accept=".json,application/json" data-import hidden>
            </label>
            <button class="btn btn--sm" type="button" data-copy-url>${ICONS.copy} Overlay URL</button>
          </div>
          <button class="urlbox" type="button" data-copy-url title="Copy the overlay URL">
            <code data-url>…</code>
            <span aria-hidden="true">${ICONS.copy}</span>
          </button>

          <details class="guide">
            <summary>OBS setup</summary>
            <ol>
              <li><b>Dock the console.</b> In OBS open <em>Docks → Custom Browser Docks…</em> and paste this page's URL with <code>?view=dashboard</code>.</li>
              <li><b>Add the wheel.</b> <em>Sources → + → Browser</em>, paste the overlay URL, set <b>1920×1080</b>. Leave the background transparent.</li>
              <li><b>Keep both in OBS.</b> A dock and a browser source only share state inside OBS. Opening the console in Chrome will not reach the source.</li>
              <li><b>Audio.</b> Right-click the Browser Source → <em>Properties → Control audio via OBS</em> to get ticks on the mixer.</li>
            </ol>
          </details>
        </div>
      </div>
    </section>
  </main>

  <div class="toasts" data-toasts></div>
</div>
`;

function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (!timestamp) return 'never';
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function overlayUrl() {
  if (location.protocol === 'file:') return 'index.html?view=overlay';
  const base = `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
  return `${base.replace(/\/$/, '/')}index.html?view=overlay`;
}

export function mount(root) {
  root.innerHTML = TEMPLATE;

  const el = {
    title: root.querySelector('[data-title]'),
    round: root.querySelector('[data-round]'),
    meta: root.querySelector('[data-meta]'),
    wheel: root.querySelector('[data-wheel]'),
    pointer: root.querySelector('[data-pointer]'),
    empty: root.querySelector('[data-empty]'),
    result: root.querySelector('[data-result]'),
    clock: root.querySelector('[data-clock]'),
    dismiss: root.querySelector('[data-dismiss]'),
    progress: root.querySelector('[data-progress]'),
    count: root.querySelector('[data-count]'),
    hint: root.querySelector('[data-hint]'),
    items: root.querySelector('[data-items]'),
    warn: root.querySelector('[data-warn]'),
    modes: [...root.querySelectorAll('[data-mode-btn]')],
    spins: [...root.querySelectorAll('[data-spin]')],
    spinLabels: [...root.querySelectorAll('[data-spin-label]')],
    duration: root.querySelector('[data-duration]'),
    durationLabel: root.querySelector('[data-duration-label]'),
    overlayToggle: root.querySelector('[data-overlay-toggle]'),
    overlayLabel: root.querySelector('[data-overlay-label]'),
    overlaySwitch: root.querySelector('[data-overlay]'),
    sound: root.querySelector('[data-sound]'),
    banner: root.querySelector('[data-banner]'),
    odds: root.querySelector('[data-odds]'),
    hub: root.querySelector('[data-hub]'),
    roundpick: root.querySelector('[data-roundpick]'),
    resetRounds: root.querySelector('[data-reset-rounds]'),
    env: root.querySelector('[data-env]'),
    envText: root.querySelector('[data-env-text]'),
    link: root.querySelector('[data-link]'),
    linkText: root.querySelector('[data-link-text]'),
    linkSub: root.querySelector('[data-link-sub]'),
    profiles: root.querySelector('[data-profiles]'),
    saveForm: root.querySelector('[data-save-form]'),
    saveName: root.querySelector('[data-save-name]'),
    notice: root.querySelector('[data-notice]'),
    url: root.querySelector('[data-url]'),
    importInput: root.querySelector('[data-import]'),
    picksPanel: root.querySelector('.picks-panel'),
  };

  const wheel = new Wheel(el.wheel);
  wheel.setHub('READY', '—');

  let previewRotation = 0;
  let spinId = null;
  let rafId = 0;
  let settleTimer = 0;
  let prevAngle = 0;
  let kick = 0;
  let lastFrame = 0;
  const observedUser = inOBS();

  el.url.textContent = overlayUrl();

  /* ---------- rendering ---------- */

  function render(state) {
    const spinning = state.spin ? !isDone(state.spin) : false;
    const activeSpin = state.spin;
    const { slices, excluded } = buildSlices(state.items, state.mode);
    const total = slices.length;

    if (!activeSpin) {
      wheel.setActive(null);
    } else if (isDone(activeSpin)) {
      wheel.setActive(activeSpin.winnerId);
    } else {
      wheel.setActive(null);
    }
    wheel.setSlices(slices);
    el.empty.hidden = total > 0;

    el.title.textContent = state.mode === 'weighted' ? 'Weighted odds' : 'Equal odds';
    el.round.textContent = `Round ${String(state.round).padStart(2, '0')}`;
    el.meta.textContent =
      state.mode === 'weighted'
        ? `${total} on the wheel${excluded.length ? ` · ${excluded.length} excluded` : ''}`
        : `${total} picks · ${total ? pct(1 / total, 1) : '0%'} each`;

    el.count.textContent = String(state.items.length);
    el.hint.textContent =
      state.mode === 'weighted'
        ? 'Weights set the slice size. A weight of 0 keeps a pick off the wheel.'
        : 'Every pick gets the same slice.';

    if (excluded.length) {
      el.warn.hidden = false;
      el.warn.textContent = `${excluded.length} pick${excluded.length === 1 ? '' : 's'} at weight 0 ${excluded.length === 1 ? 'is' : 'are'} not on the wheel.`;
    } else {
      el.warn.hidden = true;
    }

    for (const button of el.modes) {
      button.setAttribute('aria-pressed', String(button.dataset.modeBtn === state.mode));
    }

    const disabled = spinning || total < 2;
    for (const button of el.spins) button.disabled = disabled;
    for (const label of el.spinLabels) label.textContent = spinning ? 'Spinning' : 'Spin';
    root.dataset.spinning = String(spinning);
    el.picksPanel.inert = spinning;
    el.picksPanel.setAttribute('aria-busy', String(spinning));

    el.duration.value = String(state.settings.durationMs / 1000);
    el.durationLabel.textContent = seconds(state.settings.durationMs);
    el.sound.checked = state.settings.sound;
    el.overlaySwitch.checked = state.settings.overlayVisible;
    el.odds.checked = state.settings.announceOdds;
    el.roundpick.checked = state.settings.showRoundPick;
    el.hub.checked = state.settings.showHub;
    el.resetRounds.disabled = spinning;
    wheel.setHubVisible(state.settings.showHub);
    el.banner.value = String(state.settings.bannerMs);
    if (![...el.banner.options].some((option) => option.value === String(state.settings.bannerMs))) {
      el.banner.value = '8000';
    }

    el.overlayToggle.setAttribute('aria-pressed', String(state.settings.overlayVisible));
    el.overlayLabel.textContent = state.settings.overlayVisible ? 'Overlay on' : 'Overlay off';
    el.overlayToggle.classList.toggle('is-off', !state.settings.overlayVisible);

    renderItems(state, slices);
    renderProfiles(state);
    renderResult(state, slices, spinning);

    if (!activeSpin) {
      wheel.setHub(`${total} PICKS`, '—');
    } else if (!spinning) {
      wheel.setHub(`ROUND ${String(activeSpin.round).padStart(2, '0')}`, '—');
    }
  }

  function renderResult(state, slices, spinning) {
    const spin = state.spin;
    el.dismiss.hidden = !spin;
    if (!spin) {
      el.result.textContent = 'Ready';
      el.result.dataset.tone = 'idle';
      el.clock.textContent = seconds(state.settings.durationMs);
      el.progress.style.transform = 'scaleX(0)';
      return;
    }
    if (spinning) {
      el.result.textContent = 'Spinning…';
      el.result.dataset.tone = 'live';
      el.clock.textContent = seconds(Math.max(0, spin.durationMs - (Date.now() - spin.startedAt)));
      return;
    }
    const winner = spin.items.find((item) => item.id === spin.winnerId) || spin.items[spin.index];
    el.result.textContent = winner ? winner.label : 'Winner';
    el.result.dataset.tone = 'won';
    el.clock.textContent = seconds(spin.durationMs);
    el.progress.style.transform = 'scaleX(1)';
  }

  function rowFor(item) {
    const row = h('li', { class: 'pick', dataset: { id: item.id } });
    row.innerHTML = `
      <label class="pick__swatch" title="Slice colour">
        <input type="color" data-color aria-label="Slice colour">
      </label>
      <div class="pick__body">
        <div class="pick__line">
          <input class="input pick__label" data-label maxlength="80" spellcheck="false" aria-label="Pick label">
          <span class="pick__pct mono" data-pct></span>
          <div class="pick__tools">
            <button class="icon-btn" type="button" data-up aria-label="Move up" title="Move up">${ICONS.up}</button>
            <button class="icon-btn" type="button" data-down aria-label="Move down" title="Move down">${ICONS.down}</button>
            <button class="icon-btn" type="button" data-del aria-label="Delete pick" title="Delete pick">${ICONS.close}</button>
          </div>
        </div>
        <div class="pick__line pick__line--meta">
          <div class="pick__bar" aria-hidden="true"><span data-bar></span></div>
          <span class="pick__delta mono" data-delta></span>
          <label class="pick__weight">
            <span>weight</span>
            <input class="input input--num" type="number" data-weight min="0" max="999" step="1" aria-label="Weight">
          </label>
        </div>
      </div>`;

    const labelInput = row.querySelector('[data-label]');
    const weightInput = row.querySelector('[data-weight]');
    const colorInput = row.querySelector('[data-color]');

    labelInput.addEventListener('input', () => {
      if (getState().spin && !isDone(getState().spin)) return;
      update((draft) => {
        const target = draft.items.find((entry) => entry.id === item.id);
        if (!target) return;
        target.label = labelInput.value;
        draft.activeProfileId = null;
      });
    });
    labelInput.addEventListener('blur', () => {
      if (!labelInput.value.trim()) {
        labelInput.value = 'Untitled pick';
        labelInput.dispatchEvent(new Event('input'));
      }
    });

    weightInput.addEventListener('input', () => {
      if (weightInput.value === '') return;
      if (getState().spin && !isDone(getState().spin)) return;
      const value = clamp(Number(weightInput.value), 0, 999);
      update((draft) => {
        const target = draft.items.find((entry) => entry.id === item.id);
        if (!target) return;
        target.weight = value;
        draft.activeProfileId = null;
      });
    });
    weightInput.addEventListener('blur', () => {
      if (weightInput.value === '') weightInput.value = '0';
    });

    colorInput.addEventListener('input', () => {
      update((draft) => {
        const target = draft.items.find((entry) => entry.id === item.id);
        if (!target) return;
        target.color = colorInput.value;
        draft.activeProfileId = null;
      });
    });

    row.querySelector('[data-up]').addEventListener('click', () => moveItem(item.id, -1));
    row.querySelector('[data-down]').addEventListener('click', () => moveItem(item.id, 1));
    row.querySelector('[data-del]').addEventListener('click', () => removeItem(item.id));

    return row;
  }

  function renderItems(state, slices) {
    const ids = state.items.map((item) => item.id).join('|');
    if (el.items.dataset.ids !== ids) {
      el.items.dataset.ids = ids;
      const frag = document.createDocumentFragment();
      for (const item of state.items) frag.append(rowFor(item));
      el.items.replaceChildren(frag);
    }

    const byId = new Map(slices.map((slice) => [slice.id, slice]));
    const equalShare = state.items.length ? 1 / state.items.length : 0;

    for (const row of el.items.children) {
      const item = state.items.find((entry) => entry.id === row.dataset.id);
      if (!item) continue;
      const slice = byId.get(item.id);
      const share = slice ? slice.share : 0;
      const labelInput = row.querySelector('[data-label]');
      const weightInput = row.querySelector('[data-weight]');
      const colorInput = row.querySelector('[data-color]');
      const pctOut = row.querySelector('[data-pct]');
      const deltaOut = row.querySelector('[data-delta]');
      const bar = row.querySelector('[data-bar]');

      row.querySelector('.pick__swatch').style.background = item.color;

      if (document.activeElement !== labelInput) labelInput.value = item.label;
      if (document.activeElement !== weightInput) weightInput.value = String(item.weight);
      if (document.activeElement !== colorInput) colorInput.value = item.color;

      pctOut.textContent = pct(share);
      bar.style.width = `${Math.max(0, share * 100)}%`;
      bar.style.background = item.color;

      row.dataset.excluded = String(!slice);
      row.dataset.mode = state.mode;
      weightInput.closest('.pick__weight').hidden = state.mode !== 'weighted';

      if (state.mode === 'weighted' && slice) {
        const delta = share - equalShare;
        deltaOut.textContent = `${signedPct(delta)} vs even`;
        deltaOut.dataset.sign = delta > 0.0005 ? 'up' : delta < -0.0005 ? 'down' : 'even';
        deltaOut.hidden = false;
      } else {
        deltaOut.hidden = true;
      }
    }
  }

  function renderProfiles(state) {
    const rows = state.profiles.map((profile) => {
      const row = h('li', { class: 'profile', dataset: { id: profile.id } });
      if (profile.id === state.activeProfileId) row.dataset.active = 'true';
      const load = h('button', { class: 'profile__load', type: 'button' });
      load.append(
        h('span', { class: 'profile__name' }, profile.name),
        h('span', { class: 'profile__meta mono' }, `${profile.mode === 'weighted' ? 'weighted' : 'equal'} · ${profile.items.length} picks · ${relativeTime(profile.savedAt)}`),
      );
      load.addEventListener('click', () => {
        if (getState().spin && !isDone(getState().spin)) return;
        loadProfile(profile.id);
        toast(`Loaded “${profile.name}”`);
      });
      const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${profile.name}` }, '');
      del.innerHTML = ICONS.close;
      del.addEventListener('click', () => {
        deleteProfile(profile.id);
        toast(`Deleted “${profile.name}”`);
      });
      row.append(load, del);
      return row;
    });
    el.profiles.replaceChildren(...rows);
    if (!rows.length) {
      el.profiles.append(h('li', { class: 'profiles__empty' }, 'No saved wheels yet.'));
    }
    el.saveName.placeholder = state.profiles.length ? 'Save as…' : 'Name this wheel';
  }

  /* ---------- items ---------- */

  function moveItem(id, direction) {
    if (getState().spin && !isDone(getState().spin)) return;
    update((draft) => {
      const index = draft.items.findIndex((item) => item.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= draft.items.length) return;
      const [item] = draft.items.splice(index, 1);
      draft.items.splice(next, 0, item);
      draft.activeProfileId = null;
    });
  }

  function removeItem(id) {
    if (getState().spin && !isDone(getState().spin)) return;
    const state = getState();
    const index = state.items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const removed = state.items[index];
    update((draft) => {
      draft.items.splice(index, 1);
      draft.activeProfileId = null;
    });
    toast(`Removed “${removed.label}”`, {
      actionLabel: 'Undo',
      onAction: () =>
        update((draft) => {
          if (draft.items.length >= MAX_ITEMS) return;
          draft.items.splice(Math.min(index, draft.items.length), 0, removed);
        }),
    });
  }

  function addItem() {
    if (getState().spin && !isDone(getState().spin)) return;
    if (getState().items.length >= MAX_ITEMS) {
      toast(`That's the limit: ${MAX_ITEMS} picks.`);
      return;
    }
    const id = uid();
    update((draft) => {
      draft.items.push({
        id,
        label: `Pick ${draft.items.length + 1}`,
        color: PALETTE[draft.items.length % PALETTE.length],
        weight: 1,
      });
      draft.activeProfileId = null;
    });
    requestAnimationFrame(() => {
      const input = el.items.querySelector(`[data-id="${id}"] [data-label]`);
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  /* ---------- spin ---------- */

  function doSpin() {
    const state = getState();
    if (state.spin && !isDone(state.spin)) return;
    const { slices } = buildSlices(state.items, state.mode);
    if (slices.length < 2) {
      toast('Add at least two picks with a weight above 0.');
      return;
    }
    const plan = planSpin({ slices, rotation: previewRotation, durationMs: state.settings.durationMs });
    if (!plan) return;
    const startedAt = Date.now();
    const round = state.round + 1;
    update((draft) => {
      draft.round = round;
      draft.spin = {
        id: uid(),
        index: plan.index,
        winnerId: plan.slice.id,
        round,
        mode: draft.mode,
        items: draft.items.map(({ id, label, color, weight }) => ({ id, label, color, weight })),
        startAngle: plan.startAngle,
        endAngle: plan.endAngle,
        startedAt,
        durationMs: state.settings.durationMs,
        dismissed: false,
      };
    });
    el.result.textContent = 'Spinning…';
    el.result.dataset.tone = 'live';
    wheel.setHub('ROUND ' + String(round).padStart(2, '0'), '0.0', 'live');
    scheduleSettle();
  }

  function frame(timestamp) {
    rafId = 0;
    const state = getState();
    const spin = state.spin;
    if (!spin) {
      wheel.setHub(`${buildSlices(state.items, state.mode).slices.length} PICKS`, '—');
      return;
    }
    const now = Date.now();
    const remaining = spin.startedAt + spin.durationMs - now;

    if (remaining > 0) {
      const angle = angleAt(spin, now);
      const speed = (angle - prevAngle) / Math.max(1, timestamp - lastFrame);
      const crossed = countCrossings(spin.items ? buildSlices(spin.items, spin.mode).slices : [], prevAngle, angle);
      if (crossed > 0) kick = Math.min(1, kick + crossed * 0.4);
      kick *= 0.86;
      el.pointer.style.setProperty('--kick', `${(-kick * 9).toFixed(2)}deg`);
      prevAngle = angle;
      lastFrame = timestamp;
      previewRotation = angle;
      wheel.render(angle);
      el.clock.textContent = seconds(Math.max(0, remaining));
      el.progress.style.transform = `scaleX(${(1 - remaining / spin.durationMs).toFixed(4)})`;
      wheel.setHub('LIVE', `${(remaining / 1000).toFixed(1)}`, 'live');
      el.result.textContent = speed > 0.02 ? 'Spinning…' : 'Settling…';
      rafId = requestAnimationFrame(frame);
      return;
    }

    previewRotation = spin.endAngle;
    wheel.render(spin.endAngle);
    el.pointer.style.setProperty('--kick', '0deg');
    el.progress.style.transform = 'scaleX(1)';
    el.clock.textContent = '0.0s';
    clearSettle();
    render(getState());
  }

  function ensureFrame() {
    if (rafId) return;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function clearSettle() {
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = 0;
    }
  }

  /* A docked console can have its animation frames throttled or suspended.
     The resting state must never depend on requestAnimationFrame alone. */
  function scheduleSettle() {
    clearSettle();
    const spin = getState().spin;
    if (!spin) return;
    const remaining = spin.startedAt + spin.durationMs - Date.now();
    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      const current = getState().spin;
      if (!current || current.id !== spin.id) return;
      if (current.startedAt + current.durationMs - Date.now() > 40) {
        scheduleSettle();
        return;
      }
      previewRotation = current.endAngle;
      wheel.render(current.endAngle);
      el.pointer.style.setProperty('--kick', '0deg');
      el.progress.style.transform = 'scaleX(1)';
      el.clock.textContent = '0.0s';
      render(getState());
    }, Math.max(0, remaining) + 40);
  }

  /* ---------- events ---------- */

  for (const button of el.spins) button.addEventListener('click', doSpin);
  el.dismiss.addEventListener('click', () => {
    clearSpin();
    render(getState());
  });

  for (const button of el.modes) {
    button.addEventListener('click', () => {
      const mode = button.dataset.modeBtn;
      if (getState().mode === mode) return;
      if (getState().spin && !isDone(getState().spin)) return;
      update((draft) => {
        draft.mode = mode;
        draft.activeProfileId = null;
      });
    });
  }

  el.duration.addEventListener('input', () => {
    const ms = clamp(Number(el.duration.value) * 1000, 3000, 15000);
    el.durationLabel.textContent = seconds(ms);
    update((draft) => {
      draft.settings.durationMs = ms;
    });
  });

  root.querySelector('[data-add]').addEventListener('click', addItem);

  function setOverlayVisible(visible) {
    update((draft) => {
      draft.settings.overlayVisible = visible;
    });
  }
  el.overlayToggle.addEventListener('click', () => setOverlayVisible(!getState().settings.overlayVisible));
  el.overlaySwitch.addEventListener('change', () => setOverlayVisible(el.overlaySwitch.checked));
  el.sound.addEventListener('change', () => {
    update((draft) => {
      draft.settings.sound = el.sound.checked;
    });
  });
  el.odds.addEventListener('change', () => {
    update((draft) => {
      draft.settings.announceOdds = el.odds.checked;
    });
  });
  el.roundpick.addEventListener('change', () => {
    update((draft) => {
      draft.settings.showRoundPick = el.roundpick.checked;
    });
  });
  el.hub.addEventListener('change', () => {
    update((draft) => {
      draft.settings.showHub = el.hub.checked;
    });
  });
  el.resetRounds.addEventListener('click', () => {
    const spin = getState().spin;
    if (spin && !isDone(spin)) return;
    resetRounds();
    toast('Rounds reset. Back to round 00.');
  });
  el.banner.addEventListener('change', () => {
    update((draft) => {
      draft.settings.bannerMs = Number(el.banner.value);
    });
  });

  el.saveForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = saveProfile(el.saveName.value);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    toast(result.updated ? `Updated “${el.saveName.value.trim()}”` : `Saved “${el.saveName.value.trim()}”`);
    el.saveName.value = '';
  });

  const exportButton = root.querySelector('[data-export]');
  exportButton.addEventListener('click', () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`roulette-${stamp}.json`, exportPayload());
    toast('Exported a backup file.');
  });

  el.importInput.addEventListener('change', async () => {
    const file = el.importInput.files?.[0];
    el.importInput.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = parseImport(text);
    if (!parsed.ok) {
      toast(parsed.error);
      return;
    }
    applyImport(parsed);
    toast('Imported. Your wheel is ready.');
  });

  for (const button of root.querySelectorAll('[data-copy-url]')) {
    button.addEventListener('click', async () => {
      const ok = await copyText(overlayUrl());
      toast(ok ? 'Overlay URL copied.' : 'Could not copy — select the URL instead.');
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'SUMMARY') return;
    event.preventDefault();
    doSpin();
  });

  /* ---------- ambient status ---------- */

  if (observedUser) {
    el.env.dataset.state = 'ok';
    el.envText.textContent = `OBS ${observedUser}`;
    el.env.title = 'Running inside OBS. Docks and browser sources share this storage.';
  } else {
    el.env.dataset.state = 'warn';
    el.envText.textContent = 'Browser only';
    el.env.title = 'This page is not inside OBS. Dock it in OBS to reach the overlay.';
    el.notice.hidden = false;
  }

  function statusCheck() {
    const beat = lastBeat();
    const age = beat ? Date.now() - beat : Infinity;
    const live = age < 6000;
    el.link.dataset.state = live ? 'ok' : 'off';
    el.linkText.textContent = live ? 'Overlay live' : 'No overlay';
    el.link.title = live ? `Overlay checked in ${Math.max(1, Math.round(age / 1000))}s ago` : 'No overlay has loaded this wheel yet. Add the Browser Source.';
    el.linkSub.textContent = live ? 'Overlay linked' : 'Waiting for overlay';
  }
  statusCheck();
  window.setInterval(statusCheck, 1000);

  window.setInterval(() => {
    if (getState().spin && !isDone(getState().spin)) ensureFrame();
  }, 500);

  /* ---------- boot ---------- */

  const state = getState();
  if (state.spin) {
    previewRotation = isDone(state.spin) ? state.spin.endAngle : angleAt(state.spin, Date.now());
    prevAngle = previewRotation;
    spinId = state.spin.id;
    wheel.render(previewRotation);
    if (!isDone(state.spin)) {
      ensureFrame();
      scheduleSettle();
    }
  }
  render(state);

  subscribe((next) => {
    render(next);
    if (next.spin && next.spin.id !== spinId) {
      spinId = next.spin.id;
      prevAngle = angleAt(next.spin, Date.now());
      previewRotation = prevAngle;
      scheduleSettle();
    }
    if (next.spin && !isDone(next.spin)) ensureFrame();
    if (!next.spin) clearSettle();
  });

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    clearSettle();
  };
}
