/**
 * painel.js — Visão geral: saldo de faltas por disciplina.
 * Cada cartão mostra a barra do limite (25% da carga) dividida em faltas
 * registradas, faltas previstas por viagens e saldo restante.
 */

import * as m from '../model.js';
import * as store from '../store.js';
import { escapeHtml, statusBadge, go, toast } from '../dom.js';

function bar(sum) {
  const cap = Math.max(sum.limit, sum.total, 0.0001);
  const pct = (h) => `${Math.min(100, (h / cap) * 100)}%`;
  const limitPos = sum.total > sum.limit ? `<span class="bar-limit" style="left:${pct(sum.limit)}" title="Limite"></span>` : '';
  return `
    <div class="bar bar-${sum.status}" role="img"
         aria-label="${m.fmtHours(sum.total)} de faltas de ${m.fmtHours(sum.limit)} permitidas">
      <span class="bar-seg reg" style="width:${pct(sum.registered)}"></span>
      <span class="bar-seg past" style="width:${pct(sum.pastTrip)}"></span>
      <span class="bar-seg plan" style="width:${pct(sum.planned)}"></span>
      ${limitPos}
    </div>`;
}

function card(sum) {
  const d = sum.discipline;
  const balanceTxt = sum.balance >= 0
    ? `Saldo: <b>${m.fmtHours(sum.balance)}</b>${sum.sessionsLeft ? ` <span class="muted">(${sum.sessionsLeft} encontro${sum.sessionsLeft > 1 ? 's' : ''} de ${m.fmtHours(sum.typicalHours)})</span>` : ''}`
    : `Excedeu em <b>${m.fmtHours(-sum.balance)}</b>`;
  const parts = [`registradas ${m.fmtHours(sum.registered)}`];
  if (sum.pastTrip) parts.push(`viagens passadas ${m.fmtHours(sum.pastTrip)}`);
  if (sum.planned) parts.push(`viagens ${m.fmtHours(sum.planned)}`);

  const warnings = [];
  if (!d.slots.length && !sum.sessionCount) warnings.push('Sem dias de aula cadastrados.');
  else if (sum.calendarMismatch) {
    warnings.push(`Calendário gerado: ${m.fmtHours(sum.calendarHours)} de ${m.fmtHours(sum.workload)}. `
      + 'O limite segue calculado sobre a carga nominal; confira feriados e grade.');
  }
  if (sum.pastTrip) warnings.push('Há aulas de viagens já passadas ainda não registradas como falta.');

  return `
    <article class="card disc-card" style="--dc:${d.color}">
      <header class="disc-head">
        <span class="dot" aria-hidden="true"></span>
        <div class="disc-title">
          <h3>${escapeHtml(d.name)}</h3>
          <div class="muted small">${m.fmtHours(d.workload)} · limite de ${m.fmtHours(sum.limit)} de faltas</div>
        </div>
        ${statusBadge(sum.status)}
      </header>
      ${bar(sum)}
      <div class="disc-nums">
        <span>${balanceTxt}</span>
        <span class="muted">Presença projetada: <b>${m.fmtPct(Math.max(0, sum.attendance))}</b></span>
      </div>
      <div class="muted small">Faltas ${m.fmtHours(sum.total)}: ${parts.join(' · ')}</div>
      ${warnings.map((w) => `<p class="warn">${escapeHtml(w)}</p>`).join('')}
    </article>`;
}

export function renderPainel(container, state) {
  const today = m.todayKey();
  if (!state.disciplines.length || !state.semester.start || !state.semester.end) {
    container.innerHTML = `
      <div class="empty">
        <div class="emoji" aria-hidden="true">🎓</div>
        <h2>Configure o semestre</h2>
        <p>Informe as datas do semestre e cadastre suas disciplinas com os dias e as horas-aula de cada encontro.</p>
        <button class="btn-primary" type="button" data-go="ajustes">Ir para Ajustes</button>
      </div>`;
    container.querySelector('[data-go]').addEventListener('click', () => go('ajustes'));
    return;
  }

  const sums = m.allSummaries(state, today);
  const risk = sums.filter((s) => s.status !== 'ok').length;
  const nextTrip = state.trips.find((t) => t.end >= today);
  const pastTripSessions = [];
  const sessions = m.generateSessions(state);
  for (const s of m.tripAbsenceSessions(sessions, state.trips, state.absences).values()) {
    if (s.date < today) pastTripSessions.push(s);
  }

  container.innerHTML = `
    <section class="summary-grid">
      <div class="summary-card"><div class="big">${sums.length}</div><div class="lbl">disciplinas</div></div>
      <div class="summary-card ${risk ? 'alert' : ''}"><div class="big">${risk}</div><div class="lbl">no limite ou acima</div></div>
      <div class="summary-card"><div class="big">${state.trips.filter((t) => t.end >= today).length}</div><div class="lbl">viagens futuras</div></div>
    </section>
    ${nextTrip ? `<button class="next-trip card" type="button" data-go="viagens">
        <span class="muted small">Próxima viagem</span>
        <b>${escapeHtml(nextTrip.name || 'Viagem')}</b> · ${m.fmtRange(nextTrip.start, nextTrip.end)}
      </button>` : ''}
    ${pastTripSessions.length ? `
      <div class="card notice">
        <p>${pastTripSessions.length} aula${pastTripSessions.length > 1 ? 's' : ''} de viagens já passadas
        ainda não ${pastTripSessions.length > 1 ? 'foram registradas' : 'foi registrada'} como falta.
        Elas já entram no cálculo; registre para confirmar.</p>
        <div class="row-actions">
          <button class="btn-ghost" type="button" data-go="aulas">Revisar</button>
          <button class="btn-primary" type="button" id="reg-past">Registrar todas</button>
        </div>
      </div>` : ''}
    <div class="legend small muted">
      <span><i class="lg reg"></i>registradas</span>
      <span><i class="lg past"></i>viagens passadas</span>
      <span><i class="lg plan"></i>previstas em viagens</span>
      <span>barra cheia = limite de 25%</span>
    </div>
    <div class="disc-list">${sums.map(card).join('')}</div>`;

  container.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  const reg = container.querySelector('#reg-past');
  if (reg) {
    reg.addEventListener('click', () => {
      store.registerAbsences(pastTripSessions.map((s) => ({ disciplineId: s.disciplineId, date: s.date, hours: s.hours })));
      toast('Faltas registradas.');
    });
  }
}
