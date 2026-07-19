/** views/stats.js — Tela "Estatísticas": resumo, mapa de calor, streaks e barras. */

import * as store from '../store.js';
import { escapeHtml } from '../dom.js';
import { heatmapSVG, weekdayBars } from '../charts.js';
import {
  currentStreak, bestStreak, adherence, totalChecks,
  heatmap, byWeekday, weekdayLabels,
} from '../model.js';

const HEAT_WEEKS = 14;
const BAR_WEEKS = 8;

export function renderStats(container, state) {
  const habits = store.activeHabits();
  const ws = state.settings.weekStart;
  const now = new Date();

  if (!habits.length) {
    container.innerHTML = `<div class="empty"><div class="emoji">📊</div><h2>Sem estatísticas ainda</h2><p>Quando você criar hábitos e começar os check-ins, o progresso aparece aqui.</p></div>`;
    return;
  }

  // Cartões de resumo geral.
  const totalAll = habits.reduce((s, h) => s + totalChecks(state.checkins, h.id), 0);
  let bestStreakVal = 0;
  let bestStreakHabit = null;
  for (const h of habits) {
    const s = currentStreak(h, state.checkins, now, ws);
    if (s > bestStreakVal) { bestStreakVal = s; bestStreakHabit = h; }
  }
  const avgAdh = Math.round(
    (habits.reduce((s, h) => s + adherence(h, state.checkins, 30, now), 0) / habits.length) * 100,
  );

  const summary = `
    <div class="summary-grid">
      <div class="summary-card"><div class="big">${totalAll}</div><div class="lbl">check-ins no total</div></div>
      <div class="summary-card"><div class="big">${bestStreakVal}${bestStreakHabit ? ' ' + escapeHtml(bestStreakHabit.emoji) : ''}</div><div class="lbl">maior sequência atual</div></div>
      <div class="summary-card"><div class="big">${avgAdh}%</div><div class="lbl">adesão (30 dias)</div></div>
    </div>`;

  const cards = habits.map((h) => {
    const cur = currentStreak(h, state.checkins, now, ws);
    const best = bestStreak(h, state.checkins, ws);
    const adh = Math.round(adherence(h, state.checkins, 30, now) * 100);
    const grid = heatmap(h, state.checkins, HEAT_WEEKS, now, ws);
    const bars = byWeekday(h, state.checkins, BAR_WEEKS, now, ws);
    return `
    <div class="stat-habit" style="--hc:${h.color}">
      <div class="stat-habit-head">
        <span class="e">${escapeHtml(h.emoji)}</span>
        <span class="nm">${escapeHtml(h.name)}</span>
      </div>
      <div class="stat-metrics">
        <div class="metric"><div class="v">🔥 ${cur}</div><div class="k">sequência atual</div></div>
        <div class="metric"><div class="v">🏆 ${best}</div><div class="k">recorde</div></div>
        <div class="metric"><div class="v">${adh}%</div><div class="k">adesão 30d</div></div>
      </div>
      <div class="chart-label">Últimas ${HEAT_WEEKS} semanas</div>
      <div class="heatmap-wrap">${heatmapSVG(grid, h.color)}</div>
      <div class="chart-label">Conclusões por dia da semana</div>
      ${weekdayBars(bars, weekdayLabels(ws), h.color)}
    </div>`;
  }).join('');

  container.innerHTML = summary + cards;
}
