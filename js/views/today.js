/** views/today.js — Tela "Hoje": check-in de vários hábitos ao mesmo tempo. */

import * as store from '../store.js';
import { escapeHtml, toast } from '../dom.js';
import { progressRing } from '../charts.js';
import { openHabitDialog } from '../habit-dialog.js';
import { SUGGESTED_HABITS } from '../constants.js';
import { todayKey, isChecked, currentStreak, weeklyProgress, formatLongDate } from '../model.js';

export function renderToday(container, state) {
  const habits = store.activeHabits();
  const now = new Date();
  const tk = todayKey(now);
  const ws = state.settings.weekStart;

  if (!habits.length) {
    container.innerHTML = emptyState();
    wireEmpty(container);
    return;
  }

  const doneCount = habits.filter((h) => isChecked(state.checkins, h.id, tk)).length;
  const total = habits.length;
  const allDone = doneCount === total;

  const rows = habits.map((h) => {
    const done = isChecked(state.checkins, h.id, tk);
    const streak = currentStreak(h, state.checkins, now, ws);
    const sub = h.goalType === 'weekly'
      ? `<span class="goal-pill">${weeklyProgress(h, state.checkins, now, ws).done}/${h.goalTarget} na semana</span>`
      : '<span class="goal-pill">todo dia</span>';
    const streakBadge = streak > 0
      ? `<span class="streak-badge">🔥 ${streak} ${h.goalType === 'weekly' ? (streak === 1 ? 'sem' : 'sem') : (streak === 1 ? 'dia' : 'dias')}</span>`
      : '<span class="streak-badge cold">comece hoje</span>';
    return `
    <div class="habit-row ${done ? 'done' : ''}" style="--hc:${h.color}">
      <div class="habit-emoji">${escapeHtml(h.emoji)}</div>
      <div class="habit-info">
        <div class="habit-name">${escapeHtml(h.name)}</div>
        <div class="habit-sub">${streakBadge} ${sub}</div>
      </div>
      <button class="check-btn ${done ? 'checked' : ''}" style="--hc:${h.color}"
        data-toggle="${h.id}" aria-pressed="${done}" aria-label="Marcar ${escapeHtml(h.name)} como feito hoje"></button>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="today-head">
      <div class="today-date">
        <div class="weekday">${formatLongDate(now)}</div>
        <div class="subtitle">${allDone ? 'Tudo certo por hoje! 🎉' : `Faltam ${total - doneCount} de ${total}`}</div>
      </div>
      ${progressRing(doneCount, total)}
    </div>
    <div class="list-actions">
      <span class="count">${doneCount} de ${total} concluídos hoje</span>
    </div>
    <div class="habit-list">${rows}</div>
    <button class="btn-check-all" data-check-all ${allDone ? 'disabled' : ''}>
      ${allDone ? 'Todos concluídos ✓' : 'Marcar todos como feitos'}
    </button>
  `;

  container.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => store.toggleCheck(btn.dataset.toggle, tk));
  });
  const all = container.querySelector('[data-check-all]');
  if (all) all.addEventListener('click', () => { if (!all.disabled) store.checkAll(tk); });
}

function emptyState() {
  const chips = SUGGESTED_HABITS
    .map((s, i) => `<button class="suggestion" data-suggest="${i}">${s.emoji} ${escapeHtml(s.name)}</button>`)
    .join('');
  return `
    <div class="empty">
      <div class="emoji">🌱</div>
      <h2>Comece a construir constância</h2>
      <p>Crie seus hábitos e acompanhe o check-in de todos ao mesmo tempo, todo dia.</p>
      <div class="suggestions">${chips}</div>
      <p class="note" style="margin-top:16px">Toque numa sugestão para adicionar, ou crie o seu:</p>
      <button class="add-habit-btn" data-new style="max-width:280px;margin:6px auto 0">+ Criar hábito</button>
    </div>`;
}

function wireEmpty(container) {
  container.querySelectorAll('[data-suggest]').forEach((b) => {
    b.addEventListener('click', () => {
      const s = SUGGESTED_HABITS[Number(b.dataset.suggest)];
      if (s) {
        store.addHabit(s);
        toast(`${s.emoji} ${s.name} adicionado`);
      }
    });
  });
  const nw = container.querySelector('[data-new]');
  if (nw) nw.addEventListener('click', () => openHabitDialog());
}
