import { weightOf } from './store.js';

export const TAU = Math.PI * 2;

export function mod(value, span) {
  return ((value % span) + span) % span;
}

export function buildSlices(items, mode) {
  const prepared = items.map((item, index) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    index,
    weight: weightOf(item, mode),
  }));
  const selectable = prepared.filter((item) => item.weight > 0);
  const total = selectable.reduce((sum, item) => sum + item.weight, 0);
  const slices = [];
  let cursor = 0;
  for (const item of selectable) {
    const angle = total > 0 ? (item.weight / total) * TAU : 0;
    const start = cursor;
    cursor += angle;
    slices.push({
      ...item,
      start,
      end: cursor,
      angle,
      mid: start + angle / 2,
      share: total > 0 ? item.weight / total : 0,
    });
  }
  return {
    slices,
    total,
    excluded: prepared.filter((item) => item.weight <= 0),
  };
}

export function pickSlice(slices, random = Math.random) {
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0);
  if (total <= 0) return -1;
  let roll = random() * total;
  for (let i = 0; i < slices.length; i += 1) {
    roll -= slices[i].weight;
    if (roll < 0) return i;
  }
  return slices.length - 1;
}

function channelToLinear(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function luminance(hex) {
  const clean = String(hex).replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

const INK_DARK = '#0b0d0f';
const INK_LIGHT = '#f6f1e6';

export function inkFor(hex) {
  const lum = luminance(hex);
  const onDark = (lum + 0.05) / 0.05;
  const onLight = 1.05 / (lum + 0.05);
  return onDark >= onLight ? INK_LIGHT : INK_DARK;
}

function sliceSignature(slices) {
  return slices.map((slice) => `${slice.id}:${slice.weight}:${slice.label}:${slice.color}`).join('|');
}

export class Wheel {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 0;
    this.dpr = 1;
    this.slices = [];
    this.labels = null;
    this.signature = '';
    this.rotation = 0;
    this.activeId = null;
    this.hub = { top: '', bottom: '', tone: 'idle' };
    this.hubVisible = true;
    this.labelFamily = '"Barlow Condensed", "Arial Narrow", sans-serif';
    this.dataFamily = '"Chivo Mono", ui-monospace, Consolas, monospace';
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement || canvas);
    this.resize();
  }

  resize() {
    const box = this.canvas.parentElement || this.canvas;
    const size = Math.max(0, Math.min(box.clientWidth, box.clientHeight));
    if (!size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (size === this.size && dpr === this.dpr) return;
    this.size = size;
    this.dpr = dpr;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.labels = null;
    this.draw();
  }

  setSlices(slices) {
    const signature = sliceSignature(slices);
    if (signature === this.signature) return;
    this.signature = signature;
    this.slices = slices;
    this.labels = null;
    this.draw();
  }

  setActive(id) {
    if (this.activeId === (id || null)) return;
    this.activeId = id || null;
    this.draw();
  }

  setHub(top, bottom, tone = 'idle') {
    if (this.hub.top === top && this.hub.bottom === bottom && this.hub.tone === tone) return;
    this.hub = { top, bottom, tone };
    this.draw();
  }

  setHubVisible(visible) {
    const next = visible !== false;
    if (this.hubVisible === next) return;
    this.hubVisible = next;
    this.draw();
  }

  render(rotation) {
    if (Number.isFinite(rotation)) this.rotation = rotation;
    this.draw();
  }

  metrics() {
    const size = this.size;
    return {
      cx: size / 2,
      cy: size / 2,
      rRim: size / 2 - 16,
      rInner: Math.max(28, size * 0.155),
      rText: Math.max(30, size * 0.155) + 10,
    };
  }

  measureLabels() {
    if (this.labels) return this.labels;
    const ctx = this.ctx;
    const { rRim, rText } = this.metrics();
    const maxLength = Math.max(24, rRim - rText - 14);
    this.labels = this.slices.map((slice) => {
      const ceiling = Math.min(26, Math.max(9, slice.angle * rText * 0.72));
      const floor = Math.min(9, ceiling);
      let size = ceiling;
      let text = slice.label;
      ctx.font = `600 ${size}px ${this.labelFamily}`;
      while (size > floor && ctx.measureText(text).width > maxLength) {
        size -= 0.5;
        ctx.font = `600 ${size}px ${this.labelFamily}`;
      }
      if (ctx.measureText(text).width > maxLength) {
        const chars = [...text];
        while (chars.length > 1 && ctx.measureText(`${chars.join('').trimEnd()}…`).width > maxLength) {
          chars.pop();
        }
        text = `${chars.join('').trimEnd()}…`;
      }
      return { text, size, color: inkFor(slice.color) };
    });
    return this.labels;
  }

  draw() {
    const { ctx, size } = this;
    if (!size) return;
    const { cx, cy, rRim, rInner, rText } = this.metrics();
    const rotation = this.rotation;
    const toScreen = (angle) => angle + rotation - Math.PI / 2;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (!this.slices.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(237, 232, 221, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, rRim, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // slices
    ctx.save();
    ctx.beginPath();
    for (const slice of this.slices) {
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rRim, toScreen(slice.start), toScreen(slice.end));
      ctx.closePath();
    }
    ctx.clip();
    for (const slice of this.slices) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rRim + 1, toScreen(slice.start), toScreen(slice.end));
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
    }
    ctx.restore();

    // seams
    ctx.save();
    ctx.strokeStyle = 'rgba(7, 8, 10, 0.55)';
    ctx.lineWidth = 2;
    for (const slice of this.slices) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(toScreen(slice.start)) * rInner * 0.9, cy + Math.sin(toScreen(slice.start)) * rInner * 0.9);
      ctx.lineTo(cx + Math.cos(toScreen(slice.start)) * rRim, cy + Math.sin(toScreen(slice.start)) * rRim);
      ctx.stroke();
    }
    ctx.restore();

    // labels
    const labels = this.measureLabels();
    ctx.save();
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.slices.length; i += 1) {
      const slice = this.slices[i];
      const label = labels[i];
      const flip = Math.sin(slice.mid) < 0;
      const angle = toScreen(slice.mid) + (flip ? Math.PI : 0);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.font = `600 ${label.size}px ${this.labelFamily}`;
      ctx.fillStyle = label.color;
      ctx.textAlign = flip ? 'left' : 'right';
      ctx.globalAlpha = 0.94;
      ctx.fillText(label.text, flip ? -(rRim - 12) : rRim - 12, 0);
      ctx.restore();
    }
    ctx.restore();

    // rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rRim, 0, TAU);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(10, 12, 14, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.max(10, size * 0.035);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rRim - 1, 0, TAU);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(246, 241, 230, 0.28)';
    ctx.stroke();
    ctx.restore();

    // pegs at each boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(246, 241, 230, 0.75)';
    ctx.lineWidth = Math.max(1.5, size * 0.005);
    ctx.lineCap = 'round';
    for (const slice of this.slices) {
      const a = toScreen(slice.start);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (rRim + 1), cy + Math.sin(a) * (rRim + 1));
      ctx.lineTo(cx + Math.cos(a) * (rRim + size * 0.024), cy + Math.sin(a) * (rRim + size * 0.024));
      ctx.stroke();
    }
    ctx.restore();

    // winner outline
    if (this.activeId) {
      const winner = this.slices.find((slice) => slice.id === this.activeId);
      if (winner) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rRim - 3, toScreen(winner.start) + 0.01, toScreen(winner.end) - 0.01);
        ctx.lineWidth = Math.max(2, size * 0.009);
        ctx.strokeStyle = '#f6f1e6';
        ctx.stroke();
        ctx.restore();
      }
    }

    // hub
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, TAU);
    ctx.fillStyle = '#0b0d0f';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(246, 241, 230, 0.22)';
    ctx.stroke();
    ctx.restore();

    if (this.hubVisible && (this.hub.top || this.hub.bottom)) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.hub.tone === 'live' ? '#ffb42e' : 'rgba(246, 241, 230, 0.55)';
      ctx.font = `500 ${Math.max(8, rInner * 0.16)}px ${this.dataFamily}`;
      ctx.fillText(this.hub.top, cx, cy - rInner * 0.26);
      ctx.fillStyle = this.hub.tone === 'live' ? '#ffb42e' : '#f6f1e6';
      ctx.font = `600 ${Math.max(12, rInner * 0.42)}px ${this.dataFamily}`;
      ctx.fillText(this.hub.bottom, cx, cy + rInner * 0.16);
      ctx.restore();
    }
  }
}
