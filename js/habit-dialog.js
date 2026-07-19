/**
 * habit-dialog.js — Controla o modal de criar/editar hábito.
 *
 * O <dialog> vive no index.html (fora das telas) para não perder o foco quando
 * uma tela é re-renderizada. Exporta openHabitDialog(id?) usado por várias telas.
 */

import * as store from './store.js';
import { COLORS, EMOJIS } from './constants.js';
import { toast } from './dom.js';

let dialog, form;
let initialized = false;
let editingId = null;
let selEmoji = EMOJIS[0];
let selColor = COLORS[0];

function init() {
  dialog = document.getElementById('habit-dialog');
  form = document.getElementById('habit-form');

  const emojiWrap = document.getElementById('f-emoji');
  emojiWrap.innerHTML = EMOJIS
    .map((e) => `<button type="button" class="emoji-opt" data-emoji="${e}" role="radio">${e}</button>`)
    .join('');
  emojiWrap.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-emoji]');
    if (!b) return;
    selEmoji = b.dataset.emoji;
    paintEmoji();
  });

  const colorWrap = document.getElementById('f-color');
  colorWrap.innerHTML = COLORS
    .map((c) => `<button type="button" class="color-opt" data-color="${c}" role="radio" style="background:${c};color:${c}" aria-label="Cor ${c}"></button>`)
    .join('');
  colorWrap.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-color]');
    if (!b) return;
    selColor = b.dataset.color;
    paintColor();
  });

  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'goalType') {
      document.getElementById('weekly-target').hidden = ev.target.value !== 'weekly';
    }
  });

  dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));

  document.getElementById('f-delete').addEventListener('click', () => {
    if (editingId && confirm('Excluir este hábito e todo o histórico dele? Não dá para desfazer.')) {
      store.deleteHabit(editingId);
      dialog.close();
      toast('Hábito excluído');
    }
  });

  form.addEventListener('submit', (ev) => {
    const name = document.getElementById('f-name').value.trim();
    if (!name) {
      ev.preventDefault();
      return;
    }
    const goalType = form.querySelector('input[name="goalType"]:checked').value;
    const goalTarget = Number(document.getElementById('f-target').value);
    const reminderTime = document.getElementById('f-reminder').value || null;
    const data = { name, emoji: selEmoji, color: selColor, goalType, goalTarget, reminderTime };
    if (editingId) {
      store.updateHabit(editingId, data);
      toast('Hábito atualizado');
    } else {
      store.addHabit(data);
      toast('Hábito criado');
    }
    // method="dialog" fecha o modal por padrão após o submit.
  });

  initialized = true;
}

function paintEmoji() {
  document.querySelectorAll('#f-emoji .emoji-opt')
    .forEach((b) => b.classList.toggle('sel', b.dataset.emoji === selEmoji));
}

function paintColor() {
  document.querySelectorAll('#f-color .color-opt')
    .forEach((b) => b.classList.toggle('sel', b.dataset.color === selColor));
}

/** Abre o modal. Sem id = novo hábito; com id = edição. */
export function openHabitDialog(habitId = null) {
  if (!initialized) init();
  editingId = habitId;
  const h = habitId ? store.getHabit(habitId) : null;

  document.getElementById('dialog-title').textContent = h ? 'Editar hábito' : 'Novo hábito';
  document.getElementById('f-name').value = h ? h.name : '';
  selEmoji = h ? h.emoji : EMOJIS[0];
  selColor = h ? h.color : COLORS[0];
  paintEmoji();
  paintColor();

  const gt = h && h.goalType === 'weekly' ? 'weekly' : 'daily';
  form.querySelector(`input[name="goalType"][value="${gt}"]`).checked = true;
  document.getElementById('weekly-target').hidden = gt !== 'weekly';
  document.getElementById('f-target').value = String(h && gt === 'weekly' ? h.goalTarget : 3);
  document.getElementById('f-reminder').value = h && h.reminderTime ? h.reminderTime : '';
  document.getElementById('f-delete').hidden = !h;

  dialog.showModal();
  setTimeout(() => document.getElementById('f-name').focus(), 40);
}
