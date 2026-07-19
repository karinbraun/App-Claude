/** views/week.js — Grade "Semana": hábitos × 7 dias, marca vários dias/hábitos. */

import * as store from '../store.js';
import { escapeHtml } from '../dom.js';
import {
  startOfWeek, addDays, dateKey, weekDays, isChecked, todayKey,
  weekdayLabels, formatShortDate,
} from '../model.js';

// Estado local da tela: 0 = semana atual, -1 = anterior, etc.
let weekOffset = 0;

export function renderWeek(container, state) {
  const habits = store.activeHabits();
  const ws = state.settings.weekStart;
  const now = new Date();
  const base = addDays(startOfWeek(now, ws), weekOffset * 7);
  const days = weekDays(base, ws);
  const tk = todayKey(now);
  const labels = weekdayLabels(ws);

  if (!habits.length) {
    container.innerHTML = `<div class="empty"><div class="emoji">🗓️</div><h2>Nenhum hábito ainda</h2><p>Crie hábitos na aba Hábitos para preencher a grade da semana.</p></div>`;
    return;
  }

  const head = days.map((d, i) => {
    const isToday = dateKey(d) === tk;
    return `<th class="${isToday ? 'today' : ''}"><span class="dow">${labels[i]}</span><span class="dnum">${d.getDate()}</span></th>`;
  }).join('');

  const rows = habits.map((h) => {
    const cells = days.map((d) => {
      const key = dateKey(d);
      const future = key > tk;
      const on = isChecked(state.checkins, h.id, key);
      const style = on ? `--hc:${h.color};background:${h.color};border-color:${h.color}` : `--hc:${h.color}`;
      return `<td><button class="wk-cell ${on ? 'checked' : ''}" style="${style}"
        data-habit="${h.id}" data-key="${key}" ${future ? 'disabled' : ''}
        aria-pressed="${on}" aria-label="${escapeHtml(h.name)}, ${key}"></button></td>`;
    }).join('');
    return `<tr>
      <td class="habit-col"><div class="week-cell-label"><span class="e">${escapeHtml(h.emoji)}</span><span>${escapeHtml(h.name)}</span></div></td>
      ${cells}
    </tr>`;
  }).join('');

  const range = `${formatShortDate(days[0])} – ${formatShortDate(days[6])}`;
  container.innerHTML = `
    <div class="week-nav">
      <button data-week="-1" aria-label="Semana anterior">‹</button>
      <span class="range">${weekOffset === 0 ? 'Esta semana' : range}</span>
      <button data-week="1" ${weekOffset >= 0 ? 'disabled' : ''} aria-label="Próxima semana">›</button>
    </div>
    <div class="week-scroll">
      <table class="week-grid">
        <thead><tr><th class="habit-col"></th>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="note">Toque em qualquer dia para marcar ou desmarcar — dá para preencher dias passados também.</p>
  `;

  container.querySelectorAll('[data-week]').forEach((b) => b.addEventListener('click', () => {
    const dir = Number(b.dataset.week);
    if (dir > 0 && weekOffset >= 0) return;
    weekOffset += dir;
    renderWeek(container, store.getState());
  }));
  container.querySelectorAll('.wk-cell').forEach((b) => b.addEventListener('click', () => {
    if (b.disabled) return;
    store.toggleCheck(b.dataset.habit, b.dataset.key);
  }));
}
