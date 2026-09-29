/**
 * app.js — Ponto de entrada: roteamento por abas, tema e service worker.
 * Cada tela é um render(container, state).
 */

import * as store from './store.js';
import { renderPainel } from './views/painel.js';
import { renderViagens } from './views/viagens.js';
import { renderAulas } from './views/aulas.js';
import { renderAjustes } from './views/ajustes.js';
import { initDisciplineDialog } from './discipline-dialog.js';

const routes = {
  painel: renderPainel,
  viagens: renderViagens,
  aulas: renderAulas,
  ajustes: renderAjustes,
};
let currentRoute = 'painel';

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
  if (meta) meta.setAttribute('content', dark ? '#0f1116' : '#0f766e');
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
  window.scrollTo(0, 0);
  render();
}

function init() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => navigate(t.dataset.route)));
  window.addEventListener('presenca:navigate', (e) => navigate(e.detail.route));

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = store.getState().settings.theme;
    store.setSetting('theme', effectiveDark(cur) ? 'light' : 'dark');
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (store.getState().settings.theme === 'system') render();
    });
  }

  initDisciplineDialog();
  store.subscribe(render);
  render();

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
