import { mount as mountDashboard } from './dashboard.js';
import { mount as mountOverlay } from './overlay.js';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') === 'overlay' ? 'overlay' : 'dashboard';
const app = document.getElementById('app');

document.body.dataset.view = view;

if (view === 'overlay') {
  document.title = 'Roulette — overlay';
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

if (app) {
  if (view === 'overlay') mountOverlay(app);
  else mountDashboard(app);
}
