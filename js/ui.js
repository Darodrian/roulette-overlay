const TOAST_MS = 4200;

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function pct(share, digits = 1) {
  return `${(share * 100).toFixed(digits)}%`;
}

export function signedPct(delta, digits = 1) {
  const value = delta * 100;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

export function seconds(ms, digits = 1) {
  return `${(ms / 1000).toFixed(digits)}s`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function toast(message, options = {}) {
  const host = document.querySelector('[data-toasts]');
  if (!host) return;
  const node = h('div', { class: 'toast', role: 'status' });
  node.append(h('span', {}, message));
  if (options.actionLabel && typeof options.onAction === 'function') {
    const action = h('button', { class: 'toast__action', type: 'button' }, options.actionLabel);
    action.addEventListener('click', () => {
      options.onAction();
      dismiss();
    });
    node.append(action);
  }
  host.append(node);
  let closed = false;
  const dismiss = () => {
    if (closed) return;
    closed = true;
    node.dataset.leaving = 'true';
    window.setTimeout(() => node.remove(), 180);
  };
  window.setTimeout(dismiss, options.duration || TOAST_MS);
  return dismiss;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const HEARTBEAT_KEY = 'roulette-overlay/beat';

export function beat() {
  try {
    window.localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
  } catch {
    /* private mode or quota */
  }
}

export function lastBeat() {
  try {
    return Number(window.localStorage.getItem(HEARTBEAT_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function inOBS() {
  const match = /OBS\/([\d.]+)/.exec(navigator.userAgent);
  return match ? match[1] : null;
}

export const ICONS = {
  up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5 3.5 9h9L8 3.5Z" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5 12.5 7h-9l4.5 5.5Z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.6"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="7" height="7" rx="1" stroke="currentColor" fill="none"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" stroke="currentColor" fill="none"/></svg>',
  external: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3h4v4M13 3 6.5 9.5M11 10.5V13H3V5h2.5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
};
