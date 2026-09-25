/**
 * discipline-dialog.js — Modal de criar/editar disciplina: nome, cor, carga
 * horária, dias de aula (grade semanal), cancelamentos e reposições.
 */

import * as m from './model.js';
import * as store from './store.js';
import { escapeHtml, toast } from './dom.js';

let ed = null; // cópia em edição

const dialog = () => document.getElementById('disc-dialog');
const form = () => document.getElementById('disc-form');

export function openDisciplineDialog(id = null) {
  const d = id ? store.getDiscipline(id) : null;
  ed = d
    ? JSON.parse(JSON.stringify(d))
    : {
      name: '',
      color: store.COLORS[store.getState().disciplines.length % store.COLORS.length],
      workload: 40,
      slots: [{ weekday: 1, hours: 2 }],
      cancelled: [],
      extra: [],
    };
  draw();
  dialog().showModal();
  form().querySelector('#d-name').focus();
}

function weekdayOptions(sel) {
  // Segunda a sábado primeiro; domingo por último.
  return [1, 2, 3, 4, 5, 6, 0]
    .map((w) => `<option value="${w}" ${w === sel ? 'selected' : ''}>${m.WEEKDAYS_LONG[w]}</option>`)
    .join('');
}

function draw() {
  const preset = ed.workload === 40 || ed.workload === 80;
  const weekly = ed.slots.reduce((s, x) => s + (Number(x.hours) || 0), 0);
  form().innerHTML = `
    <div class="dialog-head">
      <h2>${ed.id ? 'Editar disciplina' : 'Nova disciplina'}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Fechar">✕</button>
    </div>

    <label class="field"><span class="field-label">Nome</span>
      <input id="d-name" type="text" maxlength="60" required placeholder="Ex: Psicologia do Desenvolvimento" value="${escapeHtml(ed.name)}" autocomplete="off"></label>

    <div class="field"><span class="field-label">Cor</span>
      <div class="color-grid" role="radiogroup" aria-label="Cor">
        ${store.COLORS.map((c) => `<button type="button" class="color-opt ${c === ed.color ? 'sel' : ''}" data-color="${c}"
          style="background:${c};color:${c}" role="radio" aria-checked="${c === ed.color}" aria-label="Cor ${c}"></button>`).join('')}
      </div>
    </div>

    <div class="field"><span class="field-label">Carga horária</span>
      <div class="goal-row">
        <label class="chip-radio"><input type="radio" name="wl" value="40" ${ed.workload === 40 ? 'checked' : ''}> 40h</label>
        <label class="chip-radio"><input type="radio" name="wl" value="80" ${ed.workload === 80 ? 'checked' : ''}> 80h</label>
        <label class="chip-radio"><input type="radio" name="wl" value="other" ${!preset ? 'checked' : ''}> Outra</label>
      </div>
      ${!preset ? `<div class="target-row"><input id="d-wl" type="number" min="1" step="1" value="${ed.workload}" class="num"> horas-aula</div>` : ''}
      <span class="note">Limite de faltas: <b>${m.fmtHours(m.limitHours(ed))}</b> (25% da carga).</span>
    </div>

    <div class="field"><span class="field-label">Dias de aula (toda semana)</span>
      ${ed.slots.map((s, i) => `
        <div class="slot-row">
          <select data-slot-wd="${i}" aria-label="Dia da semana">${weekdayOptions(s.weekday)}</select>
          <input data-slot-h="${i}" type="number" min="1" max="12" step="1" value="${s.hours}" class="num" aria-label="Horas-aula">
          <span class="muted small">h-aula</span>
          <button type="button" class="row-edit" data-slot-rm="${i}" aria-label="Remover dia">✕</button>
        </div>`).join('')}
      <button type="button" class="link-btn left" id="d-slot-add">＋ Adicionar dia</button>
      <span class="note">${weekly ? `${m.fmtHours(weekly)} por semana.` : 'Sem dias de aula: só contam as reposições.'}</span>
    </div>

    <details class="field" ${ed.cancelled.length ? 'open' : ''}>
      <summary class="field-label">Aulas canceladas <span class="muted">(${ed.cancelled.length})</span></summary>
      <div class="inline-add"><input id="d-can" type="date" aria-label="Data cancelada"><button type="button" class="btn-ghost sm" id="d-can-add">Adicionar</button></div>
      <ul class="chips">${ed.cancelled.sort().map((c, i) => `<li>${m.fmtDateLong(c)} <button type="button" data-can-rm="${i}" aria-label="Remover">✕</button></li>`).join('')}</ul>
      <span class="note">Feriados e recessos que valem para todas as disciplinas ficam em Ajustes.</span>
    </details>

    <details class="field" ${ed.extra.length ? 'open' : ''}>
      <summary class="field-label">Reposições / aulas extras <span class="muted">(${ed.extra.length})</span></summary>
      <div class="inline-add"><input id="d-ex" type="date" aria-label="Data da reposição">
        <input id="d-exh" type="number" min="1" max="12" value="2" class="num" aria-label="Horas-aula"><span class="muted small">h</span>
        <button type="button" class="btn-ghost sm" id="d-ex-add">Adicionar</button></div>
      <ul class="chips">${ed.extra.sort((a, b) => (a.date < b.date ? -1 : 1)).map((e, i) => `<li>${m.fmtDateLong(e.date)} · ${e.hours}h <button type="button" data-ex-rm="${i}" aria-label="Remover">✕</button></li>`).join('')}</ul>
    </details>

    <div class="dialog-actions">
      ${ed.id ? '<button type="button" class="btn-danger" id="d-delete">Excluir</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn-ghost" data-close>Cancelar</button>
      <button type="submit" class="btn-primary">Salvar</button>
    </div>`;
  bind();
}

/** Lê os campos de texto/número para o rascunho antes de redesenhar. */
function sync() {
  const f = form();
  ed.name = f.querySelector('#d-name').value;
  const wl = f.querySelector('input[name="wl"]:checked').value;
  const custom = f.querySelector('#d-wl');
  ed.workload = wl === 'other' ? Math.max(1, Math.round(Number(custom ? custom.value : ed.workload) || 1)) : Number(wl);
  ed.slots.forEach((s, i) => {
    s.weekday = Number(f.querySelector(`[data-slot-wd="${i}"]`).value);
    s.hours = Math.max(1, Math.round(Number(f.querySelector(`[data-slot-h="${i}"]`).value) || 1));
  });
}

function redraw() {
  sync();
  draw();
}

function bind() {
  const f = form();
  f.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog().close()));
  f.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { ed.color = b.dataset.color; redraw(); }));
  f.querySelectorAll('input[name="wl"]').forEach((r) => r.addEventListener('change', () => {
    if (r.value === 'other' && (ed.workload === 40 || ed.workload === 80)) ed.workload = 60;
    else if (r.value !== 'other') ed.workload = Number(r.value);
    const custom = f.querySelector('#d-wl');
    if (custom && r.value === 'other') custom.value = ed.workload;
    // Redesenha sem ler o campo "Outra" (que pode ainda não existir).
    ed.name = f.querySelector('#d-name').value;
    draw();
  }));
  f.querySelector('#d-wl')?.addEventListener('change', redraw);
  f.querySelectorAll('[data-slot-h]').forEach((i) => i.addEventListener('change', redraw));
  f.querySelector('#d-slot-add').addEventListener('click', () => {
    sync();
    const last = ed.slots[ed.slots.length - 1];
    ed.slots.push({ weekday: last ? (last.weekday % 6) + 1 : 1, hours: last ? last.hours : 2 });
    draw();
  });
  f.querySelectorAll('[data-slot-rm]').forEach((b) => b.addEventListener('click', () => {
    sync();
    ed.slots.splice(Number(b.dataset.slotRm), 1);
    draw();
  }));
  f.querySelector('#d-can-add').addEventListener('click', () => {
    const v = f.querySelector('#d-can').value;
    if (!m.isDateKey(v)) return;
    sync();
    if (!ed.cancelled.includes(v)) ed.cancelled.push(v);
    draw();
  });
  f.querySelectorAll('[data-can-rm]').forEach((b) => b.addEventListener('click', () => {
    sync();
    ed.cancelled.splice(Number(b.dataset.canRm), 1);
    draw();
  }));
  f.querySelector('#d-ex-add').addEventListener('click', () => {
    const v = f.querySelector('#d-ex').value;
    const h = Math.max(1, Math.round(Number(f.querySelector('#d-exh').value) || 2));
    if (!m.isDateKey(v)) return;
    sync();
    ed.extra = ed.extra.filter((e) => e.date !== v);
    ed.extra.push({ date: v, hours: h });
    draw();
  });
  f.querySelectorAll('[data-ex-rm]').forEach((b) => b.addEventListener('click', () => {
    sync();
    ed.extra.splice(Number(b.dataset.exRm), 1);
    draw();
  }));
  f.querySelector('#d-delete')?.addEventListener('click', () => {
    if (!confirm(`Excluir "${ed.name}"? As faltas registradas nela também serão apagadas.`)) return;
    store.deleteDiscipline(ed.id);
    dialog().close();
    toast('Disciplina excluída.');
  });
}

export function initDisciplineDialog() {
  form().addEventListener('submit', (e) => {
    e.preventDefault();
    sync();
    if (!ed.name.trim()) { form().querySelector('#d-name').focus(); return; }
    store.saveDiscipline(ed);
    dialog().close();
    toast('Disciplina salva.');
  });
}
