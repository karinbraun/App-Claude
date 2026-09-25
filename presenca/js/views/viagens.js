/**
 * viagens.js — Cadastro e simulação de viagens.
 * O formulário mostra, antes de salvar, quais aulas caem no período, quantas
 * horas cada disciplina perde e como fica o saldo. Aulas que você conseguirá
 * assistir podem ser desmarcadas.
 */

import * as m from '../model.js';
import * as store from '../store.js';
import { escapeHtml, statusBadge, toast } from '../dom.js';

// Rascunho da viagem em edição (sobrevive a re-renderizações da tela).
let draft = null;

export function editTrip(id) {
  const t = id ? store.getTrip(id) : null;
  draft = t ? { ...t, excluded: [...t.excluded] } : { id: null, name: '', start: '', end: '', excluded: [] };
}

function balanceCell(before, after) {
  const cls = after < 0 ? 'neg' : '';
  return `${m.fmtHours(before)} → <b class="${cls}">${m.fmtHours(after)}</b>`;
}

function renderSimulation(el, state) {
  if (!draft || !m.isDateKey(draft.start)) {
    el.innerHTML = '<p class="muted small">Informe a data de saída para ver o impacto.</p>';
    return;
  }
  const trip = { ...draft, id: draft.id || '__draft__', end: m.isDateKey(draft.end) && draft.end >= draft.start ? draft.end : draft.start };
  const sim = m.simulateTrip(state, trip, m.todayKey());
  if (!sim.rows.length) {
    el.innerHTML = '<p class="sim-ok">Nenhuma aula cai nesse período. A viagem não afeta sua presença.</p>';
    return;
  }
  const verdict = {
    ok: '<p class="sim-ok">A viagem cabe: todas as disciplinas continuam dentro do limite de 25% de faltas.</p>',
    limit: '<p class="sim-limit">A viagem cabe, mas zera o saldo de ao menos uma disciplina: qualquer nova falta nela reprova.</p>',
    over: '<p class="sim-over">A viagem não cabe: ao menos uma disciplina passaria do limite de 25% de faltas.</p>',
  }[sim.worst];

  el.innerHTML = `
    ${verdict}
    <div class="sim-list">
      ${sim.rows.map((r) => `
        <div class="sim-row" style="--dc:${r.discipline.color}">
          <div class="sim-head">
            <span class="dot" aria-hidden="true"></span>
            <b class="sim-name">${escapeHtml(r.discipline.name)}</b>
            ${statusBadge(r.statusAfter)}
          </div>
          <div class="sim-nums small">
            <span>Perde <b>${m.fmtHours(r.hoursLost)}</b></span>
            <span>Saldo ${balanceCell(r.balanceBefore, r.balanceAfter)} <span class="muted">de ${m.fmtHours(r.limit)}</span></span>
          </div>
          <ul class="sim-sessions">
            ${r.sessions.map((s) => `
              <li>
                <label class="${s.registered ? 'is-reg' : ''}">
                  <input type="checkbox" data-key="${escapeHtml(s.key)}" ${!s.excluded ? 'checked' : ''} ${s.registered ? 'disabled' : ''}>
                  <span>${m.fmtDateLong(s.date)} · ${m.fmtHours(s.hours)}</span>
                  ${s.registered ? `<span class="muted small">falta já registrada (${m.fmtHours(s.registered)})</span>` : ''}
                  ${!s.registered && s.excluded ? '<span class="muted small">vou assistir</span>' : ''}
                </label>
              </li>`).join('')}
          </ul>
        </div>`).join('')}
    </div>
    <p class="note">Desmarque as aulas que você conseguirá assistir (por exemplo, se voltar a tempo da aula da noite).</p>`;

  el.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.addEventListener('change', () => {
    const set = new Set(draft.excluded);
    if (cb.checked) set.delete(cb.dataset.key);
    else set.add(cb.dataset.key);
    draft.excluded = [...set];
    renderSimulation(el, store.getState());
  }));
}

function tripItem(state, trip, today) {
  const sim = m.simulateTrip(state, trip, today);
  const past = trip.end < today;
  const impact = sim.rows.filter((r) => r.hoursLost > 0);
  return `
    <li class="card trip-item ${past ? 'past' : ''}">
      <div class="trip-main">
        <div class="trip-title">
          <b>${escapeHtml(trip.name || 'Viagem')}</b>
          <span class="muted small">${m.fmtRange(trip.start, trip.end)}${past ? ' · concluída' : ''}</span>
        </div>
        ${sim.rows.length ? statusBadge(sim.worst) : ''}
      </div>
      <div class="small trip-impact">
        ${impact.length
          ? impact.map((r) => `<span style="--dc:${r.discipline.color}"><i class="dot" aria-hidden="true"></i>${escapeHtml(r.discipline.name)}: −${m.fmtHours(r.hoursLost)}</span>`).join('')
          : '<span class="muted">Sem faltas nesta viagem.</span>'}
      </div>
      <div class="row-actions">
        <button class="btn-ghost sm" type="button" data-edit="${trip.id}">Editar</button>
        <button class="btn-danger sm" type="button" data-del="${trip.id}">Excluir</button>
      </div>
    </li>`;
}

export function renderViagens(container, state) {
  const today = m.todayKey();
  const ready = state.disciplines.length && state.semester.start && state.semester.end;

  const form = draft ? `
    <section class="card form-card">
      <h2>${draft.id ? 'Editar viagem' : 'Nova viagem'}</h2>
      <label class="field"><span class="field-label">Nome ou destino <span class="muted">(opcional)</span></span>
        <input id="t-name" type="text" maxlength="60" placeholder="Ex: Cliente em Recife" value="${escapeHtml(draft.name)}" autocomplete="off"></label>
      <div class="field-row">
        <label class="field"><span class="field-label">Saída</span><input id="t-start" type="date" value="${draft.start}"></label>
        <label class="field"><span class="field-label">Volta</span><input id="t-end" type="date" value="${draft.end}" min="${draft.start}"></label>
      </div>
      <div id="sim" class="sim"></div>
      <div class="dialog-actions">
        <span class="spacer"></span>
        <button type="button" class="btn-ghost" id="t-cancel">Descartar</button>
        <button type="button" class="btn-primary" id="t-save">Salvar viagem</button>
      </div>
    </section>` : '';

  const trips = state.trips;
  container.innerHTML = `
    ${!ready ? '<p class="warn">Configure o semestre e as disciplinas em Ajustes para que a simulação encontre as aulas.</p>' : ''}
    ${draft ? form : `<button class="add-btn" type="button" id="t-new">＋ Simular nova viagem</button>`}
    <div class="section-head"><h2>Viagens</h2><span class="muted small">${trips.length}</span></div>
    ${trips.length
      ? `<ul class="trip-list">${trips.map((t) => tripItem(state, t, today)).join('')}</ul>`
      : '<p class="muted small">Nenhuma viagem cadastrada.</p>'}`;

  const newBtn = container.querySelector('#t-new');
  if (newBtn) newBtn.addEventListener('click', () => { editTrip(null); renderViagens(container, store.getState()); container.querySelector('#t-name')?.focus(); });

  if (draft) {
    const sim = container.querySelector('#sim');
    const startEl = container.querySelector('#t-start');
    const endEl = container.querySelector('#t-end');
    container.querySelector('#t-name').addEventListener('input', (e) => { draft.name = e.target.value; });
    startEl.addEventListener('change', () => {
      draft.start = startEl.value;
      if (!draft.end || draft.end < draft.start) { draft.end = draft.start; endEl.value = draft.start; }
      endEl.min = draft.start;
      renderSimulation(sim, store.getState());
    });
    endEl.addEventListener('change', () => { draft.end = endEl.value; renderSimulation(sim, store.getState()); });
    container.querySelector('#t-cancel').addEventListener('click', () => { draft = null; renderViagens(container, store.getState()); });
    container.querySelector('#t-save').addEventListener('click', () => {
      if (!m.isDateKey(draft.start)) { toast('Informe a data de saída.'); startEl.focus(); return; }
      const data = { ...draft };
      if (!data.id) delete data.id;
      draft = null;
      store.saveTrip(data);
      toast('Viagem salva.');
    });
    renderSimulation(sim, state);
  }

  container.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    editTrip(b.dataset.edit);
    renderViagens(container, store.getState());
    container.scrollIntoView?.({ block: 'start' });
  }));
  container.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    const t = store.getTrip(b.dataset.del);
    if (t && confirm(`Excluir a viagem "${t.name || m.fmtRange(t.start, t.end)}"?`)) {
      if (draft && draft.id === t.id) draft = null;
      store.deleteTrip(t.id);
    }
  }));
}
