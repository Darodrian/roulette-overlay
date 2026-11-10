let ctx = null;
let master = null;
let lastTickAt = 0;

const TICK_MIN_GAP = 34;

function ensure() {
  if (ctx) return ctx;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  try {
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function audioState() {
  return ctx ? ctx.state : 'idle';
}

export async function armAudio() {
  const audio = ensure();
  if (!audio) return 'unsupported';
  if (audio.state === 'suspended') {
    try {
      await audio.resume();
    } catch {
      /* the browser still wants a gesture */
    }
  }
  return audio.state;
}

function blip(type, frequency, at, duration, gainValue) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainValue, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function tick(intensity = 0.5) {
  if (audioState() !== 'running') return;
  const now = performance.now();
  if (now - lastTickAt < TICK_MIN_GAP) return;
  lastTickAt = now;
  const at = ctx.currentTime;
  const freq = 1250 + intensity * 900;
  blip('triangle', freq, at, 0.045, 0.06 + intensity * 0.05);
  blip('sine', freq * 0.5, at, 0.03, 0.03);
}

export function chime() {
  if (audioState() !== 'running') return;
  const start = ctx.currentTime + 0.02;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((frequency, index) => {
    const at = start + index * 0.085;
    blip('triangle', frequency, at, 0.7, 0.12);
    blip('sine', frequency * 2, at, 0.35, 0.04);
  });
}

export function thunk() {
  if (audioState() !== 'running') return;
  const at = ctx.currentTime;
  blip('sine', 130, at, 0.18, 0.16);
  blip('triangle', 78, at, 0.28, 0.1);
}
