/**
 * notifications.js — Lembretes locais.
 *
 * LIMITAÇÃO HONESTA: sem servidor, as notificações disparam de forma confiável
 * apenas enquanto o app está aberto/rodando (aba ou PWA instalado ativo). Um
 * lembrete com o app totalmente fechado exigiria Push API + servidor, o que
 * está fora do escopo deste app só-local. Isso é comunicado na tela de Ajustes.
 *
 * Estratégia: um loop a cada 30s compara o horário atual (HH:MM) com o
 * `reminderTime` de cada hábito ainda não concluído hoje, disparando no máximo
 * uma vez por hábito por dia.
 */

import { pad2, dateKey, isChecked } from './model.js';

export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

export function permission() {
  return notificationsSupported() ? Notification.permission : 'denied';
}

export async function requestPermission() {
  if (!notificationsSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

const fired = {}; // habitId -> 'YYYY-MM-DD' já notificado
let timer = null;

export function startReminderLoop(getHabits, getCheckins) {
  stopReminderLoop();
  timer = setInterval(() => tick(getHabits, getCheckins), 30000);
  tick(getHabits, getCheckins);
}

export function stopReminderLoop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function tick(getHabits, getCheckins) {
  if (permission() !== 'granted') return;
  const now = new Date();
  const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const today = dateKey(now);
  for (const h of getHabits()) {
    if (h.archived || !h.reminderTime) continue;
    if (isChecked(getCheckins(), h.id, today)) continue; // já feito hoje
    if (h.reminderTime === hm && fired[h.id] !== today) {
      fired[h.id] = today;
      show(`${h.emoji} ${h.name}`, 'Hora do seu hábito! Faça o check-in ✅', 'reminder-' + h.id);
    }
  }
}

function show(title, body, tag) {
  try {
    new Notification(title, { body, tag });
  } catch (e) {
    console.warn('Não foi possível exibir a notificação.', e);
  }
}

/** Notificação de teste, usada ao ativar os lembretes nos Ajustes. */
export function testNotification() {
  if (permission() === 'granted') {
    show('Constância', 'Perfeito! Os lembretes estão ativados ✅', 'test');
  }
}
