/**
 * ajustes.js — Semestre, disciplinas, feriados/recessos, tema e backup.
 */

import * as m from '../model.js';
import * as store from '../store.js';
import { escapeHtml, toast } from '../dom.js';
import { openDisciplineDialog } from '../discipline-dialog.js';

function slotsText(d) {
  if (!d.slots.length) return 'sem dias fixos';
  return d.slots.map((s) => `${m.WEEKDAYS_SHORT[s.weekday]} ${s.hours}h`).join(' · ');
}

export function renderAjustes(container, state) {
  const { semester } = state;
  const theme = state.settings.theme;

  container.innerHTML = `
    <div class="section-head"><h2>Semestre</h2></div>
    <div class="card pad">
      <div class="field-row">
        <label class="field"><span class="field-label">Início das aulas</span><input id="s-start" type="date" value="${semester.start}"></label>
        <label class="field"><span class="field-label">Fim das aulas</span><input id="s-end" type="date" value="${semester.end}" min="${semester.start}"></label>
      </div>
      ${semester.start && semester.end && semester.end < semester.start ? '<p class="warn">O fim está antes do início.</p>' : ''}
    </div>

    <div class="section-head"><h2>Disciplinas</h2><span class="muted small">${state.disciplines.length}</span></div>
    <div class="manage-list">
      ${state.disciplines.map((d) => `
        <button type="button" class="manage-row" data-disc="${d.id}" style="--dc:${d.color}">
          <span class="dot" aria-hidden="true"></span>
          <span class="nm"><span class="t">${escapeHtml(d.name)}</span>
            <span class="d">${m.fmtHours(d.workload)} · ${slotsText(d)} · limite ${m.fmtHours(m.limitHours(d))}</span></span>
          <span class="chev" aria-hidden="true">›</span>
        </button>`).join('')}
    </div>
    <button class="add-btn" type="button" id="d-new">＋ Adicionar disciplina</button>

    <div class="section-head"><h2>Feriados e recessos</h2><span class="muted small">${state.holidays.length}</span></div>
    <div class="card pad">
      <div class="field-row three">
        <label class="field"><span class="field-label">Descrição</span><input id="h-name" type="text" maxlength="40" placeholder="Ex: Proclamação da República" autocomplete="off"></label>
        <label class="field"><span class="field-label">De</span><input id="h-start" type="date"></label>
        <label class="field"><span class="field-label">Até <span class="muted">(opcional)</span></span><input id="h-end" type="date"></label>
      </div>
      <button type="button" class="btn-ghost sm" id="h-add">Adicionar</button>
      ${state.holidays.length ? `<ul class="chips">${state.holidays.map((h) => `
        <li>${escapeHtml(h.name || 'Sem aula')} · ${m.fmtRange(h.start, h.end)} <button type="button" data-h-rm="${h.id}" aria-label="Remover">✕</button></li>`).join('')}</ul>` : ''}
      <p class="note">Nenhuma aula é gerada nesses dias, em nenhuma disciplina. Para cancelar a aula de uma só disciplina, edite a disciplina.</p>
    </div>

    <div class="section-head"><h2>Aparência e dados</h2></div>
    <div class="setting-row">
      <div><div class="st">Tema</div></div>
      <div class="seg" role="group" aria-label="Tema">
        ${[['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<button type="button" data-theme-opt="${v}" class="${theme === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
    <div class="setting-row">
      <div><div class="st">Backup</div><div class="sd">Os dados ficam só neste aparelho. Exporte para guardar ou levar a outro aparelho.</div></div>
      <div class="stack">
        <button type="button" class="link-btn" id="b-export">Exportar</button>
        <button type="button" class="link-btn" id="b-import">Importar</button>
        <input type="file" id="b-file" accept="application/json,.json" hidden>
      </div>
    </div>
    <div class="setting-row">
      <div><div class="st">Apagar tudo</div><div class="sd">Remove semestre, disciplinas, faltas e viagens deste aparelho.</div></div>
      <button type="button" class="btn-danger sm" id="b-reset">Apagar</button>
    </div>
    <p class="note">Regra usada: presença mínima de 75% por disciplina, em horas-aula; limite de faltas = 25% da carga horária nominal. Confira no regulamento da sua faculdade se há regras adicionais (abono, exercícios domiciliares, arredondamento).</p>`;

  const sStart = container.querySelector('#s-start');
  const sEnd = container.querySelector('#s-end');
  const saveSem = () => store.setSemester(sStart.value, sEnd.value);
  sStart.addEventListener('change', saveSem);
  sEnd.addEventListener('change', saveSem);

  container.querySelectorAll('[data-disc]').forEach((b) => b.addEventListener('click', () => openDisciplineDialog(b.dataset.disc)));
  container.querySelector('#d-new').addEventListener('click', () => openDisciplineDialog(null));

  container.querySelector('#h-add').addEventListener('click', () => {
    const ok = store.addHoliday({
      name: container.querySelector('#h-name').value,
      start: container.querySelector('#h-start').value,
      end: container.querySelector('#h-end').value,
    });
    if (!ok) toast('Informe a data do feriado.');
  });
  container.querySelectorAll('[data-h-rm]').forEach((b) => b.addEventListener('click', () => store.removeHoliday(b.dataset.hRm)));

  container.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => store.setSetting('theme', b.dataset.themeOpt)));

  container.querySelector('#b-export').addEventListener('click', () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `presenca-backup-${m.todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const file = container.querySelector('#b-file');
  container.querySelector('#b-import').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    if (!confirm('Importar este backup substitui todos os dados atuais. Continuar?')) return;
    toast(store.importData(await f.text()) ? 'Backup importado.' : 'Arquivo de backup inválido.');
  });
  container.querySelector('#b-reset').addEventListener('click', () => {
    if (confirm('Apagar todos os dados do Presença neste aparelho? Isso não pode ser desfeito.')) {
      store.resetAll();
      toast('Dados apagados.');
    }
  });
}
