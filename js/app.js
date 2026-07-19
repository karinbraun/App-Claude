/**
 * app.js — Ponto de entrada: roteamento por abas, tema, service worker e lembretes.
 * É o único módulo que orquestra as telas; cada tela é um render(container, state).
 */

import * as store from './store.js';
import { renderToday } from './views/today.js';
import { renderWeek } from './views/week.js';
import { renderStats } from './views/stats.js';
import { renderHabits } from './views/habits.js';
import { startReminderLoop } from './notifications.js';

const routes = {
  hoje: renderToday,
  semana: renderWeek,
  stats: renderStats,
  habitos: renderHabits,
};
let currentRoute = 'hoje';

const viewEl = () => document.getElementById('view');

function effectiveDark(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');

  const dark = effectiveDark(theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f1116' : '#6d5efc');
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.textContent = dark ? '☀️' : '🌙';
}

function render() {
  const state = store.getState();
  applyTheme(state.settings.theme);
  routes[currentRoute](viewEl(), state);
  document.querySelectorAll('.tab').forEach((t) => {
    const active = t.dataset.route === currentRoute;
    t.classList.toggle('active', active);
    t.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function navigate(route) {
  if (!routes[route]) return;
  currentRoute = route;
  viewEl().scrollTop = 0;
  render();
}

function init() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => navigate(t.dataset.route)));

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = store.getState().settings.theme;
    store.setSetting('theme', effectiveDark(cur) ? 'light' : 'dark');
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (store.getState().settings.theme === 'system') render();
    });
  }

  store.subscribe(render);
  render();

  startReminderLoop(() => store.activeHabits(), () => store.getState().checkins);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker não registrado:', e));
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
