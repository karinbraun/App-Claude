/**
 * aulas.js — Lista das aulas geradas, mês a mês, para registrar faltas
 * (totais ou parciais). Aulas dentro de viagens aparecem sinalizadas.
 */

import * as m from '../model.js';
import * as store from '../store.js';
import { escapeHtml } from '../dom.js';

// Mês exibido ('YYYY-MM') e filtro de disciplina; persistem entre renderizações.
let month = null;
let filter = '';

function clampMonth(state) {
  const { start, end } = state.semester;
  const cur = m.todayKey().slice(0, 7);
  if (!month) month = cur;
  if (start && month < start.slice(0, 7)) month = start.slice(0, 7);
  if (end && month > end.slice(0, 7)) month = end.slice(0, 7);
}

function shiftMonth(key, n) {
  const [y, mo] = key.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${m.pad2(d.getMonth() + 1)}`;
}

function absenceSelect(s, registered) {
  const max = Math.max(s.hours, registered);
  const opts = ['<option value="0">Presente</option>'];
  for (let h = 1; h <= max; h++) {
    const label = h === s.hours ? `Faltei (${h}h)` : `Faltei ${h}h de ${s.hours}h`;
    opts.push(`<option value="${h}" ${h === registered ? 'selected' : ''}>${label}</option>`);
  }
  return `<select class="abs-select ${registered ? 'on' : ''}" data-d="${s.disciplineId}" data-date="${s.date}"
            aria-label="Falta em ${m.fmtDateLong(s.date)}">${opts.join('')}</select>`;
}

export function renderAulas(container, state) {
  if (!state.semester.start || !state.semester.end || !state.disciplines.length) {
    container.innerHTML = '<p class="warn">Configure o semestre e as disciplinas em Ajustes para gerar as aulas.</p>';
    return;
  }
  clampMonth(state);
  const today = m.todayKey();
  const byId = new Map(state.disciplines.map((d) => [d.id, d]));
  if (filter && !byId.has(filter)) filter = '';

  const all = m.generateSessions(state);
  const tripAbs = m.tripAbsenceSessions(all, state.trips, state.absences);
  const inTrip = new Set();
  for (const t of state.trips) for (const s of m.sessionsInTrip(all, t)) inTrip.add(s.key);

  const sessions = all.filter((s) => s.date.startsWith(month) && (!filter || s.disciplineId === filter));
  const holidays = state.holidays.filter((h) => h.start.slice(0, 7) <= month && h.end.slice(0, 7) >= month);

  // Faltas registradas em datas que não têm aula (ex.: a grade mudou depois).
  const sessionKeys = new Set(all.map((s) => s.key));
  const orphans = [];
  for (const [did, map] of Object.entries(state.absences)) {
    if (!byId.has(did) || (filter && did !== filter)) continue;
    for (const [date, h] of Object.entries(map)) if (!sessionKeys.has(m.sessionKey(did, date))) orphans.push({ did, date, h });
  }

  const groups = new Map();
  for (const s of sessions) {
    if (!groups.has(s.date)) groups.set(s.date, []);
    groups.get(s.date).push(s);
  }

  const [y, mo] = month.split('-').map(Number);
  const canPrev = month > state.semester.start.slice(0, 7);
  const canNext = month < state.semester.end.slice(0, 7);

  container.innerHTML = `
    <div class="month-nav">
      <button type="button" id="m-prev" aria-label="Mês anterior" ${canPrev ? '' : 'disabled'}>‹</button>
      <span class="range">${m.MONTHS_LONG[mo - 1]} ${y}</span>
      <button type="button" id="m-next" aria-label="Próximo mês" ${canNext ? '' : 'disabled'}>›</button>
    </div>
    <label class="filter">
      <span class="sr-only">Disciplina</span>
      <select id="m-filter">
        <option value="">Todas as disciplinas</option>
        ${state.disciplines.map((d) => `<option value="${d.id}" ${d.id === filter ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
      </select>
    </label>
    ${holidays.length ? `<p class="muted small holi">Sem aula: ${holidays.map((h) => `${escapeHtml(h.name || 'feriado')} (${m.fmtRange(h.start, h.end)})`).join(' · ')}</p>` : ''}
    ${groups.size ? `<div class="day-list">
      ${[...groups.entries()].map(([date, list]) => `
        <section class="day ${date === today ? 'today' : ''} ${date < today ? 'past' : ''}">
          <h3 class="day-head">${m.fmtDateLong(date)}${date === today ? ' · hoje' : ''}</h3>
          ${list.map((s) => {
            const d = byId.get(s.disciplineId);
            const reg = m.registeredHours(state.absences, s.disciplineId, s.date);
            let tag = '';
            if (inTrip.has(s.key)) {
              tag = tripAbs.has(s.key)
                ? '<span class="tag trip">viagem · falta prevista</span>'
                : reg ? '<span class="tag trip">viagem</span>' : '<span class="tag">viagem · vou assistir</span>';
            }
            return `
              <div class="class-row" style="--dc:${d.color}">
                <span class="dot" aria-hidden="true"></span>
                <div class="class-info">
                  <div class="class-name">${escapeHtml(d.name)}</div>
                  <div class="muted small">${m.fmtHours(s.hours)}${s.extra ? ' · reposição' : ''} ${tag}</div>
                </div>
                ${absenceSelect(s, reg)}
              </div>`;
          }).join('')}
        </section>`).join('')}
    </div>` : '<p class="muted small">Nenhuma aula neste mês.</p>'}
    ${orphans.length ? `
      <div class="card notice">
        <p>Faltas registradas em datas sem aula no calendário atual (continuam contando):</p>
        <ul class="orphans">${orphans.map((o) => `<li>${escapeHtml(byId.get(o.did).name)} · ${m.fmtDateLong(o.date)} · ${m.fmtHours(o.h)}
          <button class="link-btn" type="button" data-rm="${o.did}|${o.date}">remover</button></li>`).join('')}</ul>
      </div>` : ''}`;

  container.querySelector('#m-prev').addEventListener('click', () => { month = shiftMonth(month, -1); renderAulas(container, store.getState()); });
  container.querySelector('#m-next').addEventListener('click', () => { month = shiftMonth(month, 1); renderAulas(container, store.getState()); });
  container.querySelector('#m-filter').addEventListener('change', (e) => { filter = e.target.value; renderAulas(container, store.getState()); });
  container.querySelectorAll('.abs-select').forEach((sel) => sel.addEventListener('change', () => {
    store.setAbsence(sel.dataset.d, sel.dataset.date, Number(sel.value));
  }));
  container.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    const [did, date] = b.dataset.rm.split('|');
    store.setAbsence(did, date, 0);
  }));
}
