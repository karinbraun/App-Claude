/** views/habits.js — Tela "Hábitos": gestão dos hábitos + ajustes (tema, lembretes, backup). */

import * as store from '../store.js';
import { escapeHtml, toast } from '../dom.js';
import { openHabitDialog } from '../habit-dialog.js';
import { permission, requestPermission, testNotification, notificationsSupported } from '../notifications.js';

export function renderHabits(container, state) {
  const active = store.activeHabits();
  const archived = store.archivedHabits();

  const goalText = (h) => (h.goalType === 'weekly' ? `${h.goalTarget}x por semana` : 'Todo dia');
  const remText = (h) => (h.reminderTime ? ` · 🔔 ${h.reminderTime}` : '');

  const rows = active.map((h, i) => `
    <div class="manage-row" style="--hc:${h.color}">
      <div class="reorder">
        <button data-move="${h.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Mover ${escapeHtml(h.name)} para cima">▲</button>
        <button data-move="${h.id}" data-dir="1" ${i === active.length - 1 ? 'disabled' : ''} aria-label="Mover ${escapeHtml(h.name)} para baixo">▼</button>
      </div>
      <span class="e">${escapeHtml(h.emoji)}</span>
      <div class="nm">
        <div class="t">${escapeHtml(h.name)}</div>
        <div class="d">${goalText(h)}${remText(h)}</div>
      </div>
      <button class="row-edit" data-edit="${h.id}" aria-label="Editar ${escapeHtml(h.name)}">✎</button>
    </div>`).join('');

  const archivedSection = archived.length ? `
    <div class="section-head" style="margin-top:22px"><h2>Arquivados</h2></div>
    <div class="manage-list">
      ${archived.map((h) => `
        <div class="manage-row" style="--hc:${h.color};opacity:.75">
          <span class="e">${escapeHtml(h.emoji)}</span>
          <div class="nm"><div class="t">${escapeHtml(h.name)}</div><div class="d">arquivado</div></div>
          <button class="link-btn" data-restore="${h.id}">Restaurar</button>
        </div>`).join('')}
    </div>` : '';

  const theme = state.settings.theme;
  const notifState = !notificationsSupported() ? 'indisponível neste navegador'
    : permission() === 'granted' ? 'ativados'
    : permission() === 'denied' ? 'bloqueados no navegador'
    : 'desativados';

  container.innerHTML = `
    <div class="section-head"><h2>Meus hábitos</h2></div>
    <div class="manage-list">${rows || '<p class="note">Nenhum hábito ainda. Crie o primeiro abaixo.</p>'}</div>
    <button class="add-habit-btn" data-new>+ Novo hábito</button>

    ${archivedSection}

    <div class="settings">
      <div class="section-head"><h2>Ajustes</h2></div>

      <div class="setting-row">
        <div><div class="st">Tema</div><div class="sd">Aparência do app</div></div>
        <div class="seg" role="group" aria-label="Tema">
          <button data-theme-opt="system" class="${theme === 'system' ? 'on' : ''}">Auto</button>
          <button data-theme-opt="light" class="${theme === 'light' ? 'on' : ''}">Claro</button>
          <button data-theme-opt="dark" class="${theme === 'dark' ? 'on' : ''}">Escuro</button>
        </div>
      </div>

      <div class="setting-row">
        <div><div class="st">Lembretes</div><div class="sd">Notificações de check-in (${notifState})</div></div>
        ${permission() === 'granted'
          ? '<button class="link-btn" data-test-notif>Testar</button>'
          : `<button class="link-btn" data-enable-notif ${!notificationsSupported() || permission() === 'denied' ? 'disabled' : ''}>Ativar</button>`}
      </div>
      <p class="note">Os lembretes tocam quando o app está aberto ou instalado e em uso. Avisos com o app totalmente fechado exigiriam um servidor — este app roda 100% no seu aparelho e não usa nenhum.</p>

      <div class="setting-row" style="margin-top:12px">
        <div><div class="st">Backup dos dados</div><div class="sd">Seus dados ficam só neste aparelho. Exporte para guardar ou levar para outro.</div></div>
        <div style="display:flex;gap:4px">
          <button class="link-btn" data-export>Exportar</button>
          <button class="link-btn" data-import>Importar</button>
        </div>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>
  `;

  container.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openHabitDialog(b.dataset.edit)));
  container.querySelector('[data-new]').addEventListener('click', () => openHabitDialog());
  container.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => store.moveHabit(b.dataset.move, Number(b.dataset.dir))));
  container.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', () => { store.archiveHabit(b.dataset.restore, false); toast('Hábito restaurado'); }));
  container.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => store.setSetting('theme', b.dataset.themeOpt)));

  const enable = container.querySelector('[data-enable-notif]');
  if (enable) {
    enable.addEventListener('click', async () => {
      const p = await requestPermission();
      store.setSetting('notificationsEnabled', p === 'granted');
      if (p === 'granted') { testNotification(); toast('Lembretes ativados'); }
      else toast('Permissão não concedida');
    });
  }
  const testN = container.querySelector('[data-test-notif]');
  if (testN) testN.addEventListener('click', () => testNotification());

  const exp = container.querySelector('[data-export]');
  if (exp) exp.addEventListener('click', exportBackup);
  const imp = container.querySelector('[data-import]');
  const file = container.querySelector('#import-file');
  if (imp) imp.addEventListener('click', () => file.click());
  if (file) {
    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (confirm('Importar vai substituir os dados atuais. Continuar?')) {
          toast(store.importData(reader.result) ? 'Dados importados' : 'Arquivo inválido');
        }
      };
      reader.readAsText(f);
    });
  }
}

function exportBackup() {
  const blob = new Blob([store.exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `constancia-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup exportado');
}
