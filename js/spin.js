import { TAU, mod, pickSlice } from './wheel.js';

export const easeOut = (t) => 1 - Math.pow(1 - t, 4);

export function planSpin({ slices, rotation, durationMs, random = Math.random }) {
  if (!slices.length) return null;
  const index = pickSlice(slices, random);
  if (index < 0) return null;
  const slice = slices[index];
  const turns = 4 + Math.floor(random() * 3);
  const offset = (random() * 2 - 1) * slice.angle * 0.3;
  const desired = mod(-(slice.mid + offset), TAU);
  const current = mod(rotation, TAU);
  const delta = mod(desired - current, TAU);
  return {
    index,
    slice,
    startAngle: rotation,
    endAngle: rotation + turns * TAU + delta,
    durationMs,
  };
}

export function progressAt(spin, now = Date.now()) {
  if (!spin) return 0;
  const raw = (now - spin.startedAt) / spin.durationMs;
  return Math.min(1, Math.max(0, raw));
}

export function angleAt(spin, now = Date.now()) {
  if (!spin) return 0;
  const t = progressAt(spin, now);
  return spin.startAngle + (spin.endAngle - spin.startAngle) * easeOut(t);
}

export function isDone(spin, now = Date.now()) {
  return progressAt(spin, now) >= 1;
}

export function endsAt(spin) {
  return spin ? spin.startedAt + spin.durationMs : 0;
}

/* How many slice boundaries the pointer swept between two wheel rotations.
   Boundaries sit at (sliceStart + k * TAU) in screen space, so each slice
   contributes the integer multiples of a full turn that fall in the span. */
export function countCrossings(slices, fromRotation, toRotation) {
  if (!(toRotation > fromRotation)) return 0;
  let count = 0;
  for (const slice of slices) {
    count += Math.floor((toRotation - slice.start) / TAU) - Math.floor((fromRotation - slice.start) / TAU);
  }
  return count;
}
