import { getState, subscribe } from './store.js';
import { Wheel, buildSlices } from './wheel.js';
import { angleAt, countCrossings, isDone } from './spin.js';
import { armAudio, audioState, chime, tick, thunk } from './audio.js';
import { beat, inOBS, pct } from './ui.js';

const TEMPLATE = `
<div class="overlay" data-root>
  <div class="overlay__stage">
    <div class="wheel-frame wheel-frame--overlay">
      <canvas data-wheel role="img" aria-label="Prize wheel"></canvas>
      <div class="pointer" data-pointer aria-hidden="true">
        <svg viewBox="0 0 28 38">
          <rect x="10" y="0" width="8" height="14" rx="2" fill="#ffb42e" stroke="#0b0d0f" stroke-width="2"/>
          <path d="M14 37 3 13h22Z" fill="#ffb42e" stroke="#0b0d0f" stroke-width="2"/>
        </svg>
      </div>
    </div>
  </div>

  <div class="winner" data-winner hidden>
    <div class="winner__rule" aria-hidden="true"><span data-winner-timer></span></div>
    <div class="winner__head">
      <span class="winner__tag">Winner</span>
      <span class="winner__round mono" data-winner-round></span>
    </div>
    <p class="winner__label" data-winner-label></p>
    <p class="winner__meta mono" data-winner-meta><span data-winner-pct></span><span data-winner-sub></span></p>
  </div>

  <button class="audio-chip" type="button" data-audio hidden>Click for sound</button>
</div>
`;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mount(root) {
  root.innerHTML = TEMPLATE;

  const el = {
    root: root.querySelector('[data-root]'),
    wheel: root.querySelector('[data-wheel]'),
    pointer: root.querySelector('[data-pointer]'),
    winner: root.querySelector('[data-winner]'),
    winnerRound: root.querySelector('[data-winner-round]'),
    winnerLabel: root.querySelector('[data-winner-label]'),
    winnerPct: root.querySelector('[data-winner-pct]'),
    winnerSub: root.querySelector('[data-winner-sub]'),
    winnerTimer: root.querySelector('[data-winner-timer]'),
    winnerMeta: root.querySelector('[data-winner-meta]'),
    audio: root.querySelector('[data-audio]'),
  };

  document.documentElement.classList.add('is-overlay');
  document.body.classList.add('is-overlay');

  const wheel = new Wheel(el.wheel);

  let spinId = null;
  let rotation = 0;
  let prevRotation = 0;
  let rafId = 0;
  let settleTimer = 0;
  let kick = 0;
  let hideTimer = 0;
  let winnerSpinId = null;
  let autoHidden = null;
  let chimeFired = false;

  /* ---------- audio ---------- */

  function refreshAudioChip() {
    const state = getState();
    const needsGesture = state.settings.sound && audioState() !== 'running' && !inOBS();
    el.audio.hidden = !needsGesture;
  }

  async function tryArm() {
    if (!getState().settings.sound) return;
    await armAudio();
    refreshAudioChip();
  }

  el.audio.addEventListener('click', async () => {
    await tryArm();
    el.audio.hidden = true;
  });
  window.addEventListener('pointerdown', tryArm, { once: true });

  /* ---------- winner ---------- */

  function clearHideTimer() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = 0;
    }
  }

  function hideWinner() {
    clearHideTimer();
    el.winner.classList.remove('is-shown');
    el.winner.hidden = true;
    winnerSpinId = null;
  }

  function showWinner(spin) {
    if (autoHidden === spin.id) return;
    const state = getState();
    const winner = spin.items.find((item) => item.id === spin.winnerId) || spin.items[spin.index];
    if (!winner) return;
    const snapshot = buildSlices(spin.items, spin.mode).slices;
    const slice = snapshot.find((entry) => entry.id === spin.winnerId);
    const share = slice ? slice.share : 0;
    const sliceIndex = slice ? snapshot.indexOf(slice) + 1 : spin.index + 1;
    const showRoundPick = state.settings.showRoundPick !== false;
    const showOdds = state.settings.announceOdds !== false;

    el.winnerRound.textContent = `Round ${String(spin.round).padStart(2, '0')}`;
    el.winnerRound.hidden = !showRoundPick;
    el.winnerPct.textContent = showOdds ? pct(share) : '';
    el.winnerSub.textContent = showRoundPick ? `Pick ${sliceIndex} of ${snapshot.length}` : '';
    el.winnerSub.hidden = !showRoundPick;
    el.winnerMeta.hidden = !showRoundPick && !showOdds;

    if (winnerSpinId !== spin.id || el.winner.hidden) {
      el.winnerLabel.textContent = winner.label;
      el.winner.hidden = false;
      el.winner.dataset.tone = 'won';
      const holdMs = state.settings.bannerMs;
      el.winnerTimer.style.animation = 'none';
      void el.winner.offsetWidth;
      el.winnerTimer.style.animation = holdMs > 0 ? `banner-timer ${holdMs}ms linear forwards` : 'none';
      void el.winner.offsetWidth;
      el.winner.classList.add('is-shown');
      winnerSpinId = spin.id;
    }

    clearHideTimer();
    const holdMs = state.settings.bannerMs;
    if (holdMs <= 0) return;
    const endsAt = spin.startedAt + spin.durationMs;
    const remaining = endsAt + holdMs - Date.now();
    if (remaining <= 0) {
      autoHidden = spin.id;
      hideWinner();
    } else {
      hideTimer = window.setTimeout(() => {
        autoHidden = spin.id;
        hideWinner();
      }, remaining);
    }
  }

  /* ---------- spin ---------- */

  function pointerKick(amount) {
    kick = Math.min(1, kick + amount);
  }

  function finishSpin(spin, state) {
    rotation = spin.endAngle;
    prevRotation = rotation;
    wheel.setActive(spin.winnerId);
    wheel.render(rotation);
    el.pointer.style.setProperty('--kick', '0deg');
    wheel.setHub(`ROUND ${String(spin.round).padStart(2, '0')}`, '—');
    if (!chimeFired && state.settings.sound) {
      chimeFired = true;
      chime();
    }
    showWinner(spin);
  }

  function loop(timestamp) {
    rafId = 0;
    const state = getState();
    const spin = state.spin;
    if (!spin || spin.dismissed) {
      el.pointer.style.setProperty('--kick', '0deg');
      return;
    }
    const now = Date.now();
    const remaining = spin.startedAt + spin.durationMs - now;

    if (remaining > 0) {
      const angle = angleAt(spin, now);
      const snapshot = buildSlices(spin.items, spin.mode).slices;
      const crossed = countCrossings(snapshot, prevRotation, angle);
      if (crossed > 0) {
        pointerKick(Math.min(1, crossed * 0.45));
        if (state.settings.sound && !reducedMotion) tick(Math.min(1, crossed * 0.4 + 0.2));
      }
      kick *= 0.84;
      el.pointer.style.setProperty('--kick', `${(-kick * 10).toFixed(2)}deg`);
      rotation = angle;
      prevRotation = angle;
      wheel.setHub('LIVE', `${(remaining / 1000).toFixed(1)}`, 'live');
      wheel.render(angle);
      rafId = requestAnimationFrame(loop);
      return;
    }

    clearSettle();
    finishSpin(spin, state);
  }

  function startLoop() {
    if (rafId) return;
    rafId = requestAnimationFrame(loop);
  }

  function clearSettle() {
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = 0;
    }
  }

  /* Browser sources can be throttled while a scene is not shown. The resting
     state has to arrive on a timer even if animation frames stop. */
  function scheduleSettle(spin) {
    clearSettle();
    const remaining = spin.startedAt + spin.durationMs - Date.now();
    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      const state = getState();
      const current = state.spin;
      if (!current || current.id !== spin.id || spin.dismissed) return;
      if (!isDone(current)) {
        ensureLoop();
        scheduleSettle(current);
        return;
      }
      finishSpin(current, state);
    }, Math.max(0, remaining) + 40);
  }

  function ensureLoop() {
    startLoop();
  }

  function sync(state, isFirst) {
    const { slices } = buildSlices(state.items, state.mode);
    wheel.setSlices(slices);
    wheel.setHubVisible(state.settings.showHub);
    el.root.classList.toggle('is-hidden', !state.settings.overlayVisible);
    el.root.classList.toggle('is-empty', slices.length === 0);
    refreshAudioChip();

    const spin = state.spin;

    if (!spin) {
      if (!isFirst) {
        wheel.setActive(null);
        wheel.setHub(`${slices.length} PICKS`, '—');
      }
      hideWinner();
      spinId = null;
      clearSettle();
      return;
    }

    wheel.setActive(isDone(spin) ? spin.winnerId : null);

    if (spin.id !== spinId) {
      spinId = spin.id;
      chimeFired = false;
      autoHidden = null;
      hideWinner();
      if (isDone(spin)) {
        clearSettle();
        rotation = spin.endAngle;
        prevRotation = rotation;
        wheel.render(rotation);
        wheel.setHub(`ROUND ${String(spin.round).padStart(2, '0')}`, '—');
        if (spin.dismissed) hideWinner();
        else showWinner(spin);
      } else {
        rotation = angleAt(spin, Date.now());
        prevRotation = rotation;
        wheel.render(rotation);
        if (state.settings.sound) {
          thunk();
          tryArm();
        }
        startLoop();
        scheduleSettle(spin);
      }
      return;
    }

    if (spin.dismissed) {
      hideWinner();
      clearSettle();
      return;
    }

    if (isDone(spin)) {
      if (!rafId) {
        rotation = spin.endAngle;
        wheel.render(rotation);
      }
      showWinner(spin);
    } else {
      startLoop();
      scheduleSettle(spin);
    }
  }

  /* The dashboard can flip the overlay off while a spin runs; the loop keeps
     the state honest and the banner is re-evaluated when it comes back. */
  sync(getState(), true);

  subscribe((state) => sync(state, false));

  window.setInterval(beat, 2000);
  beat();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      wheel.render(rotation);
      tryArm();
    });
  }
  tryArm();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    clearHideTimer();
    clearSettle();
  };
}
